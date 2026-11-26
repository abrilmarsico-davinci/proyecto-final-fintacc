/* =========================================================
   Modales
   Ventanas de diálogo: paso a paso, códigos QR, puntos, reviews y comercios.
   ========================================================= */

/** Elemento que tenía el foco antes de abrir el modal, para devolvérselo al cerrar. */
let focoAntesDelModal = null;

const ELEMENTOS_ENFOCABLES =
  "a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex='-1'])";

/**
 * Mantiene el foco dentro del modal al navegar con Tab.
 * @param {KeyboardEvent} e Evento de teclado.
 */
function atraparFoco(e) {
  if (e.key !== "Tab") return;
  const enfocables = [...e.currentTarget.querySelectorAll(ELEMENTOS_ENFOCABLES)].filter((el) => !el.hidden);
  if (!enfocables.length) return;
  const primero = enfocables[0];
  const ultimo = enfocables[enfocables.length - 1];
  if (e.shiftKey && document.activeElement === primero) {
    e.preventDefault();
    ultimo.focus();
  } else if (!e.shiftKey && document.activeElement === ultimo) {
    e.preventDefault();
    primero.focus();
  }
}

/**
 * Abre un modal con el HTML indicado. El primer h2 se usa como nombre accesible del diálogo.
 * Se cierra con el fondo, con Escape o con cualquier elemento que tenga data-cerrar.
 * @param {string} html Contenido del modal.
 * @returns {HTMLDivElement} Fondo del modal, para conectar sus eventos.
 */
function abrirModal(html) {
  const fondoAnterior = document.querySelector(".modal-fondo");
  if (fondoAnterior) fondoAnterior.remove();
  else focoAntesDelModal = document.activeElement;

  const fondo = document.createElement("div");
  fondo.className = "modal-fondo";
  fondo.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
  const titulo = fondo.querySelector("h2");
  if (titulo) {
    titulo.id = "titulo-modal";
    fondo.querySelector(".modal").setAttribute("aria-labelledby", "titulo-modal");
  }
  fondo.addEventListener("click", (e) => {
    if (e.target === fondo || e.target.closest("[data-cerrar]")) cerrarModal();
  });
  fondo.addEventListener("keydown", atraparFoco);
  document.body.appendChild(fondo);
  fondo.querySelector("button:not([disabled]), input, select, textarea")?.focus();
  return fondo;
}

/**
 * Cierra el modal abierto y devuelve el foco al elemento que lo abrió.
 */
function cerrarModal() {
  const fondo = document.querySelector(".modal-fondo");
  if (!fondo) return;
  fondo.remove();
  restaurarFoco(focoAntesDelModal);
  focoAntesDelModal = null;
}

/**
 * Devuelve el foco al elemento indicado. Si la pantalla se volvió a dibujar,
 * busca el elemento equivalente por su data-accion y data-id.
 * @param {?HTMLElement} elemento Elemento que tenía el foco.
 */
function restaurarFoco(elemento) {
  if (!elemento) return;
  if (elemento.isConnected) {
    elemento.focus();
    return;
  }
  const { accion, id } = elemento.dataset || {};
  if (!accion) return;
  const selector = `[data-accion="${accion}"]` + (id ? `[data-id="${CSS.escape(id)}"]` : "");
  app.querySelector(selector)?.focus();
}

/**
 * Modo cocina: muestra un paso de la receta por vez.
 * @param {ReturnType<typeof normalizarReceta>} receta Receta normalizada.
 */
function modalPasos(receta) {
  const total = receta.pasos.length;
  const i = ui.paso;
  const fondo = abrirModal(`
    <h2>${escapar(receta.nombre)}</h2>
    <div class="paso-a-paso">
      <div class="numero-paso">${i + 1}<span class="suave total-pasos"> / ${total}</span></div>
      <p>${escapar(receta.pasos[i])}</p>
      <div class="fila-botones">
        <button class="boton boton-secundario" data-paso="-1" ${i === 0 ? "disabled" : ""}>Anterior</button>
        ${i < total - 1 ? '<button class="boton" data-paso="1">Siguiente</button>' : '<button class="boton" data-cerrar>Terminar</button>'}
      </div>
    </div>`);
  fondo.querySelectorAll("[data-paso]").forEach((b) =>
    b.addEventListener("click", () => {
      ui.paso += Number(b.dataset.paso);
      modalPasos(receta);
    })
  );
}

