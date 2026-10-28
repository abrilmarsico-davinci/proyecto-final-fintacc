/* =========================================================
   PLATAFORMA WEB - Demo funcional (MVP Sprint 1)
   Single Page App en JavaScript puro:
   - Cuenta, puntos y comunidad se guardan mediante la API de Sprint 2.
   - La navegación usa el hash de la URL (#/recetas, #/local/brote...).
   ========================================================= */

const CLAVE_STORAGE = "demo-alimentacion-segura";
const app = document.getElementById("app");
const api = async (path, options = {}) => {
  const sb=window.fintaccSupabase;
  if(!sb) throw new Error("Falta configurar Supabase. Completá la URL y la publishable key en js/supabase-config.js.");
  const method=options.method || "GET";
  const body=options.body ? JSON.parse(options.body) : {};
  const check=({data,error})=>{if(error)throw new Error(error.message);return data;};
  const currentUser=async()=>check(await sb.auth.getUser()).user;
  const profile=async(user)=>check(await sb.from("profiles").select("id,name,role,points,earned").eq("id",user.id).single());

  if(path==="/auth/register" && method==="POST") {
    const {data,error}=await sb.auth.signUp({email:body.email,password:body.password,options:{data:{full_name:body.name}}});
    if(error)throw new Error(error.message);
    return {needsConfirmation:!data.session,user:{id:data.user.id,name:body.name,email:data.user.email,role:"user",points:50,earned:50}};
  }
  if(path==="/auth/login" && method==="POST") {
    const {data,error}=await sb.auth.signInWithPassword({email:body.email,password:body.password});
    if(error)throw new Error(error.message);
    const p=await profile(data.user); return {user:{id:p.id,name:p.name,email:data.user.email,role:p.role,points:p.points,earned:p.earned}};
  }
  if(path==="/auth/logout") return check(await sb.auth.signOut());
  if(path==="/me") {
    const user=await currentUser(), p=await profile(user);
    const [moves,coupons]=await Promise.all([
      sb.from("movements").select("detail,points,date:created_at").eq("user_id",user.id).order("id",{ascending:false}),
      sb.from("coupons").select("code,points,discount,status").eq("user_id",user.id).order("id",{ascending:false})
    ]);
    return {...p,name:p.name,email:user.email,history:check(moves),coupons:check(coupons)};
  }
  if(path==="/reviews" && method==="GET") {
    return check(await sb.from("reviews").select("target,stars,text,author,created_at").order("id",{ascending:false}));
  }
  if(path==="/reviews" && method==="POST") {
    const user=await currentUser(), p=await profile(user);
    return check(await sb.from("reviews").insert({user_id:user.id,author:p.name,target:body.target,stars:body.stars,text:body.text}).select().single());
  }
  if(path==="/stores" && method==="GET") return check(await sb.from("stores").select("id,name,qr_token").eq("status","active"));
  if(path==="/purchases" && method==="POST") return check(await sb.rpc("submit_purchase",{p_store_id:body.store,p_qr_token:body.qr_token,p_amount:Number(body.amount)}));
  if(path==="/coupons" && method==="POST") return check(await sb.rpc("redeem_coupon",{p_points:Number(body.points)}));
  if(path==="/merchants" && method==="POST") return check(await sb.from("merchants").insert({name:body.name,email:body.email,type:body.type,address:body.address,status:"pending"}));
  if(path==="/merchant/purchases" && method==="GET") {
    const since=new Date(Date.now()-24*60*60*1000).toISOString();
    return check(await sb.from("purchases").select("id,amount,points,created_at,store:stores(name)").eq("status","pending").gt("created_at",since).order("created_at")).map(p=>({...p,store:p.store?.name || "Comercio"}));
  }
  if(path==="/merchant/stores" && method==="GET") {
    const user=await currentUser(); return check(await sb.from("stores").select("id,name,qr_token").eq("merchant_user_id",user.id).eq("status","active"));
  }
  const confirm=path.match(/^\/merchant\/purchases\/(\d+)\/confirm$/);
  if(confirm && method==="POST") return check(await sb.rpc("confirm_purchase",{p_purchase_id:Number(confirm[1]),p_receipt:body.receipt}));
  throw new Error("Operación de Supabase no implementada");
};

/* ---------- Estado ---------- */
const estadoInicial = () => ({
  usuario: null,          // { nombre, email }
  marca: "fintacc",
  puntos: 0,              // saldo disponible
  puntosGanados: 0,       // total histórico (define el nivel)
  historial: [],          // movimientos de puntos
  cupones: [],            // canjes generados
  reviews: []             // reviews agregadas por el usuario
});

let estado = cargarEstado();
estado.usuario = null;
let ui = { menuAbierto: false, onboarding: "bienvenida", borrador: {}, filtroMomento: "Todas", busqueda: "", vistaLocales: "lista", categoria: "Todas", paso: 0, estrellas: 0 };

function cargarEstado() {
  try {
    const guardado = localStorage.getItem(CLAVE_STORAGE);
    const estado = guardado ? { ...estadoInicial(), ...JSON.parse(guardado) } : estadoInicial();
    estado.marca = "fintacc";
    return estado;
  } catch (e) {
    return estadoInicial();
  }
}
function guardarEstado() {
  try { localStorage.setItem(CLAVE_STORAGE, JSON.stringify({ marca: estado.marca })); } catch (e) { /* preferencia opcional */ }
}

async function hidratarCuenta() {
  if (!window.fintaccSupabase) return;
  try {
    const cuenta = await api("/me");
    estado.usuario = { id: cuenta.id, nombre: cuenta.name, email: cuenta.email, role: cuenta.role };
    estado.puntos = cuenta.points; estado.puntosGanados = cuenta.earned;
    estado.historial = cuenta.history || []; estado.cupones = cuenta.coupons || [];
    estado.reviews = (await api("/reviews")).map(r => ({ objetivo:r.target, autor:r.author, estrellas:r.stars, texto:r.text }));
    render();
  } catch (_) { estado={...estadoInicial(),marca:estado.marca}; render(); }
}

/* ---------- Utilidades ---------- */
const $ = (selector) => app.querySelector(selector);
const pesos = (n) => "$" + n.toLocaleString("es-AR");
const marca = () => MARCAS[estado.marca];

