/* =========================================================
   Router y arranque
   El hash de la URL (#/recetas, #/local/:id) decide qué pantalla se dibuja.
   ========================================================= */

/** Secciones que necesitan el catálogo actualizado al entrar. */
const SECCIONES_CON_CATALOGO = ["", "productos", "producto", "locales", "local", "recetas", "receta", "marca-publica"];

/**
 * Lee la sección y el id del hash actual.
 * @returns {{ seccion: string, id: ?string }}
 */
function rutaActual() {
  const [, seccion = "", id = null] = location.hash.replace(/^#/, "").split("/");
  return { seccion, id };
}

/**
 * Dibuja la pantalla que corresponde al hash y carga los datos que se piden después de dibujar.
 * Sin sesión muestra la página de bienvenida o el formulario de acceso.
 */
function render() {
  if (!estado.usuario) {
    app.innerHTML = ui.vistaPublica === "bienvenida" ? pantallaBienvenida() : pantallaAcceso();
    return;
  }
  const { seccion, id } = rutaActual();
  const rutas = {
    "": pantallaInicio,
    recetas: pantallaRecetas,
    receta: () => pantallaReceta(id),
    productos: pantallaProductos,
    producto: () => pantallaProducto(id),
    locales: pantallaLocales,
    local: () => pantallaLocal(id),
    puntos: pantallaPuntos,
    perfil: pantallaPerfil,
    backoffice: pantallaBackoffice,
    "marca-publica": () => pantallaMarcaPublica(id)
  };
  app.innerHTML = (rutas[seccion] || pantallaNoEncontrada)();

  if (seccion === "productos") prepararListadoProductos();
  else observadorProductos?.disconnect();
  iniciarMapa();
  if (seccion === "puntos" && esGestorPuntos()) cargarActividadPuntos();
  if (seccion === "perfil" && estado.usuario.rol === ROLES.marca && ui.pestanaPerfil === "publico")
    cargarEditorPublico();
  if (seccion === "backoffice") cargarTablaBackoffice(ui.pestanaBackoffice || "productos", estado.usuario.rol);
}

/**
 * Indica si la pantalla visible muestra reviews (bienvenida, local o producto).
 * @returns {boolean}
 */
function pantallaMuestraReviews() {
  if (!estado.usuario) return ui.vistaPublica === "bienvenida";
  return ["local", "producto"].includes(rutaActual().seccion);
}

/**
 * Agrega una review recibida por Realtime y redibuja si la pantalla la muestra.
 * @param {Object} fila Fila insertada en la tabla reviews.
 */
function recibirReview(fila) {
  if (agregarReview(fila) && pantallaMuestraReviews()) render();
}

/** Sección mostrada antes del último cambio de hash, para reiniciar búsqueda y paginado al cambiar. */
let seccionAnterior = null;

window.addEventListener("hashchange", async () => {
  const { seccion } = rutaActual();
  if (seccion !== seccionAnterior) {
    ui.busqueda = "";
    ui.localesVisibles = LOCALES_POR_PAGINA;
    listadoProductos.clave = null;
    seccionAnterior = seccion;
  }
  ui.menuAbierto = false;
  cerrarModal();

  if (seccion === "puntos") await refrescarPuntos();
  if (SECCIONES_CON_CATALOGO.includes(seccion)) await prepararVista();

  render();
  window.scrollTo(0, 0);
  document.getElementById("contenido")?.focus({ preventScroll: true });
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") cerrarModal();
});

// El enlace para saltar al contenido mueve el foco sin cambiar el hash, que usa el router
document.querySelector(".saltar-contenido")?.addEventListener("click", (e) => {
  e.preventDefault();
  document.getElementById("contenido")?.focus();
});

/**
 * Arranca la aplicación: descarga el catálogo y las reviews, dibuja la página de bienvenida,
 * recupera la sesión guardada y se suscribe a las reviews nuevas.
 * @returns {Promise<void>}
 */
async function iniciarAplicacion() {
  if (hayConexion()) {
    await Promise.all([prepararVista(), cargarReviews()]);
    suscribirReviews(recibirReview);
  }
  render();
  hidratarCuenta();
}

iniciarAplicacion();
