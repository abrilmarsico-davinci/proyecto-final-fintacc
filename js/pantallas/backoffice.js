/* =========================================================
   Backoffice
   Alta, edición y baja de productos, locales, categorías y recetas.
   ========================================================= */

/** Nombre en singular de cada sección del backoffice. */
const NOMBRES_SINGULARES = { productos: "producto", locales: "local", categorias: "categoría", recetas: "receta" };

/**
 * Backoffice para administración y marcas, con pestañas por tipo de registro.
 * @returns {string} HTML de la pantalla.
 */
function pantallaBackoffice() {
  const rol = estado.usuario.rol;
  if (rol !== ROLES.administracion && rol !== ROLES.marca) return pantallaNoEncontrada();

  const pestana = ui.pestanaBackoffice || "productos";

  return estructuraPagina(
    "backoffice",
    `
    <div class="cabecera-pagina">
      <h1>Backoffice</h1>
      ${
        rol === ROLES.administracion
          ? '<span class="etiqueta etiqueta-marron">Administración</span>'
          : '<button class="etiqueta etiqueta-marron" data-accion="ir-perfil-publico">Ver mi perfil público</button>'
      }
    </div>

    <div class="selector-vista selector-pestanas selector-pestanas-ancho" role="group" aria-label="Secciones del backoffice">
      <button data-accion="backoffice-pestana" data-valor="productos" aria-pressed="${pestana === "productos"}">Productos</button>
      <button data-accion="backoffice-pestana" data-valor="locales" aria-pressed="${pestana === "locales"}">Locales</button>
      <button data-accion="backoffice-pestana" data-valor="categorias" aria-pressed="${pestana === "categorias"}">Categorías</button>
      ${rol === ROLES.administracion ? `<button data-accion="backoffice-pestana" data-valor="recetas" aria-pressed="${pestana === "recetas"}">Recetas</button>` : ""}
    </div>

    <section class="caja caja-backoffice">
      <div class="cabecera-backoffice">
        <h2 class="capitalizar">Gestión de ${pestana}</h2>
        <button class="boton boton-chico" data-accion="backoffice-nuevo" data-tipo="${pestana}">+ Nuevo ${NOMBRES_SINGULARES[pestana]}</button>
      </div>
      <div id="backoffice-registros" class="lista">
        <p class="suave">Cargando datos...</p>
      </div>
    </section>
  `
  );
}

/**
 * Carga los registros de la pestaña activa en #backoffice-registros.
 * @param {keyof TABLAS_DB} tab Pestaña activa.
 * @param {string} role Rol de la cuenta.
 * @returns {Promise<void>}
 */
async function cargarTablaBackoffice(pestana, rol) {
  const contenedor = document.getElementById("backoffice-registros");
  if (!contenedor) return;

  try {
    const registros = await listarRegistros(pestana, rol);

    if (!registros.length) {
      contenedor.innerHTML = `<p class="suave">No hay ${pestana} cargados todavía.</p>`;
      return;
    }

    contenedor.innerHTML = registros
      .map((registro) => {
        const titulo = registro.name || registro.nombre || registro.title;
        let subtitulo = "";

        if (pestana === "productos")
          subtitulo = `${pesos(registro.price || registro.precio || 0)} · ${registro.category || registro.categoria || "Sin categoría"}`;
        if (pestana === "locales")
          subtitulo = `${registro.address || registro.direccion || ""} · ${registro.status || "active"}`;
        if (pestana === "recetas") {
          const r = normalizarReceta(registro);
          subtitulo = `${r.momento} · ${r.minutos} min · ${r.idsProductos.length} producto(s)`;
        }

        return `
        <div class="movimiento fila-backoffice">
          <span class="crecer">
            <strong>${escapar(titulo)}</strong><br>
            <span class="suave chico">${escapar(subtitulo)}</span>
          </span>
          <div class="acciones-fila">
            <button class="boton boton-chico boton-editar" data-accion="backoffice-editar" data-tipo="${pestana}" data-id="${escapar(registro.id)}" aria-label="Editar ${escapar(titulo)}">${icono("lapiz")}</button>
            <button class="boton boton-chico boton-eliminar" data-accion="backoffice-borrar" data-tipo="${pestana}" data-id="${escapar(registro.id)}" aria-label="Eliminar ${escapar(titulo)}">${icono("basura")}</button>
          </div>
        </div>
      `;
      })
      .join("");
  } catch (e) {
    contenedor.innerHTML = `<p class="error">Error al cargar: ${escapar(e.message)}</p>`;
  }
}

