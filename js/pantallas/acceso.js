/* =========================================================
   Pantalla de acceso
   Registro e ingreso de usuarios.
   ========================================================= */

/**
 * Panel de marca que acompaña los formularios de acceso.
 * @param {string} titulo Título del panel.
 * @param {string} texto Bajada.
 * @returns {string} HTML del panel.
 */
function panelMarca(titulo, texto) {
  return `<div class="panel-marca"><img src="${MARCA.mono}" alt=""><div><h2>${titulo}</h2><p class="mt-16">${texto}</p></div></div>`;
}
/**
 * Atributos de accesibilidad para un campo con error.
 * @param {string} campo Id del campo.
 * @param {string} [error] Mensaje de error, si lo hay.
 * @returns {string} Atributos aria-invalid y aria-describedby, o cadena vacía.
 */
function atributosError(campo, error) {
  return error ? ` aria-invalid="true" aria-describedby="error-${campo}"` : "";
}

/**
 * Mensaje de error que se muestra debajo de un campo.
 * @param {string} campo Id del campo.
 * @param {string} [error] Mensaje de error, si lo hay.
 * @returns {string} HTML del mensaje o cadena vacía.
 */
function mensajeError(campo, error) {
  return error ? `<span class="error" id="error-${campo}">${escapar(error)}</span>` : "";
}

/**
 * Formulario de registro o ingreso, según ui.vistaPublica.
 * @returns {string} HTML de la pantalla.
 */
function pantallaAcceso() {
  const registro = ui.vistaPublica === "registro";
  const e = ui.borrador.errores || {};
  return `${barraPublica()}<main class="acceso" id="contenido" tabindex="-1">
    ${panelMarca(registro ? "Tu alimentación, simplificada." : "Qué bueno verte de nuevo.", registro ? "Creá tu cuenta y recibí 50 puntos de bienvenida." : "Ingresá para seguir encontrando productos y locales sin TACC.")}
    <div class="formulario">
      <button class="volver sin-margen" data-accion="ir-bienvenida">← Volver</button>
      <h1>${registro ? "Creá tu cuenta" : "Ingresá"}</h1>
      <form id="formulario-cuenta" novalidate>
        ${registro ? `<div class="campo"><label for="nombre">Nombre</label><input type="text" id="nombre" name="nombre" autocomplete="given-name" value="${escapar(ui.borrador.nombre || "")}"${atributosError("nombre", e.nombre)}>${mensajeError("nombre", e.nombre)}</div>` : ""}
        <div class="campo"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email" value="${escapar(ui.borrador.email || "")}"${atributosError("email", e.email)}>${mensajeError("email", e.email)}</div>
        <div class="campo"><label for="clave">Contraseña</label><input id="clave" name="clave" type="password" autocomplete="${registro ? "new-password" : "current-password"}"${atributosError("clave", e.clave)}>${mensajeError("clave", e.clave)}</div>
        ${e.general ? `<p class="error" role="alert">${escapar(e.general)}</p>` : ""}
        <button class="boton boton-ancho" type="submit">${registro ? "Crear cuenta" : "Ingresar"}</button>
      </form>
      <p class="suave chico">${registro ? '¿Ya tenés cuenta? <a class="texto-acento" href="#" data-accion="ir-ingreso">Ingresá</a>' : '¿No tenés cuenta? <a class="texto-acento" href="#" data-accion="ir-registro">Creala gratis</a>'}</p>
    </div>
    </main>`;
}
