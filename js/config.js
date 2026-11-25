/* =========================================================
   Configuración de la plataforma
   Identidad, sistema de puntos, canjes y niveles.
   ========================================================= */

const MARCA = {
  nombre: "Fintacc",
  logo: "assets/logo-fintacc.png",
  mono: "assets/mono-fintacc.png"
};

// 1 punto cada $1.000 de compra
const PESOS_POR_PUNTO = 1000;

// Cupones que se pueden canjear con puntos
const CANJES = [
  { id: "c250", puntos: 250, descuento: 2500 },
  { id: "c500", puntos: 500, descuento: 6000 },
  { id: "c1000", puntos: 1000, descuento: 14000 }
];

// Niveles según los puntos ganados en total
const NIVELES = [
  { nombre: "Explorador", desde: 0 },
  { nombre: "Leal", desde: 1000 },
  { nombre: "VIP", desde: 3000 }
];
