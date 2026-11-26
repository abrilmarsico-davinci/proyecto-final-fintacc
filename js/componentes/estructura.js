/* =========================================================
   Estructura compartida
   Barras de navegación, pie, estructuraPagina y piezas comunes de las pantallas.
   ========================================================= */

/** Secciones del menú principal: [id, texto, href]. */
const SECCIONES = [
  ["inicio", "Inicio", "#/"],
  ["recetas", "Recetas", "#/recetas"],
  ["productos", "Productos", "#/productos"],
  ["locales", "Locales", "#/locales"],
  ["puntos", "Puntos", "#/puntos"]
];

/**
 * Ícono del botón de menú: hamburguesa o cruz según si el menú está abierto.
 * @returns {string} SVG del ícono.
 */
const iconoMenu = () =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">${ui.menuAbierto ? '<path d="M6 6l12 12M18 6L6 18"/>' : '<path d="M4 8h16M4 16h16"/>'}</svg>`;

/**
 * Secciones visibles según el rol. Las marcas no ven recetas.
 * @returns {Array<[string, string, string]>}
 */
const seccionesDelMenu = () => SECCIONES.filter(([id]) => !(id === "recetas" && estado.usuario.rol === ROLES.marca));

/**
 * Barra superior con logo, navegación, puntos y acceso al perfil.
 * @param {string} actual Id de la sección actual, para marcarla con aria-current.
 * @returns {string} HTML del header.
 */
function barraSuperior(actual) {
  const inicial = estado.usuario.nombre.charAt(0).toUpperCase();
  const esAdministracionOMarca = estado.usuario.rol === ROLES.administracion || estado.usuario.rol === ROLES.marca;
  const seccionesVisibles = seccionesDelMenu();

  return `
    <header class="barra-superior">
      <div class="barra-vidrio">
        <a class="enlace-logo" href="#/" aria-label="${MARCA.nombre}, ir al inicio"><img class="imagotipo" src="${MARCA.logo}" alt="Fintacc"></a>

        <nav class="menu solo-escritorio" aria-label="Navegación principal">
          ${seccionesVisibles.map(([id, texto, href]) => `<a href="${href}" ${actual === id ? 'aria-current="page"' : ""}>${texto}</a>`).join("")}
          ${esAdministracionOMarca ? `<a href="#/backoffice" ${actual === "backoffice" ? 'aria-current="page"' : ""} class="enlace-backoffice">Backoffice</a>` : ""}
          <a href="#/perfil" ${actual === "perfil" ? 'aria-current="page"' : ""}>Mi perfil</a>
        </nav>

        <div class="acciones-usuario">
          ${estado.usuario.rol !== ROLES.marca ? `<a class="insignia-puntos" href="#/puntos">${estado.puntos} pts</a>` : ""}
          <a class="avatar" href="#/perfil" aria-label="Mi perfil">${escapar(inicial)}</a>
        </div>
      </div>
    </header>`;
}

/**
 * Navegación inferior para celulares.
 * @param {string} actual Id de la sección actual.
 * @returns {string} HTML del nav.
 */
function navInferior(actual) {
  const seccionesVisibles = seccionesDelMenu();

  const iconosMenu = { inicio: "sol", recetas: "libro", productos: "bolsa", locales: "marcador", puntos: "estrella" };

  return `
    <nav class="nav-inferior solo-movil" aria-label="Navegación principal">
      ${seccionesVisibles
        .map(
          ([id, texto, href]) => `
        <a href="${href}" ${actual === id ? 'aria-current="page"' : ""}>
          ${icono(iconosMenu[id] || "cubiertos")}
          <span>${texto}</span>
        </a>
      `
        )
        .join("")}
    </nav>
  `;
}

/**
 * Pie de página. Sin sesión muestra los enlaces de la página de bienvenida.
 * @returns {string} HTML del footer.
 */
