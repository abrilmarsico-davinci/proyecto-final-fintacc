/* =========================================================
   Reviews
   Sección de reviews de locales y productos.
   ========================================================= */

/**
 * Reviews de un local o producto y botón para escribir una (solo usuarios).
 * @param {string} id Id del local o producto.
 * @returns {string} HTML de la sección.
 */
function seccionReviews(id) {
  const lista = reviewsDe(id);
  const esUsuario = estado.usuario?.rol === ROLES.usuario;

  return `<section class="caja">
    <h2>Comunidad</h2>
    ${lista.length ? lista.map((r) => `<div class="review"><p><strong>${escapar(r.autor)}</strong></p>${estrellas(r.estrellas)}<p class="mt-4">${escapar(r.texto)}</p></div>`).join("") : '<p class="suave my-8">Todavía no hay reviews.</p>'}
    
    ${
      esUsuario
        ? `
      <button class="boton boton-secundario boton-ancho mt-14" data-accion="abrir-review" data-id="${escapar(id)}">Escribir una review</button>
    `
        : ""
    }
  </section>`;
}
