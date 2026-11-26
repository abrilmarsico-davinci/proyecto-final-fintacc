/* =========================================================
   Página no encontrada
   ========================================================= */

/**
 * Pantalla para rutas inexistentes o sin permiso.
 * @returns {string} HTML de la pantalla.
 */
function pantallaNoEncontrada() {
  return estructuraPagina(
    "",
    `<h1 class="visualmente-oculto">Página no encontrada</h1>
    ${volver("#/", "Inicio")}${vacio("No encontramos esta página", "Volvé al inicio para seguir navegando.")}`
  );
}
