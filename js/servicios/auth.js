/* =========================================================
   Servicio de cuentas
   Registro, ingreso, sesión y datos personales (Supabase Auth).
   ========================================================= */

/**
 * Datos de la cuenta del usuario autenticado.
 * @typedef {Object} Cuenta
 * @property {string} id UUID del usuario.
 * @property {string} name Nombre visible.
 * @property {string} email Email de la cuenta.
 * @property {"user"|"brand"|"administrator"} role Rol de la cuenta.
 * @property {number} points Puntos disponibles.
 * @property {number} earned Puntos ganados en total (definen el nivel).
 * @property {?string} brand_name Nombre público de la marca, si la cuenta es de una marca.
 * @property {Array<{ detail: string, points: number, date: string }>} movimientos Historial de puntos.
 * @property {Array<{ code: string, points: number, discount: number, status: string }>} cupones Cupones canjeados.
 */

/**
 * Crea una cuenta nueva. El perfil y los puntos de bienvenida los genera un trigger en la base.
 * @param {{ nombre: string, email: string, clave: string }} datos Datos del formulario de registro.
 * @returns {Promise<{ necesitaConfirmacion: boolean }>} Indica si hay que confirmar el email antes de ingresar.
 */
async function registrarUsuario({ nombre, email, clave }) {
  const respuesta = datosDe(
    await clienteSupabase().auth.signUp({
      email,
      password: clave,
      options: { data: { full_name: nombre } }
    })
  );
  return { necesitaConfirmacion: !respuesta.session };
}

/**
 * Inicia sesión con email y contraseña.
 * @param {{ email: string, clave: string }} datos Credenciales del formulario de ingreso.
 * @returns {Promise<void>}
 */
async function iniciarSesion({ email, clave }) {
  datosDe(await clienteSupabase().auth.signInWithPassword({ email, password: clave }));
}

/**
 * Cierra la sesión actual.
 * @returns {Promise<void>}
 */
async function cerrarSesion() {
  const { error } = await clienteSupabase().auth.signOut();
  if (error) throw new Error(error.message);
}

/**
 * Obtiene el perfil, el historial de puntos y los cupones del usuario autenticado.
 * @returns {Promise<Cuenta>}
 */
async function obtenerCuenta() {
  const sb = clienteSupabase();
  const { user: usuario } = datosDe(await sb.auth.getUser());
  if (!usuario) throw new Error("No hay una sesión activa.");

  const [perfil, movimientos, cupones] = await Promise.all([
    sb.from("profiles").select("id,name,role,points,earned,brand_name").eq("id", usuario.id).single(),
    sb
      .from("movements")
      .select("detail,points,date:created_at")
      .eq("user_id", usuario.id)
      .order("id", { ascending: false }),
    sb.from("coupons").select("code,points,discount,status").eq("user_id", usuario.id).order("id", { ascending: false })
  ]);

  return {
    ...datosDe(perfil),
    email: usuario.email,
    movimientos: datosDe(movimientos),
    cupones: datosDe(cupones)
  };
}

/**
 * Actualiza el nombre del perfil del usuario autenticado.
 * @param {string} nombre Nombre nuevo.
 * @returns {Promise<void>}
 * @throws {Error} Si la política de la tabla no permite el cambio.
 */
async function actualizarNombre(nombre) {
  const id = await idUsuarioActual();
  const filas = datosDe(await clienteSupabase().from("profiles").update({ name: nombre }).eq("id", id).select("id"));
  if (!filas.length) throw new Error("No se pudo actualizar el nombre. Revisá los permisos de la cuenta.");
}

/**
 * Cambia la contraseña del usuario autenticado.
 * @param {string} clave Contraseña nueva (mínimo 8 caracteres).
 * @returns {Promise<void>}
 */
async function cambiarClave(clave) {
  datosDe(await clienteSupabase().auth.updateUser({ password: clave }));
}
