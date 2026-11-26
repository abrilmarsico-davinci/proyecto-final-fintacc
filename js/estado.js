/* =========================================================
   Estado de la aplicación
   Sesión, catálogo descargado y estado de la interfaz.
   ========================================================= */

/**
 * Estado de la sesión del usuario.
 * @typedef {Object} EstadoSesion
 * @property {?{ id: string, nombre: string, email: string, rol: string, nombreMarca: ?string }} usuario Usuario autenticado o null.
 * @property {number} puntos Puntos disponibles.
 * @property {number} puntosGanados Puntos ganados en total.
 * @property {Array<{ detalle: string, puntos: number, fecha: string }>} historial Movimientos de puntos.
 * @property {Array<{ codigo: string, descuento: number, puntos: number, estado: string }>} cupones Cupones del usuario.
 * @property {Array<{ id: number, objetivo: string, autor: string, estrellas: number, texto: string }>} reviews Reviews de la comunidad.
 */

/**
 * Crea el estado de una sesión vacía.
 * @returns {EstadoSesion}
 */
const estadoInicial = () => ({
  usuario: null,
  puntos: 0,
  puntosGanados: 0,
  historial: [],
  cupones: [],
  reviews: []
});

/** @type {EstadoSesion} */
let estado = estadoInicial();

/**
 * Catálogo descargado de Supabase que usan las pantallas.
 * @type {Catalogo}
 */
let db = { productos: [], locales: [], recetas: [], categorias: [], perfiles: [], marcas: [] };

/** Estado de la interfaz: filtros, pestañas, pasos y menús abiertos. */
let ui = {
  menuAbierto: false,
  vistaPublica: "bienvenida",
  borrador: {},
  filtroMomento: "Todas",
  busqueda: "",
  vistaLocales: "lista",
  categoria: "Todas",
  paso: 0,
  estrellas: 0,
  pestanaBackoffice: "productos",
  pestanaPerfil: "personal",
  dispositivoVistaPrevia: "escritorio",
  ubicacion: null,
  radioLocales: "Todos",
  localesVisibles: 6
};

/** Cantidad de locales que se suman con "Ver más locales". */
const LOCALES_POR_PAGINA = 6;

/** Radios del filtro de cercanía, en km (null = sin límite). */
const RADIOS_LOCALES = { Todos: null, "A 1 km": 1, "A 3 km": 3, "A 5 km": 5 };

/**
 * Pasa un movimiento de la base al formato de la interfaz.
 * @param {{ detail: string, points: number, date: string }} movimiento Fila de la tabla movements.
 * @returns {{ detalle: string, puntos: number, fecha: string }}
 */
function normalizarMovimiento(movimiento) {
  return {
    detalle: movimiento.detail,
    puntos: movimiento.points,
    fecha: movimiento.date ? new Date(movimiento.date).toLocaleDateString("es-AR") : ""
  };
}

/**
 * Pasa un cupón de la base al formato de la interfaz.
 * @param {{ code: string, discount: number, points: number, status: string }} cupon Fila de la tabla coupons.
 * @returns {{ codigo: string, descuento: number, puntos: number, estado: string }}
 */
function normalizarCupon(cupon) {
  return {
    codigo: cupon.code,
    descuento: cupon.discount,
    puntos: cupon.points,
    estado: cupon.status || "active"
  };
}

/**
 * Pasa una review de la base al formato de la interfaz.
 * @param {{ id: number, target: string, author: string, stars: number, text: string }} review Fila de la tabla reviews.
 * @returns {{ id: number, objetivo: string, autor: string, estrellas: number, texto: string }}
 */
function normalizarReview(review) {
  return {
    id: review.id,
    objetivo: review.target,
    autor: review.author,
    estrellas: review.stars,
    texto: review.text
  };
}

/**
 * Agrega una review al principio de la lista si todavía no está.
 * Evita duplicados cuando la misma review llega por la respuesta del insert y por Realtime.
 * @param {Object} fila Fila de la tabla reviews.
 * @returns {boolean} true si la review era nueva.
 */
function agregarReview(fila) {
  if (estado.reviews.some((r) => r.id === fila.id)) return false;
  estado.reviews.unshift(normalizarReview(fila));
  return true;
}

/**
 * Código que el cliente muestra en la caja (mismo criterio que codigo_cliente() en la base).
 * @param {string} id UUID del usuario.
 * @returns {string} Primeros 8 caracteres del UUID, en mayúsculas.
 */
function codigoCliente(id) {
  return String(id || "")
    .replace(/-/g, "")
    .slice(0, 8)
    .toUpperCase();
}

/**
 * Indica si la cuenta carga puntos y valida cupones en lugar de sumarlos.
 * @returns {boolean}
 */
const esGestorPuntos = () => [ROLES.marca, ROLES.administracion].includes(estado.usuario?.rol);

/**
 * Copia en el estado el saldo, el historial y los cupones de una cuenta.
 * @param {Cuenta} cuenta Datos devueltos por obtenerCuenta().
 */
function aplicarPuntos(cuenta) {
  estado.puntos = cuenta.points;
  estado.puntosGanados = cuenta.earned;
  estado.historial = cuenta.movimientos.map(normalizarMovimiento);
  estado.cupones = cuenta.cupones.map(normalizarCupon);
}

/**
 * Actualiza saldo, historial y cupones. Si falla, se conservan los datos actuales.
 * @returns {Promise<void>}
 */
async function refrescarPuntos() {
  if (!hayConexion() || !estado.usuario) return;
  try {
    aplicarPuntos(await obtenerCuenta());
  } catch (_) {
    /* se mantienen los datos actuales */
  }
}

/**
 * Recupera la sesión guardada y carga los datos de la cuenta.
 * Sin sesión, vuelve al estado inicial y muestra la página de bienvenida.
 * @returns {Promise<void>}
 */
async function hidratarCuenta() {
  if (!hayConexion()) return;
  try {
    const cuenta = await obtenerCuenta();
    estado.usuario = {
      id: cuenta.id,
      nombre: cuenta.name,
      email: cuenta.email,
      rol: cuenta.role,
      nombreMarca: cuenta.brand_name
    };
    aplicarPuntos(cuenta);
    await cargarReviews();
    await prepararVista();
    render();
  } catch (_) {
    estado = { ...estadoInicial(), reviews: estado.reviews };
    render();
  }
}

/**
 * Carga las reviews publicadas por la comunidad.
 * @returns {Promise<void>}
 */
async function cargarReviews() {
  try {
    estado.reviews = (await obtenerReviews()).map(normalizarReview);
  } catch (_) {
    estado.reviews = [];
  }
}

/**
 * Descarga el catálogo según el rol de la cuenta y lo guarda en db.
 * @returns {Promise<void>}
 */
async function prepararVista() {
  if (!hayConexion()) return;
  db = await obtenerCatalogo(estado.usuario);
}
