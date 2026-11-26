/* =========================================================
   Eventos de la interfaz
   Delegación de eventos sobre #app: cada elemento interactivo
   indica su acción con el atributo data-accion.
   ========================================================= */

/**
 * Resuelve los clicks en anclas de la página de bienvenida y en elementos con data-accion.
 * Al terminar, las acciones que cambian el estado vuelven a dibujar la pantalla.
 * @param {MouseEvent} e Evento de click.
 * @returns {Promise<void>}
 */
async function manejarClick(e) {
  const ancla = e.target.closest("[data-ancla]");
  if (ancla) {
    e.preventDefault();
    ui.menuAbierto = false;
    if (ui.vistaPublica !== "bienvenida") {
      ui.vistaPublica = "bienvenida";
      render();
    }
    document.querySelector(ancla.getAttribute("href"))?.scrollIntoView({ behavior: "smooth" });
    document.getElementById("menu")?.classList.remove("abierto");
    return;
  }
  const elemento = e.target.closest("[data-accion]");
  if (!elemento) return;
  if (elemento.tagName === "A") e.preventDefault();
  const { accion, id, valor } = elemento.dataset;

  switch (accion) {
    case "menu":
      ui.menuAbierto = !ui.menuAbierto;
      break;
    case "ir-registro":
      cerrarModal();
      ui.vistaPublica = "registro";
      ui.borrador = {};
      ui.menuAbierto = false;
      window.scrollTo(0, 0);
      break;
    case "ir-ingreso":
      cerrarModal();
      ui.vistaPublica = "ingreso";
      ui.borrador = {};
      ui.menuAbierto = false;
      window.scrollTo(0, 0);
      break;
    case "ir-bienvenida":
      cerrarModal();
      ui.vistaPublica = "bienvenida";
      ui.menuAbierto = false;
      window.scrollTo(0, 0);
      break;
    case "vista-previa-modulo":
      modalVistaPreviaModulo(valor);
      return;
    case "aviso-comercios":
      modalAltaComercio();
      return;
    case "usar-ubicacion":
      pedirUbicacion();
      return;
    case "quitar-ubicacion":
      ui.ubicacion = null;
      ui.radioLocales = "Todos";
      ui.localesVisibles = LOCALES_POR_PAGINA;
      break;
    case "filtro-cercania":
      ui.radioLocales = valor;
      ui.localesVisibles = LOCALES_POR_PAGINA;
      if (!ui.ubicacion) {
        pedirUbicacion();
        return;
      }
      break;
    case "ver-mas-locales":
      ui.localesVisibles += LOCALES_POR_PAGINA;
      break;
    case "filtro-momento":
      ui.filtroMomento = valor;
      break;
    case "filtro-categoria":
      ui.categoria = valor;
      break;
    case "vista-locales":
      ui.vistaLocales = valor;
      break;
    case "ingrediente":
      elemento.closest("li").classList.toggle("tachado", elemento.checked);
      return;
    case "abrir-pasos": {
      const receta = (db.recetas || []).find((r) => String(r.id) === String(id));
      if (!receta) return;
      ui.paso = 0;
      modalPasos(normalizarReceta(receta));
      return;
    }
    case "mostrar-codigo":
      modalCodigoCliente();
      return;
    case "cargar-puntos":
      modalCargarPuntos();
      return;
    case "actualizar-actividad":
      cargarActividadPuntos();
      return;
    case "escanear-canje":
      modalEscanearCanje();
      return;
    case "abrir-review":
      modalReview(id);
      return;
    case "backoffice-pestana":
      ui.pestanaBackoffice = valor;
      render();
      break;
    case "ir-perfil-publico":
      ui.pestanaPerfil = "publico";
      location.hash = "#/perfil";
      break;
    case "elegir-dispositivo": {
      ui.dispositivoVistaPrevia = valor;
      const dispositivo = document.getElementById("vista-previa-dispositivo");
      if (dispositivo) {
        dispositivo.className = `vista-previa-dispositivo ${valor}`;
        document.querySelectorAll('[data-accion="elegir-dispositivo"]').forEach((boton) => {
          boton.setAttribute("aria-pressed", boton.dataset.valor === valor);
        });
      }
      return;
    }
    case "perfil-pestana":
      ui.pestanaPerfil = valor;
      render();
      break;
    case "ver-perfil-marca":
      location.hash = `#/marca-publica/${id}`;
      return;
    case "backoffice-nuevo":
      modalFormularioBackoffice(elemento.dataset.tipo);
      return;
    case "backoffice-editar":
      modalFormularioBackoffice(elemento.dataset.tipo, elemento.dataset.id);
      return;
    case "backoffice-borrar":
      modalConfirmarBorrar(elemento.dataset.tipo, elemento.dataset.id);
      return;
    case "canjear": {
      const canje = CANJES.find((c) => c.id === id);
      if (estado.puntos < canje.puntos) return;
      try {
        const cupon = normalizarCupon(await canjearPuntos(canje.puntos));
        await refrescarPuntos();
        render();
        modalCupon(cupon);
      } catch (error) {
        avisar(error.message, "error");
      }
      return;
    }
    case "ver-cupon":
      modalCupon(estado.cupones.find((c) => c.codigo === elemento.dataset.codigo));
      return;
    case "cerrar-sesion":
      try {
        await cerrarSesion();
      } catch (_) {
        /* la sesión local se limpia igual */
      }
      estado = estadoInicial();
      Object.assign(ui, { vistaPublica: "bienvenida", busqueda: "", categoria: "Todas", filtroMomento: "Todas" });
      await cargarReviews();
      location.hash = "";
      break;
    default:
      return;
  }
  render();
}

