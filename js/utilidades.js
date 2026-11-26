/* =========================================================
   Utilidades
   Formato, escape de HTML, avisos y conversión de datos.
   ========================================================= */

/** Contenedor donde se dibuja toda la aplicación. */
const app = document.getElementById("app");

/**
 * Busca un elemento dentro de la aplicación.
 * @param {string} selector Selector CSS.
 * @returns {?HTMLElement}
 */
const $ = (selector) => app.querySelector(selector);

/**
 * Formatea un número como precio en pesos argentinos.
 * @param {number} n Monto.
 * @returns {string} Ej: "$1.500".
 */
const pesos = (n) => "$" + n.toLocaleString("es-AR");

/**
 * Escapa los caracteres especiales de HTML para insertar texto de forma segura en una plantilla.
 * @param {*} texto Valor a mostrar.
 * @returns {string} Texto escapado.
 */
function escapar(texto) {
  return String(texto).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
}

/**
 * Sello "Sin TACC" de las tarjetas.
 * @returns {string} HTML del sello.
 */
function sello() {
  return `<span class="sello">Sin TACC</span>`;
}

/**
 * Puntuación en estrellas con su texto accesible.
 * @param {number} n Puntuación de 0 a 5 (se redondea).
 * @returns {string} HTML de las estrellas.
 */
function estrellas(n) {
  return `<span class="estrellas" role="img" aria-label="${n} de 5 estrellas">${"★".repeat(Math.round(n))}${"☆".repeat(5 - Math.round(n))}</span>`;
}

/**
 * Nivel alcanzado según los puntos ganados en total.
 * @returns {{ nombre: string, desde: number }}
 */
function nivelActual() {
  return [...NIVELES].reverse().find((n) => estado.puntosGanados >= n.desde);
}

/**
 * Próximo nivel a alcanzar.
 * @returns {{ nombre: string, desde: number }|undefined} undefined si ya está en el nivel más alto.
 */
function siguienteNivel() {
  return NIVELES.find((n) => n.desde > estado.puntosGanados);
}

/**
 * Reviews de un local o producto.
 * @param {string} id Id del local o producto.
 * @returns {Array<{ id: number, objetivo: string, autor: string, estrellas: number, texto: string }>}
 */
function reviewsDe(id) {
  return estado.reviews.filter((r) => String(r.objetivo) === String(id));
}

/**
 * Puntuación promedio de un local o producto.
 * @param {string} id Id del local o producto.
 * @param {number} [base] Valor a usar cuando todavía no tiene reviews.
 * @returns {number}
 */
function promedio(id, base) {
  const lista = reviewsDe(id);
  if (!lista.length) return base || 0;
  return lista.reduce((s, r) => s + r.estrellas, 0) / lista.length;
}

/**
 * Lee una imagen local y la devuelve como data URL para previsualizarla antes de subirla.
 * @param {File} archivo Imagen elegida en un campo de tipo file.
 * @returns {Promise<string>} Data URL de la imagen.
 */
function leerImagen(archivo) {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.addEventListener("load", () => resolver(lector.result));
    lector.addEventListener("error", () => rechazar(new Error("No se pudo leer la imagen.")));
    lector.readAsDataURL(archivo);
  });
}

/**
 * Acepta solo URLs http(s), blob o archivos del proyecto, para evitar inyectar esquemas peligrosos.
 * @param {string} url URL a validar.
 * @returns {string} URL escapada o cadena vacía si no es válida.
 */
function urlSegura(url) {
  const u = String(url || "").trim();
  return /^(https?:\/\/|blob:|assets\/|\.\/)/i.test(u) ? escapar(u) : "";
}

/**
 * Convierte un valor de la base (array o texto JSON) en array.
 * @param {*} v Valor de una columna jsonb o text.
 * @returns {Array} El array, o un array vacío si el valor no se puede convertir.
 */
function comoArray(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === "string" && v.trim()) {
    try {
      const x = JSON.parse(v);
      return Array.isArray(x) ? x : [];
    } catch (_) {
      return [];
    }
  }
  return [];
}

/**
 * Unifica las columnas de una receta (moment, minutes, steps...) con los nombres que usa la interfaz.
 * @param {Object} r Fila de la tabla recipes.
 * @returns {{ id: string, nombre: string, momento: string, minutos: number, porciones: number, nutricion: ?Object, ingredientes: string[], pasos: string[], idsProductos: string[], image_url: ?string }}
 */
function normalizarReceta(r) {
  const n = r.nutricion || r.nutrition || {};
  return {
    id: r.id,
    nombre: r.nombre || r.name || "",
    momento: r.momento || r.moment || "Almuerzo",
    minutos: r.minutos || r.minutes || 20,
    porciones: r.porciones || r.servings || 1,
    nutricion:
      n && Object.keys(n).length
        ? {
            calorias: n.calorias ?? n.calories,
            proteinas: n.proteinas ?? n.proteins,
            carbohidratos: n.carbohidratos ?? n.carbohydrates,
            grasas: n.grasas ?? n.fats
          }
        : null,
    ingredientes: comoArray(r.ingredientes || r.ingredients),
    pasos: comoArray(r.pasos || r.steps),
    idsProductos: comoArray(r.product_ids).map(String),
    image_url: r.image_url
  };
}