/**
 * Muestra el código y el QR del cliente para sumar puntos en la caja.
 */
function modalCodigoCliente() {
  const codigo = codigoCliente(estado.usuario.id);
  abrirModal(`
    <h2>Tu código Fintacc</h2>
    <p class="suave mt-6">Mostralo en la caja de un comercio adherido para sumar puntos por tu compra.</p>
    <div class="qr" id="qr-cliente"></div>
    <p class="codigo">${codigo}</p>
    <p class="suave chico centrado">También pueden cargarte los puntos con tu email.</p>
    <button class="boton boton-ancho mt-20" data-cerrar>Listo</button>`);
  const contenedor = document.getElementById("qr-cliente");
  if (window.qrcode) {
    const qr = qrcode(0, "M");
    qr.addData(`FINTACC-CLIENTE:${codigo}`);
    qr.make();
    contenedor.innerHTML = qr.createSvgTag({ cellSize: 6, margin: 0, scalable: true });
    contenedor.querySelector("svg").setAttribute("style", "width:200px;height:200px");
  } else contenedor.textContent = "No se pudo generar el QR. Usá el código de abajo.";
}

/**
 * Lee un código QR con la cámara (BarcodeDetector) y corta la cámara al encontrarlo.
 * @param {HTMLElement} fondo Modal que contiene el video #camara-qr.
 * @param {(texto: string) => void} alLeer Recibe el contenido del QR.
 * @returns {Promise<void>}
 */
async function leerQR(fondo, alLeer) {
  const camara = fondo.querySelector("#camara-qr");
  try {
    if (!("BarcodeDetector" in window))
      throw new Error("Este navegador no puede leer QR con la cámara. Ingresá el código a mano.");
    const flujo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    camara.srcObject = flujo;
    camara.hidden = false;
    await camara.play();
    const detector = new BarcodeDetector({ formats: ["qr_code"] });
    const escanear = async () => {
      if (!camara.isConnected) {
        flujo.getTracks().forEach((t) => t.stop());
        return;
      }
      const codigos = await detector.detect(camara);
      if (codigos.length) {
        flujo.getTracks().forEach((t) => t.stop());
        camara.hidden = true;
        alLeer(codigos[0].rawValue);
        avisar("Código leído", "exito");
      } else requestAnimationFrame(escanear);
    };
    escanear();
  } catch (error) {
    avisar(error.message || "No se pudo abrir la cámara", "error");
  }
}

/**
 * Formulario de la marca para acreditar puntos por una compra.
 */
