/* =========================================================
   Íconos y colores
   Íconos de línea en SVG y tonos por momento, categoría y tipo de local.
   ========================================================= */

/** Color de fondo de cada momento del día. */
const TONO_MOMENTO = { Desayuno: "t-naranja", Almuerzo: "t-menta", Merienda: "t-tostado", Cena: "t-marron" };

/** Color de fondo de cada categoría de producto. */
const TONO_CATEGORIA = {
  Panificados: "t-tostado",
  Almacén: "t-naranja",
  Bebidas: "t-menta",
  Snacks: "t-marron",
  Refrigerados: "t-menta"
};

/** Trazos SVG de los íconos de línea, por nombre. */
const TRAZOS = {
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  cuenco:
    '<path d="M3 12h18a9 9 0 0 1-18 0z"/><path d="M8 8c0-1.2 1-1.2 1-2.4M12 8c0-1.2 1-1.2 1-2.4M16 8c0-1.2 1-1.2 1-2.4"/>',
  taza: '<path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16M7 3v3M11 3v3"/>',
  luna: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  pan: '<path d="M6 11a3.5 3.5 0 0 1 1-6.5h10A3.5 3.5 0 0 1 18 11v8a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z"/><path d="M10 9v2M14 9v2"/>',
  frasco:
    '<rect x="7" y="3" width="10" height="4" rx="1"/><path d="M6 7h12v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z"/><path d="M6 12h12"/>',
  botella: '<path d="M10 2h4v4l2 3v11a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V9l2-3z"/><path d="M8 13h8"/>',
  galleta:
    '<circle cx="12" cy="12" r="9"/><circle cx="9" cy="9" r=".8"/><circle cx="15" cy="10" r=".8"/><circle cx="10" cy="15" r=".8"/><circle cx="15" cy="15" r=".8"/>',
  frio: '<path d="M12 2v20M4 7l16 10M20 7L4 17"/><path d="M9 4l3 2 3-2M9 20l3-2 3 2"/>',
  bolsa: '<path d="M5 8h14l-1.4 12.2a1 1 0 0 1-1 .8H7.4a1 1 0 0 1-1-.8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  cubiertos: '<path d="M6 3v7a2 2 0 0 0 4 0V3M8 10v11M17 3c-2.5 2-2.5 7 0 9v9"/>',
  libro: '<path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z"/><path d="M20 4h-4a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h5z"/>',
  marcador: '<path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
  estrella: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>',
  ticket:
    '<path d="M3 8a2 2 0 0 0 0 4v0a2 2 0 0 1 0 4v2h18v-2a2 2 0 0 1 0-4 2 2 0 0 1 0-4V6H3z"/><path d="M14 6v12" stroke-dasharray="2 2"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/>',
  lapiz: '<path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>',
  basura:
    '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/>',
  arriba: '<path d="M18 15l-6-6-6 6"/>',
  abajo: '<path d="M6 9l6 6 6-6"/>',
  ajustes:
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  guardar:
    '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
  usuario: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  monitor:
    '<rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
  tableta: '<rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>',
  celular: '<rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>'
};

/**
 * Ícono de línea decorativo (aria-hidden).
 * @param {keyof TRAZOS} nombre Nombre del ícono.
 * @param {string} [clase] Clase extra.
 * @returns {string} SVG del ícono.
 */
function icono(nombre, clase = "") {
  return `<svg class="icono-svg ${clase}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${TRAZOS[nombre]}</svg>`;
}

/** Ícono de cada momento del día. */
const ICONO_MOMENTO = { Desayuno: "sol", Almuerzo: "cuenco", Merienda: "taza", Cena: "luna" };

/** Ícono de cada categoría de producto. */
const ICONO_CATEGORIA = {
  Panificados: "pan",
  Almacén: "frasco",
  Bebidas: "botella",
  Snacks: "galleta",
  Refrigerados: "frio"
};

/** Ícono de cada tipo de local. */
const ICONO_LOCAL = { Panadería: "pan", Café: "taza", Dietética: "bolsa", Restaurante: "cubiertos" };

/**
 * Ícono según el tipo de local.
 * @param {Object} l Local.
 * @returns {string} SVG del ícono.
 */
const iconoLocal = (l) => icono(ICONO_LOCAL[l.type || l.tipo] || "cubiertos");
