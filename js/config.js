/* =========================================================
   Configuración de la plataforma
   Identidad, sistema de puntos, canjes y niveles.
   ========================================================= */

/** Identidad de la plataforma: nombre e imágenes del logo. */
const MARCA = {
  nombre: "Fintacc",
  logo: "assets/logo-fintacc.png",
  mono: "assets/mono-fintacc.png"
};

/** Pesos de compra necesarios para sumar 1 punto. */
const PESOS_POR_PUNTO = 1000;

/**
 * Cupones que se pueden canjear con puntos.
 * @type {Array<{ id: string, puntos: number, descuento: number }>}
 */
const CANJES = [
  { id: "c250", puntos: 250, descuento: 2500 },
  { id: "c500", puntos: 500, descuento: 6000 },
  { id: "c1000", puntos: 1000, descuento: 14000 }
];

/**
 * Niveles según los puntos ganados en total.
 * @type {Array<{ nombre: string, desde: number }>}
 */
const NIVELES = [
  { nombre: "Explorador", desde: 0 },
  { nombre: "Leal", desde: 1000 },
  { nombre: "VIP", desde: 3000 }
];