function modalCargarPuntos() {
  const misLocales = (db.locales || []).filter(
    (l) => estado.usuario.rol === ROLES.administracion || l.merchant_user_id === estado.usuario.id
  );
  if (!misLocales.length) {
    avisar("Tu cuenta todavía no tiene locales asignados para cargar puntos.", "error");
    return;
  }
  const fondo = abrirModal(`
    <h2>Cargar puntos</h2>
    <p class="suave bajada-modal">Se acredita 1 punto cada ${pesos(PESOS_POR_PUNTO)} de compra.</p>
    <video id="camara-qr" class="camara-qr" playsinline hidden></video>
    <button class="boton boton-secundario boton-ancho mb-16" type="button" id="escanear-cliente">Escanear código del cliente</button>
    <form id="formulario-cargar-puntos" novalidate>
      <div class="campo"><label for="cliente">Código Fintacc o email del cliente</label><input type="text" id="cliente" name="cliente" placeholder="Ej: 1A2B3C4D o cliente@mail.com" required></div>
      <div class="campo"><label for="local-puntos">Local</label><select id="local-puntos" name="local">${misLocales.map((l) => `<option value="${escapar(l.id)}">${escapar(l.name)}</option>`).join("")}</select></div>
      <div class="campo"><label for="monto-puntos">Monto de la compra ($)</label><input id="monto-puntos" name="monto" type="number" min="1000" step="1" inputmode="numeric" placeholder="Ej: 25000" required></div>
      <div class="campo"><label for="ticket">Número de ticket (opcional)</label><input type="text" id="ticket" name="ticket" placeholder="Ej: A-001-000123"></div>
      <p class="suave chico mb-8" id="vista-previa-puntos">El cliente va a sumar 0 puntos.</p>
      <p class="error" id="error-carga" role="alert"></p>
      <button class="boton boton-ancho" type="submit">Acreditar puntos</button>
    </form>`);
  const monto = fondo.querySelector("#monto-puntos");
  monto.addEventListener("input", () => {
    fondo.querySelector("#vista-previa-puntos").textContent =
      `El cliente va a sumar ${Math.floor((Number(monto.value) || 0) / PESOS_POR_PUNTO)} puntos.`;
  });
  fondo.querySelector("#escanear-cliente").addEventListener("click", () =>
    leerQR(fondo, (texto) => {
      fondo.querySelector("#cliente").value = texto.startsWith("FINTACC-CLIENTE:") ? texto.split(":")[1] : texto;
    })
  );
  fondo.querySelector("#formulario-cargar-puntos").addEventListener("submit", async (e) => {
    e.preventDefault();
    const datos = Object.fromEntries(new FormData(e.target));
    const error = fondo.querySelector("#error-carga");
    if (!datos.cliente.trim()) {
      error.textContent = "Ingresá el código o el email del cliente.";
      return;
    }
    if (!Number(datos.monto) || Number(datos.monto) < PESOS_POR_PUNTO) {
      error.textContent = `El monto mínimo es ${pesos(PESOS_POR_PUNTO)}.`;
      return;
    }
    const boton = e.target.querySelector("button[type=submit]");
    boton.disabled = true;
    boton.textContent = "Acreditando...";
    try {
      const r = await acreditarPuntos({
        cliente: datos.cliente.trim(),
        local: datos.local,
        monto: Number(datos.monto),
        ticket: datos.ticket
      });
      cerrarModal();
      avisar(`Listo: ${r.puntos} puntos para ${r.cliente} en ${r.local}.`, "exito");
      cargarActividadPuntos();
    } catch (err) {
      error.textContent = err.message;
      boton.disabled = false;
      boton.textContent = "Acreditar puntos";
    }
  });
}

/**
 * Muestra el QR de un cupón para usarlo en la caja.
 * @param {{ codigo: string, descuento: number }} cupon Cupón del usuario.
 */
function modalCupon(cupon) {
  abrirModal(`
    <h2>${pesos(cupon.descuento)} de descuento</h2>
    <p class="suave mt-6">Mostrá este código en la caja del comercio aliado.</p>
    <div class="qr" id="qr"></div>
    <p class="codigo">${cupon.codigo}</p>
    <button class="boton boton-ancho mt-20" data-cerrar>Listo</button>`);
  const contenedor = document.getElementById("qr");
  if (window.qrcode) {
    const qr = qrcode(0, "M");
    qr.addData(`CANJE:${cupon.codigo}:${cupon.descuento}`);
    qr.make();
    contenedor.innerHTML = qr.createSvgTag({ cellSize: 6, margin: 0, scalable: true });
    contenedor.querySelector("svg").setAttribute("style", "width:200px;height:200px");
  } else {
    contenedor.textContent = "No se pudo generar el QR. Usá el código de abajo.";
  }
}

/**
 * Formulario de la marca para validar un cupón con la cámara o a mano.
 */