/**
 * Formulario de alta o edición de un producto, local, categoría o receta, con subida de fotos.
 * @param {keyof TABLAS_DB} tipo Tipo de registro.
 * @param {?string} [id=null] Id del registro a editar; sin id crea uno nuevo.
 * @returns {Promise<void>}
 */
async function modalFormularioBackoffice(tipo, id = null) {
  const esEdicion = !!id;
  const registro = (esEdicion && (await obtenerRegistro(tipo, id))) || {};

  let camposHTML = "";
  let productosReceta = [];

  if (tipo === "productos") {
    const categoriasExistentes = await obtenerNombresCategorias().catch(() => []);
    const categoriasSeleccionadas = (registro.category || "").split(",").map((s) => s.trim());

    camposHTML = `
      <div class="campo"><label for="backoffice-nombre">Nombre del producto</label><input type="text" id="backoffice-nombre" name="nombre" value="${escapar(registro.name || "")}" required></div>
      <div class="campo"><label for="backoffice-marca">Marca del producto</label><input type="text" id="backoffice-marca" name="marca" value="${escapar(registro.brand || (estado.usuario.rol === ROLES.marca ? estado.usuario.nombreMarca || "" : ""))}" placeholder="Ej: Sintaxis, Doña Pacha" required></div>

      <div class="campo">
        <label for="buscador-categorias">Categorías</label>
        <input type="search" class="buscador-lista" id="buscador-categorias" placeholder="Buscar categoría...">
        <div class="lista-checkboxes" id="lista-checkboxes-categorias">
          ${categoriasExistentes
            .map(
              (c) => `
            <label data-nombre="${escapar(c.toLowerCase())}">
              <input type="checkbox" name="categorias" value="${escapar(c)}" ${categoriasSeleccionadas.includes(c) ? "checked" : ""}>
              ${escapar(c)}
            </label>
          `
            )
            .join("")}
          ${!categoriasExistentes.length ? '<p class="suave chico p-8">No hay categorías creadas.</p>' : ""}
        </div>
      </div>

      <div class="campo">
        <span class="etiqueta-campo">Fotos del producto (múltiples)</span>
        <label class="zona-archivo" for="campo-imagenes">
          <span class="texto-acento chico">Hacé clic para subir fotos</span>
          <span class="ayuda-archivo">Formatos JPG o PNG (podés elegir varias). La primera es la principal.</span>
        </label>
        <input type="file" id="campo-imagenes" class="visualmente-oculto" accept="image/*" multiple>
        <div class="fila-chips" id="vista-previa-imagenes">
          ${(comoArray(registro.images).length ? comoArray(registro.images) : registro.image_url ? [registro.image_url] : []).map((img) => `<img class="miniatura" src="${urlSegura(img)}" alt="">`).join("")}
        </div>
      </div>

      <div class="campo">
        <label for="backoffice-precio">Precio</label>
        <div class="campo-precio">
          <span aria-hidden="true">$</span>
          <input id="backoffice-precio" name="precio" type="text" value="${registro.price || ""}" inputmode="decimal" placeholder="Ej: 1.500,50" required>
        </div>
      </div>
    `;
  } else if (tipo === "locales") {
    camposHTML = `
      <div class="campo"><label for="backoffice-nombre">Nombre del local</label><input type="text" id="backoffice-nombre" name="nombre" value="${escapar(registro.name || "")}" required></div>
      <div class="campo"><label for="backoffice-direccion">Dirección</label><input type="text" id="backoffice-direccion" name="direccion" value="${escapar(registro.address || "")}" required></div>
      
      <div class="campo">
        <label for="backoffice-tipo">Tipo de local</label>
        <select id="backoffice-tipo" name="tipo" required>
          <option value="">Elegí una opción</option>
          <option ${registro.type === "Restaurante" ? "selected" : ""}>Restaurante</option>
          <option ${registro.type === "Dietética" ? "selected" : ""}>Dietética</option>
          <option ${registro.type === "Panadería" ? "selected" : ""}>Panadería</option>
          <option ${registro.type === "Café" ? "selected" : ""}>Café</option>
          <option ${registro.type === "Otro" ? "selected" : ""}>Otro</option>
        </select>
      </div>

      <div class="campo">
        <label for="backoffice-menu">Link del menú (opcional)</label>
        <input id="backoffice-menu" name="menu" type="url" value="${escapar(registro.menu_url || "")}" placeholder="Ej: https://misitio.com/menu.pdf">
      </div>

      <div class="campo">
        <span class="etiqueta-campo">Fotos del local (múltiples)</span>
        <label class="zona-archivo" for="campo-imagenes">
          <span class="texto-acento chico">Hacé clic para subir fotos</span>
          <span class="ayuda-archivo">Formatos JPG o PNG (podés elegir varias)</span>
        </label>
        <input type="file" id="campo-imagenes" class="visualmente-oculto" accept="image/*" multiple>
        <div class="fila-chips" id="vista-previa-imagenes">
          ${comoArray(registro.images)
            .map((img) => `<img class="miniatura" src="${urlSegura(img)}" alt="">`)
            .join("")}
        </div>
      </div>
    `;
  } else if (tipo === "categorias") {
    camposHTML = `<div class="campo"><label for="backoffice-nombre">Nombre de la categoría</label><input type="text" id="backoffice-nombre" name="nombre" value="${escapar(registro.name || "")}" required></div>`;
  } else if (tipo === "recetas") {
    const r = normalizarReceta(registro);
    const productosDisponibles = await obtenerProductosParaReceta().catch(() => []);
    const momentos = ["Desayuno", "Almuerzo", "Merienda", "Cena"];
    camposHTML = `
      <div class="campo"><label for="backoffice-nombre">Título de la receta</label><input type="text" id="backoffice-nombre" name="nombre" value="${escapar(r.nombre)}" required></div>
      <div class="campo"><label for="backoffice-momento">Momento del día</label><select id="backoffice-momento" name="momento">${momentos.map((m) => `<option ${r.momento === m ? "selected" : ""}>${m}</option>`).join("")}</select></div>
      <div class="campo"><label for="backoffice-minutos">Minutos</label><input id="backoffice-minutos" name="minutos" type="number" min="1" value="${esEdicion ? r.minutos : ""}" required></div>
      <div class="campo"><label for="backoffice-porciones">Porciones</label><input id="backoffice-porciones" name="porciones" type="number" min="1" value="${esEdicion ? r.porciones : ""}" required></div>
      <div class="campo"><label for="backoffice-ingredientes">Ingredientes (uno por línea)</label><textarea id="backoffice-ingredientes" name="ingredientes" rows="5" placeholder="Ej: 250 g de premezcla para chipá">${escapar(r.ingredientes.join("\n"))}</textarea></div>
      <div class="campo"><label for="backoffice-pasos">Paso a paso (un paso por línea)</label><textarea id="backoffice-pasos" name="pasos" rows="6" placeholder="Ej: Precalentá el horno a 200 °C.">${escapar(r.pasos.join("\n"))}</textarea></div>

      <div class="campo">
        <label for="buscador-productos-receta">Productos de la receta</label>
        <input type="search" class="buscador-lista" id="buscador-productos-receta" placeholder="Buscar producto...">
        <div class="lista-checkboxes" id="lista-productos-receta">
          ${productosDisponibles
            .map(
              (pr) => `
            <label data-nombre="${escapar((pr.name + " " + (pr.brand || "")).toLowerCase())}">
              <input type="checkbox" name="productos" value="${escapar(pr.id)}" ${r.idsProductos.includes(String(pr.id)) ? "checked" : ""}>
              ${escapar(pr.name)}${pr.brand ? ` · ${escapar(pr.brand)}` : ""}
            </label>`
            )
            .join("")}
          ${!productosDisponibles.length ? '<p class="suave chico p-8">No hay productos cargados.</p>' : ""}
        </div>
      </div>

      <div class="campo">
        <span class="etiqueta-campo">Fotos de la receta (múltiples)</span>
        <label class="zona-archivo" for="campo-imagenes">
          <span class="texto-acento chico">Hacé clic para subir fotos</span>
          <span class="ayuda-archivo">Formatos JPG o PNG (podés elegir varias). La primera es la principal.</span>
        </label>
        <input type="file" id="campo-imagenes" class="visualmente-oculto" accept="image/*" multiple>
        <div class="fila-chips" id="vista-previa-imagenes">
          ${(comoArray(registro.images).length ? comoArray(registro.images) : registro.image_url ? [registro.image_url] : []).map((img) => `<img class="miniatura" src="${urlSegura(img)}" alt="">`).join("")}
        </div>
      </div>
    `;
    productosReceta = productosDisponibles;
  }

  const fondo = abrirModal(`
    <h2>${esEdicion ? "Editar" : "Nuevo"} ${NOMBRES_SINGULARES[tipo]}</h2>
    <form class="mt-16" id="formulario-backoffice">
      ${camposHTML}
      <button class="boton boton-ancho mt-20" type="submit">Guardar</button>
    </form>
  `);

  // Fotos del producto, local o receta (la primera es la principal)
  let imagenesLocales = comoArray(registro.images).length
    ? comoArray(registro.images)
    : registro.image_url
      ? [registro.image_url]
      : [];

  const campoImagenes = fondo.querySelector("#campo-imagenes");

  if (campoImagenes) {
    campoImagenes.addEventListener("change", async (e) => {
      const archivos = Array.from(e.target.files);
      if (!archivos.length) return;

      // Las fotos nuevas se previsualizan con FileReader mientras se suben
      const cajaVistaPrevia = fondo.querySelector("#vista-previa-imagenes");
      const previas = await Promise.all(archivos.map((archivo) => leerImagen(archivo).catch(() => "")));
      previas.filter(Boolean).forEach((url) => {
        const miniatura = document.createElement("img");
        miniatura.className = "miniatura subiendo";
        miniatura.alt = "";
        miniatura.src = url;
        cajaVistaPrevia.appendChild(miniatura);
      });
      const botonGuardar = fondo.querySelector("#formulario-backoffice button[type='submit']");
      if (botonGuardar) {
        botonGuardar.disabled = true;
        botonGuardar.textContent = "Subiendo fotos...";
      }

      const urlsNuevas = [];
      const errores = [];

      for (const archivo of archivos) {
        try {
          urlsNuevas.push(await subirImagen(archivo));
        } catch (error) {
          errores.push(error.message);
        }
      }
      if (errores.length) avisar(`No se pudo subir ${errores.length} foto(s): ${errores[0]}`, "error");
      if (botonGuardar) {
        botonGuardar.disabled = false;
        botonGuardar.textContent = "Guardar";
      }
      e.target.value = "";

      imagenesLocales = [...imagenesLocales, ...urlsNuevas];
      cajaVistaPrevia.innerHTML = imagenesLocales
        .map((img) => `<img class="miniatura" src="${urlSegura(img)}" alt="">`)
        .join("");
    });
  }

  // Buscador de productos de la receta
  const buscadorProductos = fondo.querySelector("#buscador-productos-receta");
  if (buscadorProductos) {
    const etiquetasProducto = Array.from(fondo.querySelectorAll("#lista-productos-receta label"));
    buscadorProductos.addEventListener("input", (ev) => {
      const t = ev.target.value.toLowerCase();
      etiquetasProducto.forEach((l) => {
        l.hidden = !l.dataset.nombre.includes(t);
      });
    });
  }

  // Buscador de categorías: sin búsqueda muestra las primeras 5
  const buscadorCategorias = fondo.querySelector("#buscador-categorias");
  const etiquetasCategoria = Array.from(fondo.querySelectorAll("#lista-checkboxes-categorias label"));

  const filtrarCategorias = (termino) => {
    let mostradas = 0;
    etiquetasCategoria.forEach((label) => {
      const coincide = label.dataset.nombre.includes(termino.toLowerCase());
      const visible = coincide && (termino !== "" || mostradas < 5);
      label.hidden = !visible;
      if (visible && termino === "") mostradas++;
    });
  };
  if (buscadorCategorias) {
    filtrarCategorias("");
    buscadorCategorias.addEventListener("input", (e) => filtrarCategorias(e.target.value));
  }

  // Formato del precio mientras se escribe
  const campoPrecio = fondo.querySelector("input[name='precio']");
  if (campoPrecio) {
    campoPrecio.addEventListener("input", (e) => {
      let digitos = e.target.value.replace(/\D/g, "");
      if (!digitos) {
        e.target.value = "";
        return;
      }
      if (e.target.value.includes(",")) {
        const partes = e.target.value.split(",");
        const entero = partes[0].replace(/\D/g, "");
        const decimal = partes[1] ? partes[1].replace(/\D/g, "").slice(0, 2) : "";
        e.target.value = `${Number(entero || 0).toLocaleString("es-AR")},${decimal}`;
      } else {
        e.target.value = Number(digitos).toLocaleString("es-AR");
      }
    });
  }

  // Guardar
  fondo.querySelector("#formulario-backoffice").addEventListener("submit", async (e) => {
    e.preventDefault();
    const datosFormulario = new FormData(e.target);

    const valores = {};

    if (tipo === "productos") {
      const categoriasMarcadas = datosFormulario.getAll("categorias");
      let textoPrecio = datosFormulario.get("precio") || "0";
      textoPrecio = textoPrecio.replace(/\./g, "").replace(",", ".");

      valores.name = datosFormulario.get("nombre");

      valores.brand =
        String(datosFormulario.get("marca") || "").trim() ||
        registro.brand ||
        estado.usuario.nombreMarca ||
        estado.usuario.nombre;

      valores.category = categoriasMarcadas.join(", ");
      valores.images = imagenesLocales;
      if (imagenesLocales.length > 0) valores.image_url = imagenesLocales[0];
      valores.price = parseFloat(textoPrecio) || 0;
    } else if (tipo === "locales") {
      valores.name = datosFormulario.get("nombre");
      valores.address = datosFormulario.get("direccion");
      valores.type = datosFormulario.get("tipo");
      valores.menu_url = datosFormulario.get("menu");
      valores.images = imagenesLocales;
      if (imagenesLocales.length > 0) valores.image_url = imagenesLocales[0];
    } else if (tipo === "categorias") {
      valores.name = datosFormulario.get("nombre");
    } else if (tipo === "recetas") {
      const lineas = (campo) =>
        String(datosFormulario.get(campo) || "")
          .split("\n")
          .map((x) => x.trim())
          .filter(Boolean);
      const idsProductos = datosFormulario.getAll("productos");
      const idsLocalesReceta = [
        ...new Set(
          productosReceta.filter((pr) => idsProductos.includes(String(pr.id))).flatMap((pr) => comoArray(pr.store_ids))
        )
      ];
      valores.name = datosFormulario.get("nombre");
      valores.moment = datosFormulario.get("momento");
      valores.minutes = Number(datosFormulario.get("minutos"));
      valores.servings = Number(datosFormulario.get("porciones"));
      valores.ingredients = lineas("ingredientes");
      valores.steps = lineas("pasos");
      valores.product_ids = idsProductos;
      valores.store_ids = idsLocalesReceta;
      valores.images = imagenesLocales;
      if (imagenesLocales.length > 0) valores.image_url = imagenesLocales[0];
      if (!esEdicion) valores.id = `receta-${Date.now()}`;
    }

    // Los locales nuevos necesitan id, token de QR y estado inicial
    if (!esEdicion) {
      if (tipo === "locales") {
        valores.id = `local-${Date.now()}`;
        valores.qr_token = `FINTACC-STORE-${Date.now()}`;
        valores.status = "active";
      }
    }

    // Solo se envían los campos con valor
    const datosAGuardar = Object.fromEntries(
      Object.entries(valores).filter(([, valor]) => valor != null && valor !== "")
    );

    try {
      await guardarRegistro(tipo, datosAGuardar, esEdicion ? id : null);

      cerrarModal();
      avisar("Guardado correctamente", "exito");
      cargarTablaBackoffice(tipo, estado.usuario.rol);
    } catch (err) {
      avisar("Error al guardar: " + err.message, "error");
    }
  });
}

/**
 * Pide confirmación y elimina un registro del backoffice.
 * @param {keyof TABLAS_DB} tipo Tipo de registro.
 * @param {string} id Id del registro.
 */
function modalConfirmarBorrar(tipo, id) {
  const fondo = abrirModal(`
    <h2>Confirmar eliminación</h2>
    <p class="suave texto-confirmacion">
      ¿Estás seguro que querés eliminar este ${NOMBRES_SINGULARES[tipo]}? Esta acción no se puede deshacer.
    </p>
    <div class="fila-botones">
      <button class="boton boton-secundario crecer" data-cerrar>Cancelar</button>
      <button class="boton boton-peligro crecer" id="boton-confirmar-eliminar">Eliminar</button>
    </div>
  `);

  fondo.querySelector("#boton-confirmar-eliminar").addEventListener("click", async () => {
    try {
      await eliminarRegistro(tipo, id);

      cerrarModal();
      avisar("Eliminado correctamente", "exito");
      cargarTablaBackoffice(tipo, estado.usuario.rol);
    } catch (err) {
      avisar("Error al eliminar: " + err.message, "error");
    }
  });
}