// Evita que el texto escrito por el usuario se interprete como HTML
function escapar(texto) {
  return String(texto).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Todo el contenido de la plataforma es sin TACC: el sello lo indica en cada tarjeta
function sello() {
  return `<span class="sello">Sin TACC</span>`;
}
function estrellas(n) {
  return `<span class="estrellas" aria-label="${n} de 5 estrellas">${"★".repeat(Math.round(n))}${"☆".repeat(5 - Math.round(n))}</span>`;
}
function nivelActual() {
  return [...NIVELES].reverse().find((n) => estado.puntosGanados >= n.desde);
}
function siguienteNivel() {
  return NIVELES.find((n) => n.desde > estado.puntosGanados);
}
function reviewsDe(id) {
  return [...estado.reviews, ...REVIEWS].filter((r) => r.objetivo === id);
}
function promedio(id, base) {
  const lista = reviewsDe(id);
  if (!lista.length) return base || 0;
  return lista.reduce((s, r) => s + r.estrellas, 0) / lista.length;
}
function avisar(texto) {
  document.querySelector(".aviso")?.remove();
  const el = document.createElement("div");
  el.className = "aviso";
  el.setAttribute("role", "status");
  el.textContent = texto;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

/* ---------- Estructura compartida: navegación flotante, pie y layout ---------- */
const SECCIONES = [["inicio", "Inicio", "#/"], ["recetas", "Recetas", "#/recetas"], ["productos", "Productos", "#/productos"], ["locales", "Locales", "#/locales"], ["puntos", "Puntos", "#/puntos"]];
const iconoMenu = () => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">${ui.menuAbierto ? '<path d="M6 6l12 12M18 6L6 18"/>' : '<path d="M4 8h16M4 16h16"/>'}</svg>`;

function barraSuperior(actual) {
  const inicial = estado.usuario.nombre.charAt(0).toUpperCase();
  return `
    <header class="topbar"><div class="barra-vidrio">
      <a class="logo-link" href="#/" aria-label="${marca().nombre}, ir al inicio"><img class="imagotipo" src="${marca().logo}" alt="Fintacc"></a>
      <nav class="menu ${ui.menuAbierto ? "abierto" : ""}" id="menu" aria-label="Navegación principal">
        ${SECCIONES.map(([id, texto, href]) => `<a href="${href}" ${actual === id ? 'aria-current="page"' : ""}>${texto}</a>`).join("")}
        <a class="solo-movil" href="#/perfil" ${actual === "perfil" ? 'aria-current="page"' : ""}>Mi perfil</a>
      </nav>
      <div class="acciones-usuario">
        <a class="pill-puntos" href="#/puntos">${estado.puntos} pts</a>
        <a class="avatar" href="#/perfil" aria-label="Mi perfil">${escapar(inicial)}</a>
        <button class="boton-menu" data-accion="menu" aria-expanded="${!!ui.menuAbierto}" aria-controls="menu" aria-label="Abrir menú">${iconoMenu()}</button>
      </div>
    </div></header>`;
}
function pie() {
  return `<footer class="pie"><div class="contenedor">
    <div class="pie-principal"><img class="logo-pie" src="${marca().logo}" alt="${marca().nombre}"><p class="lema">Comé seguro,<br>sin vueltas.</p></div>
    <div class="datos-pie"><span>${marca().nombre} · Plataforma sin TACC</span><span>Proyecto final · Diseño y Programación Web · 2026</span><span>Abril Marsico y Candela Cusinier</span></div>
  </div></footer>`;
}
function layout(actual, contenido) {
  return `${barraSuperior(actual)}<main class="contenedor pagina" id="contenido">${contenido}</main>${pie()}`;
}
function volver(href, texto = "Volver") { return `<a class="volver" href="${href}">← ${texto}</a>`; }
const vacio = (titulo, texto) => `<div class="vacio"><strong>${titulo}</strong>${texto}</div>`;

// Colores de fondo según el tipo de contenido (paleta de la marca)
const TONO_MOMENTO = { Desayuno: "t-naranja", Almuerzo: "t-menta", Merienda: "t-tostado", Cena: "t-marron" };
const TONO_CATEGORIA = { Panificados: "t-tostado", Almacén: "t-naranja", Bebidas: "t-menta", Snacks: "t-marron", Refrigerados: "t-menta" };
/* ---------- Íconos de línea (SVG propios, sin emojis) ---------- */
const TRAZOS = {
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  bowl: '<path d="M3 12h18a9 9 0 0 1-18 0z"/><path d="M8 8c0-1.2 1-1.2 1-2.4M12 8c0-1.2 1-1.2 1-2.4M16 8c0-1.2 1-1.2 1-2.4"/>',
  taza: '<path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16M7 3v3M11 3v3"/>',
  luna: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  pan: '<path d="M6 11a3.5 3.5 0 0 1 1-6.5h10A3.5 3.5 0 0 1 18 11v8a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z"/><path d="M10 9v2M14 9v2"/>',
  frasco: '<rect x="7" y="3" width="10" height="4" rx="1"/><path d="M6 7h12v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z"/><path d="M6 12h12"/>',
  botella: '<path d="M10 2h4v4l2 3v11a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V9l2-3z"/><path d="M8 13h8"/>',
  galleta: '<circle cx="12" cy="12" r="9"/><circle cx="9" cy="9" r=".8"/><circle cx="15" cy="10" r=".8"/><circle cx="10" cy="15" r=".8"/><circle cx="15" cy="15" r=".8"/>',
  frio: '<path d="M12 2v20M4 7l16 10M20 7L4 17"/><path d="M9 4l3 2 3-2M9 20l3-2 3 2"/>',
  bolsa: '<path d="M5 8h14l-1.4 12.2a1 1 0 0 1-1 .8H7.4a1 1 0 0 1-1-.8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  cubiertos: '<path d="M6 3v7a2 2 0 0 0 4 0V3M8 10v11M17 3c-2.5 2-2.5 7 0 9v9"/>',
  libro: '<path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z"/><path d="M20 4h-4a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h5z"/>',
  pin: '<path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
  estrella: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>',
  ticket: '<path d="M3 8a2 2 0 0 0 0 4v0a2 2 0 0 1 0 4v2h18v-2a2 2 0 0 1 0-4 2 2 0 0 1 0-4V6H3z"/><path d="M14 6v12" stroke-dasharray="2 2"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/>'
};
function icono(nombre, clase = "") {
  return `<svg class="ico ${clase}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${TRAZOS[nombre]}</svg>`;
}
const ICONO_MOMENTO = { Desayuno: "sol", Almuerzo: "bowl", Merienda: "taza", Cena: "luna" };
const ICONO_CATEGORIA = { Panificados: "pan", Almacén: "frasco", Bebidas: "botella", Snacks: "galleta", Refrigerados: "frio" };
const ICONO_LOCAL = { Panadería: "pan", Café: "taza", Dietética: "bolsa", Restaurante: "cubiertos" };
const iconoLocal = (l) => icono(ICONO_LOCAL[l.tipo] || "cubiertos");
const tonoLocal = (l) => (l.verificado ? "t-menta" : "t-tostado");

function tarjetaReceta(r) {
  return `<a class="tile" href="#/receta/${r.id}">
    <span class="visual ${TONO_MOMENTO[r.momento]}" >${icono(ICONO_MOMENTO[r.momento])}${sello(r)}</span>
    <span class="cuerpo"><h3>${r.nombre}</h3><span class="meta">${r.momento} · ${r.minutos} min</span></span></a>`;
}
function tarjetaProducto(p) {
  return `<a class="tile" href="#/producto/${p.id}">
    <span class="visual ${TONO_CATEGORIA[p.categoria] || "t-menta"}" >${icono(ICONO_CATEGORIA[p.categoria])}${sello(p)}</span>
    <span class="cuerpo"><h3>${p.nombre}</h3><span class="meta">${p.marca}</span><span class="precio">${pesos(p.precio)}</span></span></a>`;
}
function tarjetaLocal(l) {
  return `<a class="fila" href="#/local/${l.id}">
    <span class="icono ${tonoLocal(l)}" aria-hidden="true">${iconoLocal(l)}</span>
    <span class="cuerpo"><h3>${l.nombre}</h3><span class="meta">${l.tipo} · ${l.barrio} · ${estrellas(promedio(l.id, l.rating))}</span>
    ${l.verificado ? '<span class="sello verificado">Local verificado</span>' : '<span class="sello no-apto">Sin verificar</span>'}</span></a>`;
}

// Sello circular con texto que gira: el elemento distintivo de la marca
function selloGiratorio() {
  return `<div class="sello-giratorio" aria-hidden="true">
    <svg viewBox="0 0 150 150"><defs><path id="circulo" d="M75 75 m-60 0 a60 60 0 1 1 120 0 a60 60 0 1 1 -120 0"/></defs>
      <circle cx="75" cy="75" r="74" fill="#FFFFFF"/>
      <text font-family="Poppins, sans-serif" font-size="13" font-weight="700" fill="#0E2B27"><textPath href="#circulo" textLength="370" lengthAdjust="spacing">VERIFICADO · COMÉ SEGURO · SIN VUELTAS · </textPath></text>
    </svg>
    <span class="centro"><img src="${marca().mono}" alt=""></span>
  </div>`;
}

/* =========================================================
   PANTALLAS PÚBLICAS: landing y acceso
   ========================================================= */
function barraPublica() {
  return `<header class="topbar topbar-publica"><div class="barra-vidrio">
    <a class="logo-link" href="#/" data-accion="ir-bienvenida" aria-label="${marca().nombre}, ir al inicio"><img class="imagotipo" src="${marca().logo}" alt="Fintacc"></a>
    <nav class="menu ${ui.menuAbierto ? "abierto" : ""}" id="menu" aria-label="Secciones">
      <a href="#como-funciona" data-ancla>Cómo funciona</a><a href="#modulos" data-ancla>Qué encontrás</a><a href="#comercios" data-ancla>Para comercios</a>
      <a class="solo-movil" href="#" data-accion="ir-ingreso">Ingresar</a>
      <a class="solo-movil" href="#" data-accion="ir-registro">Crear cuenta</a>
    </nav>
    <div class="acciones-usuario">
      <button class="btn btn-secundario btn-chico" data-accion="ir-ingreso">Ingresar</button>
      <button class="btn btn-tinta btn-chico" data-accion="ir-registro">Crear cuenta</button>
      <button class="boton-menu" data-accion="menu" aria-expanded="${!!ui.menuAbierto}" aria-controls="menu" aria-label="Abrir menú">${iconoMenu()}</button>
    </div>
  </div></header>`;
}

function pantallaLanding() {
  const palabras = ["Sin TACC", "Locales verificados", "Recetas", "Productos", "Comunidad celíaca", "Puntos"];
  const review = REVIEWS[0];
  return `${barraPublica()}
  <main id="contenido">
    <section class="hero">
      <div class="hero-panel">
        <div>
          <h1 class="titular">Comé seguro,<br><span class="linea-2">sin vueltas.</span></h1>
          <p class="bajada">Recetas, productos y locales sin TACC verificados, en una sola plataforma pensada para personas celíacas.</p>
          <div class="fila-botones"><button class="btn btn-blanco" data-accion="ir-registro">Crear cuenta gratis</button><button class="btn btn-tinta" data-accion="ir-ingreso">Ingresar</button></div>
        </div>
        <div class="hero-tarjetas" aria-hidden="true">
          <div class="fila"><span class="icono t-menta">${icono("cubiertos")}</span><span class="cuerpo"><h3>Brote Cocina Verde</h3><span class="meta">Restaurante · Villa Crespo</span><span class="sello verificado">Local verificado</span></span></div>
          <div class="fila"><span class="icono t-menta">${icono("bowl")}</span><span class="cuerpo"><h3>Bowl de quinoa</h3><span class="meta">Almuerzo · 25 min</span><span class="sello">Sin TACC</span></span></div>
          <div class="fila"><span class="icono t-naranja">${icono("ticket")}</span><span class="cuerpo"><h3>+25 puntos</h3><span class="meta">Compra en Almacén Raíz</span></span></div>
        </div>
      </div>
      ${selloGiratorio()}
    </section>

    <div class="marquesina" aria-hidden="true"><div class="pista">${[...palabras, ...palabras].map((r) => `<span>${r}</span>`).join("")}</div></div>

    <section class="franja" id="como-funciona"><div class="contenedor">
      <div class="encabezado-franja"><h2>Cómo funciona</h2><p class="intro">Todo lo que ves en la plataforma es sin TACC. Vos solo elegís qué necesitás hoy.</p></div>
      <div class="linea-tiempo">
        <div class="hito"><span class="numero">01</span><h3>Creá tu cuenta</h3><p class="suave">En un minuto y gratis. Recibís 50 puntos de bienvenida.</p></div>
        <div class="hito"><span class="numero">02</span><h3>Encontrá lo sin TACC</h3><p class="suave">Recetas, productos y locales verificados, sin tener que preguntar diez veces.</p></div>
        <div class="hito"><span class="numero">03</span><h3>Sumá puntos</h3><p class="suave">Cada compra en un comercio aliado suma puntos que canjeás por descuentos.</p></div>
      </div>
    </div></section>

    <section class="franja" id="modulos" style="padding-top:0"><div class="contenedor">
      <div class="encabezado-franja"><h2>Todo en un solo lugar</h2><p class="intro">Cinco servicios conectados para que dejes de buscar en mil sitios distintos.</p></div>
      <div class="bento">
        <div class="bloque ancho alto teal"><span class="flecha" aria-hidden="true">↗</span>${icono("pin", "ico-bloque")}<p class="grande">Locales verificados</p><p>Restaurantes, cafés y dietéticas que cuidan la contaminación cruzada, con sello de verificación y menú sin TACC.</p></div>
        <div class="bloque naranja">${icono("libro", "ico-bloque")}<h3>Recetas</h3><p>Sin TACC, paso a paso y con información nutricional.</p></div>
        <div class="bloque tostado">${icono("bolsa", "ico-bloque")}<h3>Productos</h3><p>Qué comprar, a qué precio y dónde conseguirlo.</p></div>
        <div class="bloque menta">${icono("chat", "ico-bloque")}<h3>Comunidad</h3><p>Reviews de otras personas celíacas.</p></div>
        <div class="bloque marron">${icono("estrella", "ico-bloque")}<h3>Puntos</h3><p>Descuentos en comercios aliados con código QR.</p></div>
      </div>
    </div></section>

    <section class="franja" style="padding-top:0"><div class="contenedor">
      <figure class="cita"><span class="comillas" aria-hidden="true">“</span>
        <div><blockquote>${review.texto}</blockquote><figcaption class="suave" style="margin-top:16px">${review.autor} · Brote Cocina Verde</figcaption></div>
      </figure>
    </div></section>

    <section class="franja" id="comercios" style="padding-top:0"><div class="contenedor">
      <div class="comercios">
        <div><h2>¿Tenés un comercio apto?</h2><p>Sumate a la red de comercios aliados y llegá a clientes que buscan exactamente lo que ofrecés.</p></div>
        <div><ul><li>Sello de local verificado</li><li>Visibilidad en el mapa de la plataforma</li><li>Clientes fieles con el sistema de puntos</li></ul>
        <button class="btn btn-naranja" data-accion="aviso-comercios">Quiero ser aliado</button></div>
      </div>
    </div></section>
  </main>${pie()}`;
}

function panelMarca(titulo, texto) {
  return `<div class="panel-marca"><img src="${marca().mono}" alt=""><div><h2>${titulo}</h2><p style="margin-top:16px">${texto}</p></div></div>`;
}

function pantallaAcceso() {
  const paso = ui.onboarding;
  if (paso === "registro" || paso === "ingreso") {
    const registro = paso === "registro";
    const e = ui.borrador.errores || {};
    return `${barraPublica()}<main class="acceso" id="contenido">
      ${panelMarca(registro ? "Tu alimentación, simplificada." : "Qué bueno verte de nuevo.", registro ? "Creá tu cuenta y recibí 50 puntos de bienvenida." : "Ingresá para seguir encontrando lo sin TACC.")}
      <div class="formulario">
        <button class="volver" data-accion="ir-bienvenida" style="margin:0">← Volver</button>
        <h1>${registro ? "Creá tu cuenta" : "Ingresá"}</h1>
        <form id="form-cuenta" novalidate>
          ${registro ? `<div class="campo"><label for="nombre">Nombre</label><input id="nombre" name="nombre" autocomplete="given-name" value="${escapar(ui.borrador.nombre || "")}">${e.nombre ? `<span class="error">${e.nombre}</span>` : ""}</div>` : ""}
          <div class="campo"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email" value="${escapar(ui.borrador.email || "")}">${e.email ? `<span class="error">${e.email}</span>` : ""}</div>
          <div class="campo"><label for="clave">Contraseña</label><input id="clave" name="clave" type="password" autocomplete="${registro ? "new-password" : "current-password"}">${e.clave ? `<span class="error">${e.clave}</span>` : ""}</div>
          ${e.general ? `<p class="error" role="alert">${escapar(e.general)}</p>` : ""}
          <button class="btn btn-ancho" type="submit">${registro ? "Crear cuenta" : "Ingresar"}</button>
        </form>
        <p class="suave chico">${registro ? '¿Ya tenés cuenta? <a href="#" data-accion="ir-ingreso" style="color:var(--teal);font-weight:600">Ingresá</a>' : '¿No tenés cuenta? <a href="#" data-accion="ir-registro" style="color:var(--teal);font-weight:600">Creala gratis</a>'}</p>
      </div>
    </main>`;
  }
}

/* =========================================================
   PANTALLAS CON SESIÓN
   ========================================================= */
function pantallaInicio() {
  const recetas = RECETAS;
  const productos = PRODUCTOS;
  const locales = LOCALES.filter((l) => l.verificado);
  const sig = siguienteNivel();
  return layout("inicio", `
    <section class="bento">
      <div class="bloque ancho tinta">
        <p class="chico" style="opacity:.7">Todo sin TACC, todo verificado</p>
        <p class="saludo-grande">Hola, ${escapar(estado.usuario.nombre)}.</p>
        <p>Esto es lo que encontramos para vos hoy.</p>
      </div>
      <a class="bloque ancho teal" href="#/puntos"><span class="flecha" aria-hidden="true">↗</span>
        <p class="chico">Tus puntos · nivel ${nivelActual().nombre}</p>
        <p class="grande">${estado.puntos}</p>
        ${sig ? `<div class="barra"><span style="width:${Math.min(100, (estado.puntosGanados / sig.desde) * 100)}%"></span></div><p class="chico">Te faltan ${sig.desde - estado.puntosGanados} para el nivel ${sig.nombre}</p>` : '<p class="chico">Llegaste al nivel más alto</p>'}
      </a>
      <a class="bloque naranja" href="#/recetas"><span class="flecha" aria-hidden="true">↗</span><p class="grande">${recetas.length}</p><h3>recetas sin TACC</h3></a>
      <a class="bloque menta" href="#/locales"><span class="flecha" aria-hidden="true">↗</span><p class="grande">${locales.length}</p><h3>locales verificados</h3></a>
      <a class="bloque tostado" href="#/productos"><span class="flecha" aria-hidden="true">↗</span><p class="grande">${productos.length}</p><h3>productos sin TACC</h3></a>
      <a class="bloque marron" href="#/puntos"><span class="flecha" aria-hidden="true">↗</span><p class="grande">${estado.cupones.length}</p><h3>cupones activos</h3></a>
    </section>
    <section class="seccion"><div class="seccion-titulo"><h2>Recetas para vos</h2><a href="#/recetas">Ver todas</a></div>
      ${recetas.length ? `<div class="grilla">${recetas.slice(0, 4).map(tarjetaReceta).join("")}</div>` : vacio("Sin recetas por ahora", "Pronto vamos a sumar más recetas.")}
    </section>
    <section class="seccion"><div class="seccion-titulo"><h2>Locales verificados</h2><a href="#/locales">Ver todos</a></div>
      ${locales.length ? `<div class="grilla filas">${locales.map(tarjetaLocal).join("")}</div>` : vacio("Sin locales por ahora", "Todavía no hay locales verificados en tu zona.")}
    </section>`);
}

function barraFiltros(placeholder, opciones, actual, accion) {
  return `<div class="barra-filtros">
    <input class="buscador" type="search" placeholder="${placeholder}" aria-label="${placeholder}" data-busqueda value="${escapar(ui.busqueda)}">
    <div class="chips" role="group" aria-label="Filtros">${opciones.map((o) => `<button class="chip" data-accion="${accion}" data-valor="${o}" aria-pressed="${actual === o}">${o}</button>`).join("")}</div>
  </div>`;
}

function pantallaRecetas() {
  const q = ui.busqueda.toLowerCase();
  const lista = RECETAS.filter((r) => (ui.filtroMomento === "Todas" || r.momento === ui.filtroMomento) && r.nombre.toLowerCase().includes(q));
  return layout("recetas", `
    <div class="cabecera-pagina"><h1>Recetas</h1><span class="contador">${lista.length} ${lista.length === 1 ? "resultado" : "resultados"}</span></div>
    ${barraFiltros("Buscar receta", ["Todas", "Desayuno", "Almuerzo", "Merienda", "Cena"], ui.filtroMomento, "filtro-momento")}
    <div class="grilla">${lista.length ? lista.map(tarjetaReceta).join("") : vacio("No encontramos recetas", "Probá con otra búsqueda o cambiá el filtro.")}</div>`);
}

function pantallaReceta(id) {
  const r = RECETAS.find((x) => x.id === id);
  if (!r) return pantallaNoEncontrada();
  const n = r.nutricion;
  return layout("recetas", `${volver("#/recetas", "Recetas")}
    <section class="detalle-hero ${TONO_MOMENTO[r.momento]}">
      <div>${sello(r)}<h1>${r.nombre}</h1><div class="chips"><span class="etiqueta">${r.momento}</span><span class="etiqueta">${r.minutos} min</span></div></div>
      <span class="icono-gigante">${icono(ICONO_MOMENTO[r.momento])}</span>
    </section>
    <div class="detalle">
      <div class="caja"><h2>Ingredientes</h2><p class="suave chico">Tocá cada uno a medida que lo tengas listo.</p>
        <ul class="checklist">${r.ingredientes.map((i, k) => `<li><input type="checkbox" id="ing${k}" data-accion="ingrediente"><label for="ing${k}"><span>${i}</span></label></li>`).join("")}</ul>
      </div>
      <aside>
        <div class="caja"><h2>Información nutricional</h2><p class="suave chico">Por porción</p>
          <div class="datos"><div class="dato"><strong>${n.calorias}</strong>kcal</div><div class="dato"><strong>${n.proteinas} g</strong>Proteínas</div><div class="dato"><strong>${n.carbohidratos} g</strong>Carbohidratos</div><div class="dato"><strong>${n.grasas} g</strong>Grasas</div></div>
        </div>
        <div class="caja"><div class="datos" style="margin:0"><div class="dato"><strong>${r.minutos} min</strong>Tiempo</div><div class="dato"><strong>${r.porciones}</strong>Porciones</div></div></div>
        <button class="btn btn-tinta btn-ancho" data-accion="abrir-pasos" data-id="${r.id}">Cocinar paso a paso</button>
      </aside>
    </div>`);
}

function pantallaProductos() {
  const categorias = ["Todas", ...new Set(PRODUCTOS.map((p) => p.categoria))];
  const q = ui.busqueda.toLowerCase();
  const lista = PRODUCTOS.filter((p) => (ui.categoria === "Todas" || p.categoria === ui.categoria) && (p.nombre + " " + p.marca).toLowerCase().includes(q));
  return layout("productos", `
    <div class="cabecera-pagina"><h1>Productos</h1><span class="contador">${lista.length} ${lista.length === 1 ? "resultado" : "resultados"}</span></div>
    ${barraFiltros("Buscar producto o marca", categorias, ui.categoria, "filtro-categoria")}
    <div class="grilla">${lista.length ? lista.map(tarjetaProducto).join("") : vacio("No encontramos productos", "Probá con otra búsqueda o cambiá el filtro.")}</div>`);
}

function pantallaProducto(id) {
  const p = PRODUCTOS.find((x) => x.id === id);
  if (!p) return pantallaNoEncontrada();
  const donde = LOCALES.filter((l) => p.locales.includes(l.id));
  return layout("productos", `${volver("#/productos", "Productos")}
    <section class="detalle-hero ${TONO_CATEGORIA[p.categoria] || "t-menta"}">
      <div>${sello(p)}<h1>${p.nombre}</h1><p class="suave" style="margin-bottom:12px">${p.marca} · ${p.categoria}</p><div class="chips"><span class="etiqueta">Libre de gluten</span><span class="etiqueta">Con registro RNPA</span></div></div>
      <span class="icono-gigante">${icono(ICONO_CATEGORIA[p.categoria])}</span>
    </section>
    <div class="detalle">
      <div>${seccionReviews(p.id)}</div>
      <aside>
        <div class="caja"><p class="suave chico">Precio de referencia</p><p class="precio" style="font-size:2.6rem;letter-spacing:-.03em">${pesos(p.precio)}</p></div>
        <div><h2 style="margin-bottom:14px">Dónde comprarlo</h2><div class="lista">${donde.map(tarjetaLocal).join("")}</div></div>
      </aside>
    </div>`);
}

function pantallaLocales() {
  const lista = LOCALES;
  const vista = ui.vistaLocales;
  return layout("locales", `
    <div class="cabecera-pagina"><h1>Locales</h1><div class="fila-botones" style="align-items:center">
      <div class="selector-vista solo-movil" role="group" aria-label="Cambiar vista">
        <button data-accion="vista-locales" data-valor="lista" aria-pressed="${vista === "lista"}">Lista</button>
        <button data-accion="vista-locales" data-valor="mapa" aria-pressed="${vista === "mapa"}">Mapa</button>
      </div></div></div>
    <div class="locales-vista">
      <div class="${vista === "mapa" ? "solo-escritorio" : ""}"><div class="lista">${lista.length ? lista.map(tarjetaLocal).join("") : vacio("No hay locales cargados", "Pronto vamos a sumar más locales.")}</div></div>
      <div class="${vista === "lista" ? "solo-escritorio" : ""}">${mapa(lista)}</div>
    </div>`);
}

// Mapa de CABA con OpenStreetMap y Leaflet.
function mapa(lista) {
  return `<div id="mapa-leaflet" class="mapa mapa-leaflet" role="application" aria-label="Mapa de locales sin TACC"></div>
  <button class="btn btn-secundario" data-accion="geolocalizar" style="margin-top:10px">Usar mi ubicación</button>
  <p class="suave chico" style="margin-top:8px">Mapa de OpenStreetMap. La ubicación se solicita solo cuando tocás el botón.</p>`;
}

function iniciarMapa() {
  const el = document.getElementById("mapa-leaflet");
  if (!el || !window.L) return;
  const map = L.map(el).setView([-34.6037, -58.435], 11);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap" }).addTo(map);
  const coords = { raiz:[-34.588,-58.421], brote:[-34.599,-58.436], masamadre:[-34.562,-58.456], lacuchara:[-34.587,-58.397], verdeurquiza:[-34.571,-58.488], centro:[-34.603,-58.378] };
  LOCALES.forEach(l => { const point=coords[l.id]; if(point) L.marker(point).addTo(map).bindPopup(`<a href="#/local/${l.id}"><strong>${escapar(l.nombre)}</strong></a><br>${escapar(l.barrio)}${l.verificado ? " · Verificado" : ""}`); });
  window._fintaccMap = map;
  setTimeout(()=>map.invalidateSize(),120);
}

function pantallaLocal(id) {
  const l = LOCALES.find((x) => x.id === id);
  if (!l) return pantallaNoEncontrada();
  const menu = l.menu;
  return layout("locales", `${volver("#/locales", "Locales")}
    <section class="detalle-hero ${tonoLocal(l)}">
      <div>${l.verificado ? '<span class="sello verificado">Local verificado</span>' : '<span class="sello no-apto">Sin verificar</span>'}
        <h1>${l.nombre}</h1><p class="suave">${l.tipo} · ${l.barrio} · ${estrellas(promedio(l.id, l.rating))}</p></div>
      <span class="icono-gigante">${iconoLocal(l)}</span>
    </section>
    <div class="detalle">
      <div style="display:flex;flex-direction:column;gap:16px">
        ${l.menu.length ? `<div class="caja"><h2>Menú sin TACC</h2>${menu.length ? `<ul class="checklist">${menu.map((m) => `<li><span class="tilde" aria-hidden="true">✓</span><span>${m.plato}</span></li>`).join("")}</ul>` : '<p class="suave" style="margin-top:6px">Este local todavía no cargó su menú.</p>'}</div>` : ""}
        ${seccionReviews(l.id)}
      </div>
      <aside>
        <div class="caja"><div class="datos" style="margin:0"><div class="dato"><strong style="font-size:1rem">Dirección</strong>${l.direccion}</div><div class="dato"><strong style="font-size:1rem">Horario</strong>${l.horario}</div></div></div>
        ${l.verificado ? `<div class="caja"><h2>Qué verificamos</h2><ul class="checklist">${l.verificacion.map((v) => `<li><span class="tilde" aria-hidden="true">✓</span><span>${v}</span></li>`).join("")}</ul></div>` :
          '<div class="caja"><h2>Todavía no lo verificamos</h2><p class="suave" style="margin-top:6px">Consultá en el local cómo evitan la contaminación cruzada antes de pedir.</p></div>'}
        ${l.verificado ? `<button class="btn btn-naranja btn-ancho" data-accion="abrir-compra" data-id="${l.id}">Sumar puntos en este local</button>` : ""}
      </aside>
    </div>`);
}

/* ---------- Comunidad: reviews en locales y productos ---------- */
function seccionReviews(id) {
  const lista = reviewsDe(id);
  return `<section class="caja">
    <h2>Comunidad</h2>
    ${lista.length ? lista.map((r) => `<div class="review"><p><strong>${escapar(r.autor)}</strong></p>${estrellas(r.estrellas)}<p style="margin-top:4px">${escapar(r.texto)}</p></div>`).join("") : '<p class="suave" style="margin:8px 0">Todavía no hay reviews. Sé la primera persona en opinar.</p>'}
    <button class="btn btn-secundario btn-ancho" style="margin-top:14px" data-accion="abrir-review" data-id="${id}">Escribir una review</button>
  </section>`;
}

function pantallaPuntos() {
  const actual = nivelActual().nombre;
  return layout("puntos", `
    <div class="cabecera-pagina"><h1>Tus puntos</h1></div>
    <section class="puntos-hero">
      <div><p class="chico" style="opacity:.8">Saldo disponible</p><p class="numero-gigante">${estado.puntos}</p></div>
      <div>
        <div class="niveles" aria-label="Niveles">${NIVELES.map((n) => `<div class="nivel ${estado.puntosGanados >= n.desde ? "logrado" : ""} ${n.nombre === actual ? "actual" : ""}">${n.nombre}<small>desde ${n.desde} pts</small></div>`).join("")}</div>
        <p class="chico" style="margin-top:24px;opacity:.85">Sumás 1 punto cada ${pesos(PESOS_POR_PUNTO)} en comercios aliados. Los puntos no vencen.</p>
        <button class="btn btn-naranja" style="margin-top:16px" data-accion="abrir-compra">Registrar una compra</button>
      </div>
    </section>
    <div class="dos-columnas seccion">
      <section><h2 style="margin-bottom:16px">Canjeá tus puntos</h2><div class="lista">
        ${CANJES.map((c) => `<div class="canje"><span class="monto">${pesos(c.descuento)}<small>de descuento</small></span><span class="cuerpo"><h3>${c.puntos} puntos</h3><span class="suave chico">En cualquier comercio aliado</span></span>
          <button class="btn btn-chico" data-accion="canjear" data-id="${c.id}" ${estado.puntos < c.puntos ? "disabled" : ""}>Canjear</button></div>`).join("")}
        ${estado.cupones.length ? `<h2 style="margin:24px 0 4px">Tus cupones</h2>${estado.cupones.map((c) => `<button class="canje" data-accion="ver-cupon" data-codigo="${c.codigo}"><span class="monto">${pesos(c.descuento)}</span><span class="cuerpo"><h3>Código ${c.codigo}</h3><span class="suave chico">Tocá para ver el QR</span></span></button>`).join("")}` : ""}
      </div></section>
      <section class="caja"><h2>Historial</h2>
        ${estado.historial.length ? estado.historial.map((h) => `<div class="movimiento"><span><strong>${h.detalle}</strong><br><span class="suave chico">${h.fecha || (h.date ? new Date(h.date).toLocaleDateString("es-AR") : "")}</span></span><strong style="color:${h.puntos > 0 ? "var(--teal)" : "var(--marron)"}">${h.puntos > 0 ? "+" : ""}${h.puntos}</strong></div>`).join("") : '<p class="suave" style="margin-top:6px">Todavía no tenés movimientos.</p>'}
      </section>
    </div>`);
}

function pantallaPerfil() {
  return layout("perfil", `<div class="estrecho">
    <div class="cabecera-pagina"><h1>${escapar(estado.usuario.nombre)}</h1><span class="contador">${escapar(estado.usuario.email)}</span></div>
    <section class="caja"><h2>Fintacc</h2>
      <p class="suave chico" style="margin:4px 0 14px">Tu alimentación, simplificada.</p>
      <img src="${MARCAS.fintacc.logo}" alt="Fintacc" style="width:min(280px,100%);height:auto">
    </section>
    ${estado.usuario.role === "merchant" ? '<a class="btn" href="#/comercio" style="margin-top:16px">Panel de comercio</a>' : ''}
    <section class="fila-botones" style="margin-top:24px"><button class="btn btn-secundario" data-accion="cerrar-sesion">Cerrar sesión</button></section>
  </div>`);
}

function pantallaComercio() {
  if(estado.usuario.role!=="merchant") return pantallaNoEncontrada();
  return layout("",`<div class="cabecera-pagina"><h1>Panel de comercio</h1><button class="btn btn-secundario" data-accion="actualizar-compras">Actualizar</button></div><section id="qr-cajas" class="dos-columnas seccion"></section><h2 style="margin:24px 0 12px">Compras por validar</h2><div id="compras-pendientes" class="lista"><p class="suave">Cargando…</p></div>`);
}

async function cargarComprasPendientes() {
  const box=document.getElementById("compras-pendientes"); if(!box)return;
  try {
    const [items,stores]=await Promise.all([api("/merchant/purchases"),api("/merchant/stores")]);
    const qrBox=document.getElementById("qr-cajas"); if(qrBox){qrBox.innerHTML=stores.map((s,i)=>`<article class="caja"><h2>${escapar(s.name)} · QR de caja</h2><div class="qr" id="qr-caja-${i}"></div><p class="codigo">${escapar(s.qr_token)}</p></article>`).join("");stores.forEach((s,i)=>{if(window.qrcode){const qr=qrcode(0,"M");qr.addData(s.qr_token);qr.make();const target=document.getElementById(`qr-caja-${i}`);target.innerHTML=qr.createSvgTag({cellSize:5,margin:0,scalable:true});target.querySelector("svg").style="width:180px;height:180px";}});}
    box.innerHTML=items.length?items.map(p=>`<form class="caja formulario-validacion" data-compra="${p.id}"><h2>${escapar(p.store)} · ${pesos(p.amount)}</h2><p class="suave">Compra ${p.id} · ${p.points} puntos potenciales</p><div class="campo"><label>Número de ticket</label><input name="receipt" required minlength="4" placeholder="Ej: A-001-000123" /></div><button class="btn">Validar compra</button></form>`).join(""):'<div class="vacio"><strong>No hay compras pendientes</strong>Las compras escaneadas aparecerán acá durante 24 horas.</div>';
  }
  catch(error){box.innerHTML=`<p class="error">${escapar(error.message)}</p>`;}
}

function pantallaNoEncontrada() {
  return layout("", `${volver("#/", "Inicio")}${vacio("No encontramos esta página", "Volvé al inicio para seguir navegando.")}`);
}

/* =========================================================
   MODALES: paso a paso, compra con QR, canje y review
   ========================================================= */
function abrirModal(html) {
  cerrarModal();
  const fondo = document.createElement("div");
  fondo.className = "modal-fondo";
  fondo.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
  fondo.addEventListener("click", (e) => { if (e.target === fondo || e.target.closest("[data-cerrar]")) cerrarModal(); });
  document.body.appendChild(fondo);
  fondo.querySelector("button, input, select, textarea")?.focus();
  return fondo;
}
function cerrarModal() { document.querySelector(".modal-fondo")?.remove(); }

function modalPasos(receta) {
  const total = receta.pasos.length;
  const i = ui.paso;
  const fondo = abrirModal(`
    <h2>${receta.nombre}</h2>
    <div class="paso-a-paso">
      <div class="numero-paso">${i + 1}<span class="suave" style="font-size:1rem"> / ${total}</span></div>
      <p>${receta.pasos[i]}</p>
      <div class="fila-botones">
        <button class="btn btn-secundario" data-paso="-1" ${i === 0 ? "disabled" : ""}>Anterior</button>
        ${i < total - 1 ? '<button class="btn" data-paso="1">Siguiente</button>' : '<button class="btn" data-cerrar>Terminar</button>'}
      </div>
    </div>`);
  fondo.querySelectorAll("[data-paso]").forEach((b) => b.addEventListener("click", () => { ui.paso += Number(b.dataset.paso); modalPasos(receta); }));
}

function modalCompra(localId) {
  const aliados = LOCALES.filter((l) => l.verificado);
  const fondo = abrirModal(`
    <h2>Registrar una compra</h2>
    <p class="suave" style="margin:6px 0 16px">Escaneá el QR de la caja y cargá el monto. El comercio valida el ticket antes de acreditar puntos.</p>
    <video id="camara-qr" playsinline style="display:none;width:100%;border-radius:16px;margin-bottom:12px"></video>
    <button class="btn btn-secundario btn-ancho" type="button" id="iniciar-escaneo">Escanear QR con la cámara</button>
    <form id="form-compra" novalidate>
      <div class="campo"><label for="local">Comercio aliado</label>
        <select id="local" name="local">${aliados.map((l) => `<option value="${l.id}" ${l.id === localId ? "selected" : ""}>${l.nombre}</option>`).join("")}</select></div>
      <div class="campo"><label for="monto">Monto de la compra ($)</label><input id="monto" name="monto" type="number" min="1000" step="100" inputmode="numeric" placeholder="Ej: 25000"><span class="error" id="error-monto"></span></div>
      <div class="campo"><label for="qr-token">Código QR del comercio</label><input id="qr-token" name="qr-token" placeholder="FINTACC-STORE-RAIZ" required><span class="error" id="error-qr"></span></div>
      <p class="suave chico" id="preview-puntos" style="margin-bottom:16px">Vas a sumar 0 puntos.</p>
      <button class="btn btn-ancho" type="submit">Escanear y validar</button>
    </form>`);
  const monto = fondo.querySelector("#monto");
  const camera = fondo.querySelector("#camara-qr"); let stream;
  fondo.querySelector("#iniciar-escaneo").addEventListener("click", async () => {
    try {
      if (!("BarcodeDetector" in window)) throw new Error("Este navegador no permite leer QR con la cámara. Ingresá el código impreso.");
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }); camera.srcObject=stream; camera.style.display="block"; await camera.play();
      const detector=new BarcodeDetector({formats:["qr_code"]});
      const scan=async()=>{if(!camera.isConnected)return;const hits=await detector.detect(camera);if(hits.length){const token=hits[0].rawValue;fondo.querySelector("#qr-token").value=token;const suffix=token.replace("FINTACC-STORE-","").toLowerCase();const option=[...fondo.querySelector("#local").options].find(o=>o.value===suffix);if(option)fondo.querySelector("#local").value=option.value;stream.getTracks().forEach(t=>t.stop());avisar("QR leído");}else requestAnimationFrame(scan);}; scan();
    } catch(error) { avisar(error.message || "No se pudo abrir la cámara"); }
  });
  monto.addEventListener("input", () => {
    fondo.querySelector("#preview-puntos").textContent = `Vas a sumar ${Math.floor((Number(monto.value) || 0) / PESOS_POR_PUNTO)} puntos.`;
  });
  fondo.querySelector("#form-compra").addEventListener("submit", (e) => {
    e.preventDefault();
    const valor = Number(monto.value);
    if (!valor || valor < PESOS_POR_PUNTO) {
      fondo.querySelector("#error-monto").textContent = `Ingresá un monto de al menos ${pesos(PESOS_POR_PUNTO)}.`;
      return;
    }
    const local=fondo.querySelector("#local").value, qrToken=fondo.querySelector("#qr-token").value.trim();
    if(!qrToken){fondo.querySelector("#error-qr").textContent="Escaneá el QR o ingresá el código de la caja.";return;}
    api("/purchases",{method:"POST",body:JSON.stringify({store:local,qr_token:qrToken,amount:valor})}).then(()=>{stream?.getTracks().forEach(t=>t.stop());cerrarModal();avisar("Compra enviada. Los puntos se acreditan al validar el ticket.");}).catch(err=>fondo.querySelector("#error-qr").textContent=err.message);
  });
}

