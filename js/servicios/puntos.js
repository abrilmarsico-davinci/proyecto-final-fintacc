/* =========================================================
   Servicio de puntos
   Canje de cupones, carga de compras y actividad de la marca.
   Las operaciones son funciones transaccionales de la base (supabase/puntos.sql).
   ========================================================= */

/**
 * Canjea puntos del usuario por un cupón.
 * @param {number} puntos Puntos a descontar.
 * @returns {Promise<{ code: string, points: number, discount: number, status: string }>} Cupón generado.
 */
async function canjearPuntos(puntos) {
  return datosDe(await clienteSupabase().rpc("redeem_coupon", { p_points: Number(puntos) }));
}

/**
 * Acredita puntos a un cliente por una compra en un local de la marca.
 * @param {{ cliente: string, local: string, monto: number, ticket?: string }} compra Código o email del cliente, id del local, monto y ticket.
 * @returns {Promise<{ puntos: number, cliente: string, local: string }>} Resumen de la carga.
 */
async function acreditarPuntos({ cliente, local, monto, ticket }) {
  return datosDe(
    await clienteSupabase().rpc("award_points", {
      p_customer: cliente,
      p_store_id: local,
      p_amount: Number(monto),
      p_receipt: ticket || null
    })
  );
}

/**
 * Valida un cupón y lo marca como usado.
 * @param {string} codigo Código del cupón.
 * @returns {Promise<{ descuento: number, cliente: string }>} Datos del cupón validado.
 */
async function validarCupon(codigo) {
  return datosDe(await clienteSupabase().rpc("use_coupon", { p_code: codigo }));
}

/**
 * Obtiene las compras cargadas y los cupones validados en los locales de la marca.
 * @returns {Promise<Array<{ tipo: string, cliente: string, detalle: string, fecha: string, monto: ?number, puntos: number }>>}
 */
async function obtenerActividadMarca() {
  return datosDe(await clienteSupabase().rpc("brand_activity"));
}
