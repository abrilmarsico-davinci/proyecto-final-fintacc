/* =========================================================
   Servicio de catálogo
   Productos, locales, recetas, categorías y marcas.
   ========================================================= */

/**
 * Catálogo que usan las pantallas.
 * @typedef {Object} Catalogo
 * @property {Object[]} productos Filas de la tabla products.
 * @property {Object[]} locales Filas de la tabla stores.
 * @property {Object[]} recetas Filas de la tabla recipes.
 * @property {Object[]} categorias Filas de la tabla categories.
 * @property {Object[]} perfiles Filas de la vista brand_profiles.
 * @property {Object[]} marcas Filas de la tabla brands.
 */

/** Tiempo que el catálogo descargado se considera vigente, en milisegundos. */
const VIGENCIA_CATALOGO = 2 * 60 * 1000;

/**
 * Caché en memoria del último catálogo descargado. Se guarda junto con la cuenta
 * para la que se filtró, así un cambio de sesión nunca reutiliza datos de otra cuenta.
 * @type {{ clave: ?string, fecha: number, catalogo: ?Catalogo }}
 */
const cacheCatalogo = { clave: null, fecha: 0, catalogo: null };

/**
 * Descarta el catálogo guardado. Se llama después de crear, editar o borrar registros.
 */
function invalidarCatalogo() {
  cacheCatalogo.clave = null;
  cacheCatalogo.catalogo = null;
}

/**
 * Devuelve el catálogo, desde la caché si sigue vigente o descargándolo de Supabase.
 * @param {?{ id: string, rol: string }} usuario Usuario autenticado o null en la página de bienvenida.
 * @returns {Promise<Catalogo>}
 */
async function obtenerCatalogo(usuario) {
  const clave = usuario ? `${usuario.id}:${usuario.rol}` : "publico";
  const vigente = Date.now() - cacheCatalogo.fecha < VIGENCIA_CATALOGO;
  if (cacheCatalogo.catalogo && cacheCatalogo.clave === clave && vigente) return cacheCatalogo.catalogo;

  const catalogo = await descargarCatalogo(usuario);
  Object.assign(cacheCatalogo, { clave, fecha: Date.now(), catalogo });
  return catalogo;
}

/**
 * Descarga el catálogo y lo filtra según el rol de la cuenta.
 * Las marcas ven solo lo que cargaron y no reciben recetas; el resto ve los locales activos.
 * @param {?{ id: string, rol: string }} usuario Usuario autenticado o null en la página de bienvenida.
 * @returns {Promise<Catalogo>}
 */
async function descargarCatalogo(usuario) {
  const sb = clienteSupabase();
  const esMarca = usuario?.rol === ROLES.marca;

  const [productos, locales, recetas, categorias, perfiles, marcas] = await Promise.all([
    sb.from("products").select("*"),
    sb.from("stores").select("*"),
    esMarca ? Promise.resolve({ data: [] }) : sb.from("recipes").select("*"),
    sb.from("categories").select("*"),
    sb.from("brand_profiles").select("*"),
    sb.from("brands").select("*")
  ]);

  const catalogo = {
    productos: productos.data || [],
    locales: locales.data || [],
    recetas: recetas.data || [],
    categorias: categorias.data || [],
    perfiles: perfiles.data || [],
    marcas: marcas.data || []
  };

  if (esMarca) {
    const propio = (fila) => fila.merchant_user_id === usuario.id;
    catalogo.productos = catalogo.productos.filter(propio);
    catalogo.locales = catalogo.locales.filter(propio);
    catalogo.categorias = catalogo.categorias.filter(propio);
  } else {
    catalogo.locales = catalogo.locales.filter((l) => l.status === "active" || !l.status);
  }
  return catalogo;
}

/** Cantidad de productos que se piden por página en el listado. */
const PRODUCTOS_POR_PAGINA = 12;

/**
 * Página del listado de productos.
 * @typedef {Object} PaginaProductos
 * @property {Object[]} productos Productos de la página.
 * @property {number} total Cantidad total de productos que cumplen los filtros.
 * @property {boolean} hayMas Indica si quedan páginas por pedir.
 */

/**
 * Pide una página de productos filtrada en la base, con .range() de Supabase.
 * Las marcas solo ven los productos que cargaron.
 * @param {{ busqueda?: string, categoria?: string, pagina?: number, usuario?: ?{ id: string, rol: string } }} filtros
 * @returns {Promise<PaginaProductos>}
 */
async function listarProductos({ busqueda = "", categoria = "Todas", pagina = 0, usuario = null }) {
  const desde = pagina * PRODUCTOS_POR_PAGINA;
  let consulta = clienteSupabase()
    .from("products")
    .select("*", { count: "exact" })
    .order("name")
    .range(desde, desde + PRODUCTOS_POR_PAGINA - 1);

  // Se quitan los caracteres que tienen significado en la sintaxis de filtros de PostgREST
  const texto = busqueda.replace(/[%,()*]/g, " ").trim();
  if (texto) consulta = consulta.or(`name.ilike.%${texto}%,brand.ilike.%${texto}%`);
  if (categoria !== "Todas") consulta = consulta.ilike("category", `%${categoria}%`);
  if (usuario?.rol === ROLES.marca) consulta = consulta.eq("merchant_user_id", usuario.id);

  const { data, count, error } = await consulta;
  if (error) throw new Error(error.message);
  const total = count ?? data.length;
  return { productos: data, total, hayMas: desde + data.length < total };
}