// Muestra el cupón como código QR para escanear en la caja
function modalCupon(cupon) {
  abrirModal(`
    <h2>${pesos(cupon.descuento)} de descuento</h2>
    <p class="suave" style="margin-top:6px">Mostrá este código en la caja del comercio aliado.</p>
    <div class="qr" id="qr"></div>
    <p class="codigo">${cupon.codigo}</p>
    <button class="btn btn-ancho" style="margin-top:20px" data-cerrar>Listo</button>`);
  const contenedor = document.getElementById("qr");
  if (window.qrcode) {
    // Librería qrcode-generator (js/vendor/qrcode.js)
    const qr = qrcode(0, "M");
    qr.addData(`CANJE:${cupon.codigo}:${cupon.descuento}`);
    qr.make();
    contenedor.innerHTML = qr.createSvgTag({ cellSize: 6, margin: 0, scalable: true });
    contenedor.querySelector("svg").setAttribute("style", "width:200px;height:200px");
  } else {
    contenedor.textContent = "No se pudo generar el QR. Usá el código de abajo.";
  }
}

function modalReview(id) {
  ui.estrellas = 0;
  const fondo = abrirModal(`
    <h2>Escribir una review</h2>
    <form id="form-review" novalidate style="margin-top:14px">
      <div class="campo"><span style="font-weight:600;font-size:.9rem">Tu puntuación</span>
        <div class="selector-estrellas" role="group" aria-label="Puntuación">${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-estrella="${n}" aria-label="${n} estrellas" aria-pressed="false">★</button>`).join("")}</div></div>
      <div class="campo"><label for="texto">Tu experiencia</label><textarea id="texto" rows="4" placeholder="¿Cómo te fue? ¿Te sentiste segura/o?"></textarea><span class="error" id="error-review"></span></div>
      <button class="btn btn-ancho" type="submit">Publicar review</button>
    </form>`);
  fondo.querySelectorAll("[data-estrella]").forEach((b) => b.addEventListener("click", () => {
    ui.estrellas = Number(b.dataset.estrella);
    fondo.querySelectorAll("[data-estrella]").forEach((x) => x.setAttribute("aria-pressed", Number(x.dataset.estrella) <= ui.estrellas));
  }));
  fondo.querySelector("#form-review").addEventListener("submit", async (e) => {
    e.preventDefault();
    const texto = fondo.querySelector("#texto").value.trim();
    if (!ui.estrellas || texto.length < 10) {
      fondo.querySelector("#error-review").textContent = "Elegí una puntuación y escribí al menos 10 caracteres.";
      return;
    }
    try { await api("/reviews",{method:"POST",body:JSON.stringify({target:id,stars:ui.estrellas,text:texto})}); estado.reviews.unshift({ objetivo:id,autor:estado.usuario.nombre,estrellas:ui.estrellas,texto }); cerrarModal(); render(); avisar("Review publicada"); }
    catch(error){fondo.querySelector("#error-review").textContent=error.message;}
  });
}

function modalAltaComercio() {
  const fondo=abrirModal(`<h2>Sumá tu comercio</h2><p class="suave" style="margin:6px 0 16px">Dejanos tus datos para solicitar el alta en la red Fintacc.</p><form id="form-comercio"><div class="campo"><label>Nombre del comercio</label><input name="name" required></div><div class="campo"><label>Email de contacto</label><input name="email" type="email" required></div><div class="campo"><label>Tipo de comercio</label><select name="type" required><option value="">Elegí una opción</option><option>Dietética</option><option>Restaurante</option><option>Panadería</option><option>Café</option><option>Otro</option></select></div><div class="campo"><label>Dirección</label><input name="address" required></div><p class="error" id="error-comercio"></p><button class="btn btn-ancho">Enviar solicitud</button></form>`);
  fondo.querySelector("#form-comercio").addEventListener("submit",async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.target));try{await api("/merchants",{method:"POST",body:JSON.stringify(data)});cerrarModal();avisar("Solicitud enviada. Vamos a revisar los datos del comercio.");}catch(error){fondo.querySelector("#error-comercio").textContent=error.message;}});
}

/* =========================================================
   ACCIONES (delegación de eventos)
   ========================================================= */
app.addEventListener("click", async (e) => {
  // Links a secciones de la landing: scroll suave sin cambiar de pantalla
  const ancla = e.target.closest("[data-ancla]");
  if (ancla) {
    e.preventDefault();
    ui.menuAbierto = false;
    // Si estamos en registro o ingreso, primero volvemos a la landing
    if (ui.onboarding !== "bienvenida") { ui.onboarding = "bienvenida"; render(); }
    document.querySelector(ancla.getAttribute("href"))?.scrollIntoView({ behavior: "smooth" });
    document.getElementById("menu")?.classList.remove("abierto");
    return;
  }
  const el = e.target.closest("[data-accion]");
  if (!el) return;
  if (el.tagName === "A") e.preventDefault();
  const { accion, id, valor } = el.dataset;

  switch (accion) {
    case "menu": ui.menuAbierto = !ui.menuAbierto; break;
    case "ir-registro": ui.onboarding = "registro"; ui.borrador = {}; ui.menuAbierto = false; window.scrollTo(0, 0); break;
    case "ir-ingreso": ui.onboarding = "ingreso"; ui.borrador = {}; ui.menuAbierto = false; window.scrollTo(0, 0); break;
    case "ir-bienvenida": ui.onboarding = "bienvenida"; ui.menuAbierto = false; window.scrollTo(0, 0); break;
    case "aviso-comercios": modalAltaComercio(); return;
    case "geolocalizar":
      if(!navigator.geolocation){avisar("La geolocalización no está disponible en este navegador.");return;}
      navigator.geolocation.getCurrentPosition(pos=>window._fintaccMap?.setView([pos.coords.latitude,pos.coords.longitude],14),()=>avisar("No se pudo acceder a tu ubicación."),{enableHighAccuracy:true,timeout:10000}); return;
    case "actualizar-compras": cargarComprasPendientes(); return;
    case "filtro-momento": ui.filtroMomento = valor; break;
    case "filtro-categoria": ui.categoria = valor; break;
    case "vista-locales": ui.vistaLocales = valor; break;
    case "ingrediente": el.closest("li").classList.toggle("tachado", el.checked); return;
    case "abrir-pasos": ui.paso = 0; modalPasos(RECETAS.find((r) => r.id === id)); return;
    case "abrir-compra": modalCompra(id); return;
    case "abrir-review": modalReview(id); return;
    case "canjear": {
      const canje = CANJES.find((c) => c.id === id);
      if (estado.puntos < canje.puntos) return;
      try { const cupon=await api("/coupons",{method:"POST",body:JSON.stringify({points:canje.puntos})}); estado.puntos-=canje.puntos; estado.cupones.unshift(cupon); estado.historial.unshift({detalle:`Canje de ${pesos(canje.descuento)}`,puntos:-canje.puntos,fecha:new Date().toLocaleDateString("es-AR")}); render(); modalCupon(cupon); } catch(error){avisar(error.message);} return;
    }
    case "ver-cupon": modalCupon(estado.cupones.find((c) => c.codigo === el.dataset.codigo)); return;
    case "cerrar-sesion":
      try { await api("/auth/logout",{method:"POST"}); } catch (_) {}
      estado = { ...estadoInicial(), marca: estado.marca }; ui.onboarding = "bienvenida"; guardarEstado(); location.hash = ""; break;
    default: return;
  }
  render();
});

// Búsqueda en vivo: actualiza la lista sin perder el foco del input
app.addEventListener("input", (e) => {
  if (!e.target.matches("[data-busqueda]")) return;
  ui.busqueda = e.target.value;
  const posicion = e.target.selectionStart;
  render();
  const input = $("[data-busqueda]");
  input.focus();
  input.setSelectionRange(posicion, posicion);
});

// Formulario de registro / ingreso con validación
app.addEventListener("submit", async (e) => {
  const compra=e.target.closest("[data-compra]");
  if(compra){e.preventDefault();const submit=compra.querySelector("button[type=submit],button:not([type])");if(submit)submit.disabled=true;try{const receipt=new FormData(compra).get("receipt");const result=await api(`/merchant/purchases/${compra.dataset.compra}/confirm`,{method:"POST",body:JSON.stringify({receipt})});avisar(`Compra validada: ${result.points} puntos acreditados.`);await cargarComprasPendientes();}catch(error){if(submit)submit.disabled=false;avisar(error.message);}return;}
  if (e.target.id !== "form-cuenta") return;
  e.preventDefault();
  const datos = Object.fromEntries(new FormData(e.target));
  const registro = ui.onboarding === "registro";
  const errores = {};
  if (registro && !datos.nombre.trim()) errores.nombre = "Ingresá tu nombre.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.email)) errores.email = "Ingresá un email válido, por ejemplo nombre@mail.com.";
  if ((datos.clave || "").length < 8) errores.clave = "La contraseña debe tener al menos 8 caracteres.";
  ui.borrador = { ...ui.borrador, nombre: datos.nombre, email: datos.email, errores };
  if (Object.keys(errores).length) { render(); return; }

  try {
    const result=await api(`/auth/${registro?"register":"login"}`,{method:"POST",body:JSON.stringify({name:(datos.nombre||"").trim(),email:datos.email,password:datos.clave})});
    if(result.needsConfirmation){ui.borrador={...ui.borrador,errores:{general:"Te enviamos un email para confirmar la cuenta. Confirmalo y después ingresá."}};render();return;}
    await hidratarCuenta();
    guardarEstado(); location.hash="#/"; render(); avisar(registro?"Cuenta creada. Sumaste 50 puntos de bienvenida":"Sesión iniciada");
  } catch(error) { ui.borrador={...ui.borrador,nombre:datos.nombre,email:datos.email,errores:{general:error.message}}; render(); }
});

/* =========================================================
   ROUTER
   ========================================================= */
function render() {
  if (!estado.usuario) { app.innerHTML = ui.onboarding === "bienvenida" ? pantallaLanding() : pantallaAcceso(); return; }
  const [, seccion, id] = location.hash.replace(/^#/, "").split("/");
  const rutas = {
    "": pantallaInicio,
    recetas: pantallaRecetas, receta: () => pantallaReceta(id),
    productos: pantallaProductos, producto: () => pantallaProducto(id),
    locales: pantallaLocales, local: () => pantallaLocal(id),
    puntos: pantallaPuntos, perfil: pantallaPerfil, comercio: pantallaComercio
  };
  app.innerHTML = (rutas[seccion || ""] || pantallaNoEncontrada)();
  iniciarMapa();
  cargarComprasPendientes();
}

let seccionAnterior = null;
window.addEventListener("hashchange", () => {
  const seccion = location.hash.split("/")[1] || "";
  if (seccion !== seccionAnterior) { ui.busqueda = ""; seccionAnterior = seccion; }
  ui.menuAbierto = false;
  cerrarModal();
  render();
  window.scrollTo(0, 0);
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape") cerrarModal(); });

render();
hidratarCuenta();
