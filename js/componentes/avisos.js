/* =========================================================
   Avisos
   Notificaciones globales que cualquier parte de la aplicación
   puede mostrar. Se apilan en una región en vivo de index.html
   para que los lectores de pantalla las anuncien.
   ========================================================= */

/**
 * Tipos de aviso y cuánto tiempo se muestra cada uno, en milisegundos.
 * @enum {{ clase: string, duracion: number }}
 */
const TIPOS_AVISO = {
  info: { clase: "aviso-info", duracion: 3000 },
  exito: { clase: "aviso-exito", duracion: 3000 },
  error: { clase: "aviso-error", duracion: 6000 }
};

/** Cantidad máxima de avisos visibles a la vez. */
const MAXIMO_AVISOS = 3;

/**
 * Muestra un aviso. Los errores usan role="alert" para anunciarse de inmediato.
 * @param {string} texto Mensaje del aviso.
 * @param {keyof TIPOS_AVISO} [tipo="info"] Tipo de aviso.
 */
function avisar(texto, tipo = "info") {
  const contenedor = document.getElementById("avisos");
  if (!contenedor) return;
  const { clase, duracion } = TIPOS_AVISO[tipo] || TIPOS_AVISO.info;

  const aviso = document.createElement("p");
  aviso.className = `aviso ${clase}`;
  if (tipo === "error") aviso.setAttribute("role", "alert");
  aviso.textContent = texto;
  contenedor.appendChild(aviso);

  while (contenedor.children.length > MAXIMO_AVISOS) contenedor.firstElementChild.remove();
  setTimeout(() => aviso.remove(), duracion);
}