function modalEscanearCanje() {
  const fondo = abrirModal(`
    <h2>Validar cupón</h2>
    <p class="suave bajada-modal">Escaneá el QR que muestra el usuario en su celular o ingresá el código manualmente.</p>
    
    <video id="camara-qr" class="camara-qr" playsinline hidden></video>
    <button class="boton boton-secundario boton-ancho mb-16" type="button" id="iniciar-escaneo">Abrir cámara</button>
    
    <form id="formulario-validar-canje">
      <div class="campo">
        <label for="codigo-cupon">Código del cupón</label>
        <input type="text" id="codigo-cupon" placeholder="Ej: A1B2C3D4" autocomplete="off" aria-describedby="error-cupon" required>
        <span class="error" id="error-cupon" role="alert"></span>
      </div>
      <button class="boton boton-ancho" type="submit">Validar y marcar como usado</button>
    </form>
  `);

  const campoCodigo = fondo.querySelector("#codigo-cupon");
  // El QR del cupón tiene el formato CANJE:CODIGO:DESCUENTO
  fondo.querySelector("#iniciar-escaneo").addEventListener("click", () =>
    leerQR(fondo, (texto) => {
      const [tipo, codigo] = texto.split(":");
      campoCodigo.value = tipo === "CANJE" && codigo ? codigo : texto;
    })
  );

  fondo.querySelector("#formulario-validar-canje").addEventListener("submit", async (e) => {
    e.preventDefault();
    const codigo = campoCodigo.value.trim().toUpperCase();
    if (!codigo) return;

    try {
      const r = await validarCupon(codigo);
      cerrarModal();
      avisar(`Cupón válido: ${pesos(r.descuento)} de descuento para ${r.cliente}.`, "exito");
      cargarActividadPuntos();
    } catch (err) {
      fondo.querySelector("#error-cupon").textContent = err.message;
    }
  });
}

/**
 * Formulario para publicar una review.
 * @param {string} id Id del local o producto.
 */
