/* =========================================================
   Servicio del backoffice
   Alta, edición y baja de productos, locales, categorías y recetas,
   y perfil público de la marca.
   ========================================================= */

/** Tabla de Supabase de cada sección del backoffice. */
const TABLAS_DB = { productos: "products", locales: "stores", categorias: "categories", recetas: "recipes" };

/**
 * Lista los registros de una sección del backoffice. Las marcas solo ven lo que cargaron.
 * @param {keyof TABLAS_DB} tipo Sección del backoffice.
 * @param {string} rol Rol de la cuenta.
 * @returns {Promise<Object[]>}
 */
async function listarRegistros(tipo, rol) {
  let consulta = clienteSupabase().from(TABLAS_DB[tipo]).select("*").order("id", { ascending: false });
  if (rol === ROLES.marca) consulta = consulta.eq("merchant_user_id", await idUsuarioActual());
  return datosDe(await consulta);
}

/**
 * Obtiene un registro por id.
 * @param {keyof TABLAS_DB} tipo Sección del backoffice.
 * @param {string|number} id Id del registro.
 * @returns {Promise<?Object>} El registro o null si no existe.
 */
async function obtenerRegistro(tipo, id) {
  return datosDe(await clienteSupabase().from(TABLAS_DB[tipo]).select("*").eq("id", id).maybeSingle());
}

/**
 * Crea o actualiza un registro. Los registros nuevos quedan asignados a la cuenta que los crea.
 * @param {keyof TABLAS_DB} tipo Sección del backoffice.
 * @param {Object} datos Columnas a guardar.
 * @param {?(string|number)} id Id del registro a editar, o null para crear uno nuevo.
 * @returns {Promise<void>}
 */
async function guardarRegistro(tipo, datos, id = null) {
  const tabla = clienteSupabase().from(TABLAS_DB[tipo]);
  if (id) {
    datosDe(await tabla.update(datos).eq("id", id));
  } else {
    datosDe(await tabla.insert({ ...datos, merchant_user_id: await idUsuarioActual() }));
  }
  invalidarCatalogo();
}

/**
 * Elimina un registro.
 * @param {keyof TABLAS_DB} tipo Sección del backoffice.
 * @param {string|number} id Id del registro.
 * @returns {Promise<void>}
 */
async function eliminarRegistro(tipo, id) {
  datosDe(await clienteSupabase().from(TABLAS_DB[tipo]).delete().eq("id", id));
  invalidarCatalogo();
}

/**
 * Nombres de todas las categorías, para elegir las de un producto.
 * @returns {Promise<string[]>}
 */
async function obtenerNombresCategorias() {
  const filas = datosDe(await clienteSupabase().from("categories").select("name"));
  return filas.map((c) => c.name);
}

/**
 * Productos disponibles para asociar a una receta.
 * @returns {Promise<Array<{ id: string, name: string, brand: ?string, store_ids: string[] }>>}
 */
async function obtenerProductosParaReceta() {
  return datosDe(await clienteSupabase().from("products").select("id, name, brand, store_ids").order("name"));
}

/**
 * Datos que necesita el editor del perfil público: lo cargado por la marca y su perfil actual.
 * @param {string} idUsuario Id de la cuenta de la marca.
 * @returns {Promise<{ categorias: Object[], productos: Object[], locales: Object[], perfil: Object }>}
 */
async function obtenerDatosEditor(idUsuario) {
  const sb = clienteSupabase();
  const [categorias, productos, locales, perfil] = await Promise.all([
    sb.from("categories").select("id, name").eq("merchant_user_id", idUsuario).order("name"),
    sb.from("products").select("*").eq("merchant_user_id", idUsuario).order("name"),
    sb.from("stores").select("*").eq("merchant_user_id", idUsuario).order("name"),
    sb
      .from("profiles")
      .select("featured_categories, featured_products, featured_stores, logo_url, brand_name, brand_description")
      .eq("id", idUsuario)
      .single()
  ]);
  return {
    categorias: datosDe(categorias) || [],
    productos: datosDe(productos) || [],
    locales: datosDe(locales) || [],
    perfil: datosDe(perfil) || {}
  };
}

/**
 * Guarda el perfil público de la marca.
 * @param {string} idUsuario Id de la cuenta de la marca.
 * @param {Object} datos Nombre, descripción, logo y destacados.
 * @returns {Promise<void>}
 * @throws {Error} Si la política de la tabla no permite el cambio.
 */
async function guardarPerfilPublico(idUsuario, datos) {
  const filas = datosDe(await clienteSupabase().from("profiles").update(datos).eq("id", idUsuario).select("id"));
  if (!filas.length) throw new Error("No se pudo actualizar el perfil. Revisá los permisos de la cuenta.");
  invalidarCatalogo();
}
