/* =========================================================
   Servicio de comercios
   Solicitudes de alta de comercios aliados.
   ========================================================= */

/**
 * Envía una solicitud de alta. Queda pendiente hasta que el equipo la revise.
 * @param {{ nombre: string, email: string, tipo: string, direccion: string }} comercio Datos del formulario.
 * @returns {Promise<void>}
 */
async function solicitarAltaComercio({ nombre, email, tipo, direccion }) {
  datosDe(
    await clienteSupabase()
      .from("merchants")
      .insert({ name: nombre, email, type: tipo, address: direccion, status: "pending" })
  );
}
