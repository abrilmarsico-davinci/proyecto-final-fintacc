/* =========================================================
   DATOS DE PRUEBA
   Todos los nombres de locales y marcas son ficticios.
   ========================================================= */

// Marcas en evaluación: la plataforma puede mostrarse con cualquiera de las dos
const MARCAS = {
  eatrust: { nombre: "Eatrust", logo: "assets/logo-eatrust.png", mono: "assets/mono-eatrust.png", wordmark: "assets/wordmark-eatrust.png" },
  fintacc: { nombre: "Fintacc", logo: "assets/logo-fintacc.png", mono: "assets/mono-fintacc.png", wordmark: "assets/wordmark-fintacc.png" }
};

// Sistema de puntos: 1 punto cada $1.000
const PESOS_POR_PUNTO = 1000;

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

const LOCALES = [
  {
    id: "raiz", nombre: "Almacén Raíz", tipo: "Dietética", barrio: "Palermo",
    direccion: "Gorriti 4800", horario: "Lun a sáb · 9 a 20 h", rating: 4.8, verificado: true, x: 60, y: 30,
    verificacion: ["Sector exclusivo sin TACC", "Productos con registro ANMAT", "Personal capacitado"],
    menu: []
  },
  {
    id: "brote", nombre: "Brote Cocina Verde", tipo: "Restaurante", barrio: "Villa Crespo",
    direccion: "Thames 520", horario: "Mar a dom · 12 a 23 h", rating: 4.6, verificado: true, x: 34, y: 52,
    verificacion: ["Cocina separada para platos sin TACC", "Carta con platos sin TACC identificados", "Personal capacitado"],
    menu: [
      { plato: "Bowl de quinoa y vegetales asados" },
      { plato: "Ñoquis de papa sin TACC" },
      { plato: "Curry de garbanzos" }
    ]
  },
  {
    id: "masamadre", nombre: "Masa Libre Panadería", tipo: "Panadería", barrio: "Belgrano",
    direccion: "Juramento 2100", horario: "Lun a sáb · 8 a 20 h", rating: 4.9, verificado: true, x: 50, y: 18,
    verificacion: ["Elaboración 100 % sin TACC", "Horno exclusivo", "Certificación vigente"],
    menu: [
      { plato: "Pan de molde de trigo sarraceno" },
      { plato: "Medialunas sin TACC" },
      { plato: "Budín de limón sin TACC" }
    ]
  },
  {
    id: "lacuchara", nombre: "La Cuchara Libre", tipo: "Restaurante", barrio: "Recoleta",
    direccion: "Av. Las Heras 2300", horario: "Lun a sáb · 12 a 16 h", rating: 4.4, verificado: true, x: 64, y: 44,
    verificacion: ["Carta con platos sin TACC identificados", "Freidora exclusiva sin TACC", "Personal capacitado"],
    menu: [
      { plato: "Salmón con espárragos" },
      { plato: "Ensalada César con croutons sin TACC" }
    ]
  },
  {
    id: "verdeurquiza", nombre: "Verde Urquiza", tipo: "Café", barrio: "Villa Urquiza",
    direccion: "Triunvirato 4500", horario: "Todos los días · 8 a 21 h", rating: 4.5, verificado: true, x: 30, y: 14,
    verificacion: ["Tostadora exclusiva para pan sin TACC", "Opciones sin TACC envasadas y cerradas", "Carta con platos sin TACC identificados"],
    menu: [
      { plato: "Tostado en pan sin TACC" },
      { plato: "Brownie sin TACC" }
    ]
  },
  {
    id: "centro", nombre: "Mercado Libre de Gluten", tipo: "Dietética", barrio: "Microcentro",
    direccion: "Florida 650", horario: "Lun a vie · 9 a 19 h", rating: 4.2, verificado: false, x: 80, y: 62,
    verificacion: [],
    menu: []
  }
];

const PRODUCTOS = [
  { id: "p1", nombre: "Pan de molde sin TACC", marca: "Molino Claro", categoria: "Panificados", precio: 6900, locales: ["raiz", "masamadre", "centro"] },
  { id: "p2", nombre: "Fideos de arroz sin TACC", marca: "Grano Fino", categoria: "Almacén", precio: 3200, locales: ["raiz", "centro"] },
  { id: "p3", nombre: "Cerveza sin TACC", marca: "Malta Libre", categoria: "Bebidas", precio: 3600, locales: ["raiz", "verdeurquiza"] },
  { id: "p4", nombre: "Premezcla para pizza sin TACC", marca: "Molino Claro", categoria: "Almacén", precio: 5400, locales: ["raiz", "centro"] },
  { id: "p5", nombre: "Galletitas de arroz sin TACC", marca: "Grano Fino", categoria: "Snacks", precio: 1900, locales: ["raiz", "centro", "verdeurquiza"] },
  { id: "p6", nombre: "Tapas para empanadas sin TACC", marca: "Masa Clara", categoria: "Refrigerados", precio: 4300, locales: ["raiz"] },
  { id: "p7", nombre: "Harina de almendras sin TACC", marca: "Almendra Viva", categoria: "Almacén", precio: 9800, locales: ["raiz"] },
  { id: "p8", nombre: "Alfajor sin TACC", marca: "Dulce Sur", categoria: "Snacks", precio: 1500, locales: ["raiz", "verdeurquiza"] },
  { id: "p9", nombre: "Yogur con cereales sin TACC", marca: "Valle Blanco", categoria: "Refrigerados", precio: 2100, locales: ["raiz", "verdeurquiza"] }
];

