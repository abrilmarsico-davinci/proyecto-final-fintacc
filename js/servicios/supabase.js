/* =========================================================
   Cliente de Supabase
   Acceso común para todos los servicios.
   ========================================================= */

/**
 * Valores de la columna profiles.role.
 * @enum {string}
 */
const ROLES = {
  usuario: "user",
  marca: "brand",
  administracion: "administrator"
};

/**
 * Devuelve el cliente de Supabase creado en js/supabase-config.js.
 * @returns {SupabaseClient} Cliente configurado con la URL y la publishable key del proyecto.
 * @throws {Error} Si el proyecto todavía no tiene URL o publishable key.
 */
function clienteSupabase() {
  if (!window.fintaccSupabase) {
    throw new Error("Falta configurar Supabase. Completá la URL y la publishable key en js/supabase-config.js.");
  }
  return window.fintaccSupabase;
}

/**
 * Indica si el cliente de Supabase está disponible.
 * @returns {boolean}
 */
function hayConexion() {
  return Boolean(window.fintaccSupabase);
}

/**
 * Extrae los datos de una respuesta de Supabase o lanza su error.
 * @template T
 * @param {{ data: T, error: ?{ message: string } }} respuesta Respuesta de una consulta de Supabase.
 * @returns {T} Los datos de la respuesta.
 * @throws {Error} Si la consulta devolvió un error.
 */
function datosDe({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Devuelve el id del usuario autenticado.
 * @returns {Promise<string>} UUID del usuario en Supabase Auth.
 * @throws {Error} Si no hay una sesión activa.
 */
async function idUsuarioActual() {
  const { user: usuario } = datosDe(await clienteSupabase().auth.getUser());
  if (!usuario) throw new Error("Tu sesión expiró. Volvé a ingresar.");
  return usuario.id;
}