/**
 * Filtra el listado mientras se escribe en el buscador y conserva el foco y el cursor.
 * @param {InputEvent} e Evento de escritura.
 */
function manejarBusqueda(e) {
  if (!e.target.matches("[data-busqueda]")) return;
  ui.busqueda = e.target.value;
  ui.localesVisibles = LOCALES_POR_PAGINA;
  const posicion = e.target.selectionStart;
  render();
  const buscador = $("[data-busqueda]");
  buscador.focus();
  buscador.setSelectionRange(posicion, posicion);
}

/**
 * Valida y envía el formulario de registro o ingreso.
 * Los errores se guardan en ui.borrador para mostrarlos junto a cada campo.
 * @param {HTMLFormElement} formulario Formulario #formulario-cuenta.
 * @returns {Promise<void>}
 */
async function enviarFormularioCuenta(formulario) {
  const datos = Object.fromEntries(new FormData(formulario));
  const registro = ui.vistaPublica === "registro";
  const errores = {};
  if (registro && !datos.nombre.trim()) errores.nombre = "Ingresá tu nombre.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.email))
    errores.email = "Ingresá un email válido, por ejemplo nombre@mail.com.";
  if ((datos.clave || "").length < 8) errores.clave = "La contraseña debe tener al menos 8 caracteres.";
  ui.borrador = { ...ui.borrador, nombre: datos.nombre, email: datos.email, errores };
  if (Object.keys(errores).length) {
    render();
    app.querySelector('[aria-invalid="true"]')?.focus();
    return;
  }

  try {
    const credenciales = { email: datos.email, clave: datos.clave };
    const resultado = registro
      ? await registrarUsuario({ ...credenciales, nombre: datos.nombre.trim() })
      : await iniciarSesion(credenciales);
    if (resultado?.necesitaConfirmacion) {
      ui.borrador = {
        ...ui.borrador,
        errores: { general: "Te enviamos un email para confirmar la cuenta. Confirmalo y después ingresá." }
      };
      render();
      return;
    }
    await hidratarCuenta();
    location.hash = "#/";
    render();
    avisar(registro ? "Cuenta creada. Sumaste 50 puntos de bienvenida" : "Sesión iniciada", "exito");
  } catch (error) {
    ui.borrador = { ...ui.borrador, nombre: datos.nombre, email: datos.email, errores: { general: error.message } };
    render();
  }
}

/**
 * Guarda el nombre del perfil personal.
 * @param {HTMLFormElement} formulario Formulario #formulario-perfil-nombre.
 * @returns {Promise<void>}
 */
async function enviarFormularioNombre(formulario) {
  const campo = formulario.elements.nombre;
  const error = formulario.querySelector("#error-nombre-perfil");
  const nombre = campo.value.trim();
  if (!nombre) {
    error.textContent = "Ingresá tu nombre.";
    campo.setAttribute("aria-invalid", "true");
    campo.focus();
    return;
  }
  error.textContent = "";
  campo.removeAttribute("aria-invalid");
  const boton = formulario.querySelector("button[type=submit]");
  boton.disabled = true;
  try {
    await actualizarNombre(nombre);
    estado.usuario.nombre = nombre;
    render();
    avisar("Nombre actualizado", "exito");
  } catch (err) {
    error.textContent = err.message;
    boton.disabled = false;
  }
}

/**
 * Cambia la contraseña desde el perfil después de validar que coincida la confirmación.
 * @param {HTMLFormElement} formulario Formulario #formulario-perfil-clave.
 * @returns {Promise<void>}
 */
async function enviarFormularioClave(formulario) {
  const { clave, confirmacion } = formulario.elements;
  const error = formulario.querySelector("#error-clave-perfil");
  let mensaje = "";
  if (clave.value.length < 8) mensaje = "La contraseña debe tener al menos 8 caracteres.";
  else if (clave.value !== confirmacion.value) mensaje = "Las contraseñas no coinciden.";
  error.textContent = mensaje;
  if (mensaje) {
    clave.setAttribute("aria-invalid", "true");
    clave.focus();
    return;
  }
  clave.removeAttribute("aria-invalid");
  const boton = formulario.querySelector("button[type=submit]");
  boton.disabled = true;
  try {
    await cambiarClave(clave.value);
    formulario.reset();
    avisar("Contraseña actualizada", "exito");
  } catch (err) {
    error.textContent = err.message;
  } finally {
    boton.disabled = false;
  }
}

/** Formularios que se resuelven por delegación, según su id. */
const FORMULARIOS = {
  "formulario-cuenta": enviarFormularioCuenta,
  "formulario-perfil-nombre": enviarFormularioNombre,
  "formulario-perfil-clave": enviarFormularioClave
};

/**
 * Deriva el envío de cada formulario conocido a su función.
 * @param {SubmitEvent} e Evento de envío.
 */
function manejarEnvio(e) {
  const enviar = FORMULARIOS[e.target.id];
  if (!enviar) return;
  e.preventDefault();
  enviar(e.target);
}

app.addEventListener("click", manejarClick);
app.addEventListener("input", manejarBusqueda);
app.addEventListener("submit", manejarEnvio);