const RECETAS = [
  {
    id: "r1", nombre: "Panqueques de banana", momento: "Desayuno", minutos: 15, porciones: 2,
    nutricion: { calorias: 310, proteinas: 11, carbohidratos: 44, grasas: 9 },
    ingredientes: ["1 banana madura", "2 huevos", "3 cdas de harina de arroz", "1 cdita de canela"],
    pasos: ["Pisá la banana hasta formar un puré.", "Agregá los huevos, la harina y la canela, y batí hasta integrar.", "Calentá una sartén antiadherente a fuego medio.", "Cociná cucharadas de la mezcla 2 minutos de cada lado."]
  },
  {
    id: "r2", nombre: "Bowl de quinoa y garbanzos", momento: "Almuerzo", minutos: 25, porciones: 2,
    nutricion: { calorias: 420, proteinas: 16, carbohidratos: 58, grasas: 12 },
    ingredientes: ["1 taza de quinoa", "1 lata de garbanzos", "1 palta", "Tomates cherry", "Jugo de limón y aceite de oliva"],
    pasos: ["Lavá la quinoa y cocinala 15 minutos en el doble de agua.", "Escurrí y enjuagá los garbanzos.", "Cortá la palta y los tomates.", "Armá el bowl y condimentá con limón, aceite y sal."]
  },
  {
    id: "r3", nombre: "Salmón con espárragos", momento: "Cena", minutos: 20, porciones: 2,
    nutricion: { calorias: 380, proteinas: 34, carbohidratos: 6, grasas: 24 },
    ingredientes: ["2 filetes de salmón", "1 atado de espárragos", "Aceite de oliva", "Limón, sal y pimienta"],
    pasos: ["Precalentá el horno a 200 °C.", "Colocá el salmón y los espárragos en una placa con aceite.", "Condimentá con sal, pimienta y limón.", "Horneá 12 a 15 minutos."]
  },
  {
    id: "r4", nombre: "Muffins de almendra", momento: "Merienda", minutos: 30, porciones: 6,
    nutricion: { calorias: 210, proteinas: 7, carbohidratos: 5, grasas: 18 },
    ingredientes: ["2 tazas de harina de almendras", "3 huevos", "3 cdas de eritritol", "1 cdita de polvo de hornear", "Esencia de vainilla"],
    pasos: ["Precalentá el horno a 180 °C.", "Mezclá los ingredientes secos.", "Agregá los huevos y la vainilla, y uní bien.", "Distribuí en moldes y horneá 20 minutos."]
  },
  {
    id: "r5", nombre: "Curry de lentejas", momento: "Cena", minutos: 35, porciones: 4,
    nutricion: { calorias: 360, proteinas: 18, carbohidratos: 52, grasas: 8 },
    ingredientes: ["1 taza de lentejas", "1 lata de leche de coco", "1 cebolla", "2 cdas de curry", "Arroz para acompañar"],
    pasos: ["Rehogá la cebolla picada con el curry.", "Agregá las lentejas lavadas y 3 tazas de agua.", "Cociná 20 minutos a fuego bajo.", "Sumá la leche de coco y cociná 5 minutos más."]
  },
  {
    id: "r6", nombre: "Tostadas con palta y huevo", momento: "Desayuno", minutos: 10, porciones: 1,
    nutricion: { calorias: 340, proteinas: 14, carbohidratos: 28, grasas: 20 },
    ingredientes: ["2 rebanadas de pan sin TACC", "½ palta", "1 huevo", "Sal y semillas"],
    pasos: ["Tostá el pan.", "Pisá la palta con sal.", "Cociná el huevo a la plancha.", "Armá las tostadas y sumá semillas."]
  },
  {
    id: "r7", nombre: "Zoodles al pesto", momento: "Almuerzo", minutos: 15, porciones: 2,
    nutricion: { calorias: 260, proteinas: 6, carbohidratos: 9, grasas: 22 },
    ingredientes: ["2 zucchinis", "1 taza de albahaca", "3 cdas de nueces", "Aceite de oliva y ajo"],
    pasos: ["Cortá los zucchinis en tiras finas.", "Procesá la albahaca, las nueces, el ajo y el aceite.", "Saltá los zoodles 2 minutos.", "Mezclá con el pesto y serví."]
  },
  {
    id: "r8", nombre: "Arroz con pollo y zanahoria", momento: "Almuerzo", minutos: 30, porciones: 3,
    nutricion: { calorias: 450, proteinas: 30, carbohidratos: 55, grasas: 10 },
    ingredientes: ["1 taza de arroz", "2 pechugas de pollo", "2 zanahorias", "Aceite de oliva y sal"],
    pasos: ["Cortá el pollo en cubos y dorálo.", "Agregá la zanahoria rallada.", "Sumá el arroz y 2 tazas de agua.", "Cociná tapado 18 minutos."]
  }
];

// Reviews iniciales de la comunidad (las nuevas se guardan en el navegador)
const REVIEWS = [
  { objetivo: "brote", autor: "Martina", estrellas: 5, texto: "Me explicaron cómo separan la cocina. Comí tranquila por primera vez en mucho tiempo." },
  { objetivo: "brote", autor: "Tomás", estrellas: 4, texto: "El curry es buenísimo y me explicaron cómo lo preparan. A veces hay que esperar un poco." },
  { objetivo: "masamadre", autor: "Sofía", estrellas: 5, texto: "Las medialunas no tienen nada que envidiarle a las comunes." },
  { objetivo: "lacuchara", autor: "Julián", estrellas: 4, texto: "Tienen freidora exclusiva, así que por fin pude comer papas fritas afuera." },
  { objetivo: "p1", autor: "Lucía", estrellas: 5, texto: "Esponjoso y no se desarma. Lo compro siempre en Almacén Raíz." },
  { objetivo: "p3", autor: "Camila", estrellas: 4, texto: "Muy rica y fácil de conseguir. Ojalá la tengan en más locales." }
];