function pie() {
  const enlacesPie = estado.usuario
    ? `<a href="#/">Inicio</a><a href="#/locales">Locales</a><a href="#/productos">Productos</a><a href="#/recetas">Recetas</a><a href="#/puntos">Puntos</a>`
    : `<a href="#como-funciona" data-ancla>Cómo funciona</a><a href="#modulos" data-ancla>Qué encontrás</a><a href="#verificacion" data-ancla>Verificación</a><a href="#comercios" data-ancla>Para comercios</a><button type="button" data-accion="ir-ingreso">Ingresar</button><button type="button" data-accion="ir-registro">Crear cuenta</button>`;
  return `<footer class="pie"><div class="contenedor">
    <div class="pie-principal"><img class="logo-pie" src="${MARCA.logo}" alt="${MARCA.nombre}"><p class="lema">Comé seguro,<br>sin vueltas.</p></div>
    <nav class="pie-nav" aria-label="Navegación del pie">${enlacesPie}</nav>
    <div class="datos-pie"><span>${MARCA.nombre} · Plataforma sin TACC</span><span>Proyecto final · Diseño y Programación Web · 2026</span><span>Abril Marsico y Candela Cusinier</span></div>
  </div></footer>`;
}

/**
 * Estructura común de las pantallas con sesión: header, main, navegación móvil y footer.
 * @param {string} actual Id de la sección actual.
 * @param {string} contenido HTML del contenido principal.
 * @returns {string} HTML de la pantalla completa.
 */
function estructuraPagina(actual, contenido) {
  return `
    ${barraSuperior(actual)}
    <main class="contenedor pagina" id="contenido" tabindex="-1">${contenido}</main>
    ${navInferior(actual)}
    ${pie()}
  `;
}

/**
 * Enlace para volver a una sección.
 * @param {string} href Destino.
 * @param {string} [texto="Volver"] Texto del enlace.
 * @returns {string} HTML del enlace.
 */
function volver(href, texto = "Volver") {
  return `<a class="volver" href="${href}">← ${texto}</a>`;
}

/**
 * Mensaje para listados sin resultados.
 * @param {string} titulo Título del mensaje.
 * @param {string} texto Sugerencia para el usuario.
 * @returns {string} HTML del mensaje.
 */
const vacio = (titulo, texto) => `<div class="vacio"><strong>${titulo}</strong>${texto}</div>`;

/**
 * Barra superior de la página de bienvenida y del acceso, con menú desplegable en celular.
 * @returns {string} HTML del header.
 */
function barraPublica() {
  return `<header class="barra-superior barra-superior-publica"><div class="barra-vidrio">
    <a class="enlace-logo" href="#/" data-accion="ir-bienvenida" aria-label="${MARCA.nombre}, ir al inicio"><img class="imagotipo" src="${MARCA.logo}" alt="Fintacc"></a>
    <nav class="menu ${ui.menuAbierto ? "abierto" : ""}" id="menu" aria-label="Secciones">
      <a href="#como-funciona" data-ancla>Cómo funciona</a><a href="#modulos" data-ancla>Qué encontrás</a><a href="#comercios" data-ancla>Para comercios</a>
      <a class="solo-movil" href="#" data-accion="ir-ingreso">Ingresar</a><a class="solo-movil" href="#" data-accion="ir-registro">Crear cuenta</a>
    </nav>
    <div class="acciones-usuario">
      <button class="boton boton-secundario boton-chico" data-accion="ir-ingreso">Ingresar</button>
      <button class="boton boton-tinta boton-chico" data-accion="ir-registro">Crear cuenta</button>
      <button class="boton-menu" data-accion="menu" aria-expanded="${!!ui.menuAbierto}" aria-controls="menu" aria-label="Abrir menú">${iconoMenu()}</button>
    </div>
  </div></header>`;
}

/**
 * Buscador con chips de filtro.
 * @param {string} placeholder Texto de ayuda y nombre accesible del buscador.
 * @param {string[]} opciones Valores de los chips.
 * @param {string} actual Opción seleccionada.
 * @param {string} accion Valor de data-accion de los chips.
 * @returns {string} HTML de la barra.
 */
function barraFiltros(placeholder, opciones, actual, accion) {
  return `<div class="barra-filtros">
    <input class="buscador" type="search" placeholder="${placeholder}" aria-label="${placeholder}" data-busqueda value="${escapar(ui.busqueda)}">
    <div class="chips" role="group" aria-label="Filtros">${opciones.map((o) => `<button class="chip" data-accion="${accion}" data-valor="${o}" aria-pressed="${actual === o}">${o}</button>`).join("")}</div>
  </div>`;
}