function modalReview(id) {
  ui.estrellas = 0;
  const fondo = abrirModal(`
    <h2>Escribir una review</h2>
    <form class="mt-14" id="formulario-review" novalidate>
      <div class="campo"><span class="etiqueta-campo">Tu puntuación</span>
        <div class="selector-estrellas" role="group" aria-label="Puntuación">${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-estrella="${n}" aria-label="${n} estrellas" aria-pressed="false">★</button>`).join("")}</div></div>
      <div class="campo"><label for="texto">Tu experiencia</label><textarea id="texto" rows="4" placeholder="¿Cómo te fue? ¿Te sentiste segura/o?" aria-describedby="error-review"></textarea><span class="error" id="error-review" role="alert"></span></div>
      <button class="boton boton-ancho" type="submit">Publicar review</button>
    </form>`);
  fondo.querySelectorAll("[data-estrella]").forEach((b) =>
    b.addEventListener("click", () => {
      ui.estrellas = Number(b.dataset.estrella);
      fondo
        .querySelectorAll("[data-estrella]")
        .forEach((x) => x.setAttribute("aria-pressed", Number(x.dataset.estrella) <= ui.estrellas));
    })
  );
  fondo.querySelector("#formulario-review").addEventListener("submit", async (e) => {
    e.preventDefault();
    const texto = fondo.querySelector("#texto").value.trim();
    if (!ui.estrellas || texto.length < 10) {
      fondo.querySelector("#error-review").textContent = "Elegí una puntuación y escribí al menos 10 caracteres.";
      return;
    }
    try {
      agregarReview(await publicarReview({ objetivo: id, estrellas: ui.estrellas, texto }));
      render();
      cerrarModal();
      avisar("Review publicada", "exito");
    } catch (error) {
      fondo.querySelector("#error-review").textContent = error.message;
    }
  });
}

/**
 * Formulario de solicitud de alta de un comercio aliado.
 */
function modalAltaComercio() {
  const fondo = abrirModal(
    `<h2>Sumá tu comercio</h2>
    <p class="suave bajada-modal">Dejanos tus datos para solicitar el alta en la red Fintacc.</p>
    <form id="formulario-comercio">
      <div class="campo"><label for="comercio-nombre">Nombre del comercio</label><input type="text" id="comercio-nombre" name="nombre" required></div>
      <div class="campo"><label for="comercio-email">Email de contacto</label><input id="comercio-email" name="email" type="email" autocomplete="email" required></div>
      <div class="campo">
        <label for="comercio-tipo">Tipo de comercio</label>
        <select id="comercio-tipo" name="tipo" required>
          <option value="">Elegí una opción</option>
          <option>Dietética</option>
          <option>Restaurante</option>
          <option>Panadería</option>
          <option>Café</option>
          <option>Otro</option>
        </select>
      </div>
      <div class="campo"><label for="comercio-direccion">Dirección</label><input type="text" id="comercio-direccion" name="direccion" autocomplete="street-address" required></div>
      <p class="error" id="error-comercio" role="alert"></p>
      <button class="boton boton-ancho" type="submit">Enviar solicitud</button>
    </form>`
  );
  fondo.querySelector("#formulario-comercio").addEventListener("submit", async (e) => {
    e.preventDefault();
    const datos = Object.fromEntries(new FormData(e.target));
    try {
      await solicitarAltaComercio(datos);
      cerrarModal();
      avisar("Solicitud enviada. Vamos a revisar los datos del comercio.", "exito");
    } catch (error) {
      fondo.querySelector("#error-comercio").textContent = error.message;
    }
  });
}

/**
 * Vista previa de un módulo de la página de bienvenida con tres ejemplos reales del catálogo.
 * @param {"locales"|"recetas"|"productos"|"comunidad"|"puntos"} modulo Módulo elegido.
 */
function modalVistaPreviaModulo(modulo) {
  const locales = db.locales;
  const recetas = db.recetas.map(normalizarReceta);
  const productos = db.productos;

  const modulos = {
    locales: {
      titulo: "Locales sin TACC",
      bajada: "Restaurantes, cafés y dietéticas con protocolo sin TACC y mapa por cercanía.",
      items: locales.slice(0, 3).map((l) => ({
        titulo: l.name || l.nombre,
        meta: `${l.type || l.tipo || "Local"} · ${l.address || l.direccion || l.barrio || ""}`,
        badge: esVerificado(l) ? "Verificado" : "Sin TACC"
      }))
    },
    recetas: {
      titulo: "Recetas paso a paso",
      bajada: "Ideas sin TACC organizadas por momento del día, con tiempos e información nutricional.",
      items: recetas.slice(0, 3).map((r) => ({
        titulo: r.nombre,
        meta: `${r.momento} · ${r.minutos} min · ${r.porciones} porciones`,
        badge: r.nutricion ? `${r.nutricion.calorias} kcal` : "Sin TACC"
      }))
    },
    productos: {
      titulo: "Productos y precios",
      bajada: "Compará productos aptos por categoría y descubrí en qué locales conseguirlos.",
      items: productos.slice(0, 3).map((p) => ({
        titulo: p.name || p.nombre,
        meta: `${p.brand || p.marca || "Sin marca"} · ${p.category || p.categoria || "Almacén"}`,
        badge: pesos(p.price || p.precio || 0)
      }))
    },
    comunidad: {
      titulo: "Reseñas de la comunidad",
      bajada: "Experiencias reales de otras personas celíacas sobre atención, menú y contaminación cruzada.",
      items: estado.reviews.slice(0, 3).map((review) => ({
        titulo: `${review.autor} · ${"★".repeat(review.estrellas)}`,
        meta: review.texto,
        badge: "Comunidad"
      }))
    },
    puntos: {
      titulo: "Puntos y descuentos",
      bajada: "Sumás 1 punto cada $1.000 en comercios aliados y canjeás cupones con código QR.",
      items: CANJES.map((c) => ({
        titulo: `Cupón de ${pesos(c.descuento)} de descuento`,
        meta: `Canje directo mostrando tu QR en caja`,
        badge: `${c.puntos} pts`
      }))
    }
  };

  const contenido = modulos[modulo] || modulos.locales;
  if (!contenido.items.length)
    contenido.items = [
      { titulo: "Muy pronto", meta: "Todavía no hay contenido publicado en esta sección.", badge: "Sin TACC" }
    ];
  abrirModal(`
    <h2>${escapar(contenido.titulo)}</h2>
    <p class="suave mt-6">${escapar(contenido.bajada)}</p>
    <div class="vista-previa-lista">
      ${contenido.items
        .map(
          (elemento) => `
        <div class="vista-previa-elemento">
          <div><strong>${escapar(elemento.titulo)}</strong><span>${escapar(elemento.meta)}</span></div>
          <span class="etiqueta">${escapar(elemento.badge)}</span>
        </div>`
        )
        .join("")}
    </div>
    <div class="fila-botones">
      <button class="boton crecer" data-accion="ir-registro">Crear cuenta gratis</button>
      <button class="boton boton-secundario" data-cerrar>Cerrar</button>
    </div>
  `);
}
