/* =========================================================
   PLATAFORMA WEB - Demo funcional (MVP Sprint 2)
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
  const profile = async(user) => check(await sb.from("profiles").select("id,name,role,points,earned,brand_name").eq("id",user.id).single());

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
    return {...p, name:p.name, email:user.email, brand_name:p.brand_name, history:check(moves), coupons:check(coupons)};
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
  usuario: null, marca: "fintacc", puntos: 0, puntosGanados: 0, historial: [], cupones: [], reviews: []
});

let estado = cargarEstado();
estado.usuario = null;
let ui = { menuAbierto: false, onboarding: "bienvenida", borrador: {}, filtroMomento: "Todas", busqueda: "", vistaLocales: "lista", categoria: "Todas", paso: 0, estrellas: 0, adminTab: "productos", perfilTab: "personal" };

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
    estado.usuario = { id: cuenta.id, nombre: cuenta.name, email: cuenta.email, role: cuenta.role, brand_name: cuenta.brand_name };
    estado.puntos = cuenta.points; estado.puntosGanados = cuenta.earned;
    estado.historial = cuenta.history || []; estado.cupones = cuenta.coupons || [];
    estado.reviews = (await api("/reviews")).map(r => ({ objetivo:r.target, autor:r.author, estrellas:r.stars, texto:r.text }));
    
    await prepararVista(); 
    render();
  } catch (_) { estado={...estadoInicial(),marca:estado.marca}; render(); }
}

// Descarga los datos de Supabase y los filtra según el rol
async function prepararVista() {
  const sb = window.fintaccSupabase;
  if (!sb) return;

  const role = estado.usuario?.role;
  const userId = estado.usuario?.id;

  const [prodRes, locRes, recRes, catRes, cupRes, profRes] = await Promise.all([
    sb.from('products').select('*'),
    sb.from('stores').select('*'),
    (role !== 'brand') ? sb.from('recipes').select('*') : Promise.resolve({data: []}),
    sb.from('categories').select('*'),
    (role === 'brand') ? sb.from('coupons').select('*, profile:profiles(name)').order('created_at', {ascending: false}) : Promise.resolve({data: []}),
    sb.from('brand_profiles').select('*')
  ]);

  let prods = prodRes.data || [];
  let locs = locRes.data || [];
  let recs = recRes.data || [];
  let cats = catRes.data || [];
  let cupones = cupRes.data || [];
  let perfiles = profRes.data || [];

  if (role === 'brand') {
    prods = prods.filter(p => p.merchant_user_id === userId);
    locs = locs.filter(l => l.merchant_user_id === userId);
    cats = cats.filter(c => c.merchant_user_id === userId);
  } else {
    locs = locs.filter(l => l.status === 'active' || !l.status);
  }

  window._db = { productos: prods, locales: locs, recetas: recs, categorias: cats, canjes: cupones, perfiles: perfiles };
}

/* ---------- Utilidades ---------- */
const $ = (selector) => app.querySelector(selector);
const pesos = (n) => "$" + n.toLocaleString("es-AR");
const marca = () => MARCAS[estado.marca];
function escapar(texto) {
  return String(texto).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function sello() { return `<span class="sello">Sin TACC</span>`; }
function estrellas(n) { return `<span class="estrellas" aria-label="${n} de 5 estrellas">${"★".repeat(Math.round(n))}${"☆".repeat(5 - Math.round(n))}</span>`; }
function nivelActual() { return [...NIVELES].reverse().find((n) => estado.puntosGanados >= n.desde); }
function siguienteNivel() { return NIVELES.find((n) => n.desde > estado.puntosGanados); }
function reviewsDe(id) { return [...estado.reviews, ...REVIEWS].filter((r) => r.objetivo === id); }
function promedio(id, base) { const lista = reviewsDe(id); if (!lista.length) return base || 0; return lista.reduce((s, r) => s + r.estrellas, 0) / lista.length; }
function avisar(texto) {
  document.querySelector(".aviso")?.remove();
  const el = document.createElement("div");
  el.className = "aviso"; el.setAttribute("role", "status"); el.textContent = texto;
  document.body.appendChild(el); setTimeout(() => el.remove(), 2600);
}

/* ---------- Estructura compartida ---------- */
const SECCIONES = [["inicio", "Inicio", "#/"], ["recetas", "Recetas", "#/recetas"], ["productos", "Productos", "#/productos"], ["locales", "Locales", "#/locales"], ["puntos", "Puntos", "#/puntos"]];
const iconoMenu = () => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">${ui.menuAbierto ? '<path d="M6 6l12 12M18 6L6 18"/>' : '<path d="M4 8h16M4 16h16"/>'}</svg>`;

function barraSuperior(actual) {
  const inicial = estado.usuario.nombre.charAt(0).toUpperCase();
  const esAdminOMarca = estado.usuario.role === 'administrator' || estado.usuario.role === 'brand';
  const esMarca = estado.usuario.role === 'brand';

  const seccionesVisibles = SECCIONES.filter(([id]) => {
    if (id === 'recetas' && esMarca) return false;
    return true;
  });

  return `
    <header class="topbar">
      <div class="barra-vidrio">
        <a class="logo-link" href="#/" aria-label="${marca().nombre}, ir al inicio"><img class="imagotipo" src="${marca().logo}" alt="Fintacc"></a>
        
        <!-- MENÚ ESCRITORIO (Oculto en mobile) -->
        <nav class="menu desktop-menu" aria-label="Navegación principal">
          ${seccionesVisibles.map(([id, texto, href]) => `<a href="${href}" ${actual === id ? 'aria-current="page"' : ""}>${texto}</a>`).join("")}
          ${esAdminOMarca ? `<a href="#/admin" ${actual === "admin" ? 'aria-current="page"' : ""} style="color:var(--naranja); font-weight:700;">Admin</a>` : ''}
          <a href="#/perfil" ${actual === "perfil" ? 'aria-current="page"' : ""}>Mi perfil</a>
        </nav>

        <div class="acciones-usuario">
          ${estado.usuario.role !== 'brand' ? `<a class="pill-puntos solo-escritorio" href="#/puntos">${estado.puntos} pts</a>` : ''}
          <a class="avatar" href="#/perfil" aria-label="Mi perfil">${escapar(inicial)}</a>
        </div>
      </div>
    </header>`;
}

function navInferior(actual) {
  const esMarca = estado.usuario.role === 'brand';
  const seccionesVisibles = SECCIONES.filter(([id]) => {
    if (id === 'recetas' && esMarca) return false;
    return true;
  });
  
  const iconosMenu = { inicio: "sol", recetas: "libro", productos: "bolsa", locales: "pin", puntos: "estrella" };

  return `
    <nav class="bottom-nav solo-movil">
      ${seccionesVisibles.map(([id, texto, href]) => `
        <a href="${href}" ${actual === id ? 'aria-current="page"' : ""}>
          ${icono(iconosMenu[id] || "cubiertos")}
          <span>${texto}</span>
        </a>
      `).join("")}
    </nav>
  `;
}

function pie() {
  return `<footer class="pie"><div class="contenedor">
    <div class="pie-principal"><img class="logo-pie" src="${marca().logo}" alt="${marca().nombre}"><p class="lema">Comé seguro,<br>sin vueltas.</p></div>
    <div class="datos-pie"><span>${marca().nombre} · Plataforma sin TACC</span><span>Proyecto final · Diseño y Programación Web · 2026</span><span>Abril Marsico y Candela Cusinier</span></div>
  </div></footer>`;
}
function layout(actual, contenido) { 
  return `
    ${barraSuperior(actual)}
    <main class="contenedor pagina" id="contenido">${contenido}</main>
    ${navInferior(actual)}
    ${pie()}
  `; 
}
function volver(href, texto = "Volver") { return `<a class="volver" href="${href}">← ${texto}</a>`; }
const vacio = (titulo, texto) => `<div class="vacio"><strong>${titulo}</strong>${texto}</div>`;

const TONO_MOMENTO = { Desayuno: "t-naranja", Almuerzo: "t-menta", Merienda: "t-tostado", Cena: "t-marron" };
const TONO_CATEGORIA = { Panificados: "t-tostado", Almacén: "t-naranja", Bebidas: "t-menta", Snacks: "t-marron", Refrigerados: "t-menta" };

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
  qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/>',
  lapiz: '<path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>',
  basura: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/>',
  arriba: '<path d="M18 15l-6-6-6 6"/>',
  abajo: '<path d="M6 9l6 6 6-6"/>',
  config: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  guardar: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
  usuario: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
  tablet: '<rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>',
  smartphone: '<rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>'
};
function icono(nombre, clase = "") { return `<svg class="ico ${clase}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${TRAZOS[nombre]}</svg>`; }
const ICONO_MOMENTO = { Desayuno: "sol", Almuerzo: "bowl", Merienda: "taza", Cena: "luna" };
const ICONO_CATEGORIA = { Panificados: "pan", Almacén: "frasco", Bebidas: "botella", Snacks: "galleta", Refrigerados: "frio" };
const ICONO_LOCAL = { Panadería: "pan", Café: "taza", Dietética: "bolsa", Restaurante: "cubiertos" };
const iconoLocal = (l) => icono(ICONO_LOCAL[l.tipo] || "cubiertos");
const tonoLocal = (l) => (l.verificado ? "t-menta" : "t-tostado");

// Convierte un valor de la base (array o texto JSON) en array
function comoArray(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === "string" && v.trim()) { try { const x = JSON.parse(v); return Array.isArray(x) ? x : []; } catch (_) { return []; } }
  return [];
}

// Las recetas de Supabase usan columnas en inglés (moment, minutes, steps...): las unificamos acá
function normalizarReceta(r) {
  const n = r.nutricion || r.nutrition || {};
  return {
    id: r.id,
    nombre: r.nombre || r.name || "",
    momento: r.momento || r.moment || "Almuerzo",
    minutos: r.minutos || r.minutes || 20,
    porciones: r.porciones || r.servings || 1,
    nutricion: (n && Object.keys(n).length) ? {
      calorias: n.calorias ?? n.calories, proteinas: n.proteinas ?? n.proteins,
      carbohidratos: n.carbohidratos ?? n.carbohydrates, grasas: n.grasas ?? n.fats
    } : null,
    ingredientes: comoArray(r.ingredientes || r.ingredients),
    pasos: comoArray(r.pasos || r.steps),
    productIds: comoArray(r.product_ids).map(String),
    image_url: r.image_url
  };
}

// Locales donde se vende un producto (columna store_ids)
function localesDeProducto(p) {
  const ids = comoArray(p.store_ids).map(String);
  return (window._db?.locales || []).filter((l) => ids.includes(String(l.id)));
}

function tarjetaReceta(receta) {
  const r = normalizarReceta(receta);
  const nom = r.nombre;
  const mom = r.momento;
  const min = r.minutos;
  const img = r.image_url;
  
  return `<a class="tile" href="#/receta/${r.id}">
    <span class="visual ${TONO_MOMENTO[mom] || 't-menta'}" >
      ${img ? `<img src="${img}" style="width:100%; height:100%; object-fit:cover; position:absolute; inset:0;" />` : icono(ICONO_MOMENTO[mom] || "libro")}
      ${sello(r)}
    </span>
    <span class="cuerpo"><h3>${escapar(nom)}</h3><span class="meta">${mom} · ${min} min</span></span></a>`;
}

function tarjetaProducto(p) {
  const nom = p.name || p.nombre;
  const cat = p.category || p.categoria || 'Almacén';
  const mar = p.brand || p.marca || 'Sin marca';
  const pre = p.price || p.precio || 0;
  const img = p.image_url;
  
  return `<a class="tile" href="#/producto/${p.id}">
    <span class="visual ${TONO_CATEGORIA[cat] || "t-menta"}" >
      ${img ? `<img src="${img}" style="width:100%; height:100%; object-fit:cover; position:absolute; inset:0;" />` : icono(ICONO_CATEGORIA[cat] || "frasco")}
      ${sello(p)}
    </span>
    <span class="cuerpo"><h3>${escapar(nom)}</h3><span class="meta">${escapar(mar)}</span><span class="precio">${pesos(pre)}</span></span></a>`;
}

function tarjetaLocal(l) {
  const nom = l.name || l.nombre;
  const tip = l.type || l.tipo || 'Local';
  const dir = l.address || l.direccion || '';
  const img = l.image_url;
  
  return `<a class="fila" href="#/local/${l.id}">
    <span class="icono ${tonoLocal(l)}" aria-hidden="true" style="overflow:hidden;">
      ${img ? `<img src="${img}" style="width:100%; height:100%; object-fit:cover;" />` : iconoLocal(l)}
    </span>
    <span class="cuerpo"><h3>${escapar(nom)}</h3><span class="meta">${escapar(tip)} · ${escapar(dir)} · ${estrellas(promedio(l.id, l.rating))}</span>
    ${l.status !== 'inactive' ? '<span class="sello verificado">Local verificado</span>' : '<span class="sello no-apto">Sin verificar</span>'}</span></a>`;
}
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
   PANTALLAS PÚBLICAS
   ========================================================= */
function barraPublica() {
  return `<header class="topbar topbar-publica"><div class="barra-vidrio">
    <a class="logo-link" href="#/" data-accion="ir-bienvenida" aria-label="${marca().nombre}, ir al inicio"><img class="imagotipo" src="${marca().logo}" alt="Fintacc"></a>
    <nav class="menu ${ui.menuAbierto ? "abierto" : ""}" id="menu" aria-label="Secciones">
      <a href="#como-funciona" data-ancla>Cómo funciona</a><a href="#modulos" data-ancla>Qué encontrás</a><a href="#comercios" data-ancla>Para comercios</a>
      <a class="solo-movil" href="#" data-accion="ir-ingreso">Ingresar</a><a class="solo-movil" href="#" data-accion="ir-registro">Crear cuenta</a>
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
          <div class="fila"><span class="icono t-menta">${icono("cubiertos")}</span><span class="cuerpo"><h3>Sintaxis</h3><span class="meta">Restaurante · Palermo</span><span class="sello">100% sin TACC</span></span></div>
          <div class="fila"><span class="icono t-menta">${icono("bowl")}</span><span class="cuerpo"><h3>Bowl de quinoa</h3><span class="meta">Almuerzo · 25 min</span><span class="sello">Sin TACC</span></span></div>
          <div class="fila"><span class="icono t-naranja">${icono("ticket")}</span><span class="cuerpo"><h3>+25 puntos</h3><span class="meta">Compra en TACC OFF</span></span></div>
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

function generarVistaMarcaHTML(perfil, productos, locales, categorias, esPreview = false) {
  const volverBtn = esPreview ? '' : volver("#/locales", "Volver");

  return `${volverBtn}
    <div style="width:100%">
      <section class="detalle-hero t-menta" style="margin-top: ${esPreview ? '0' : '20px'}">
        <div>
          <span class="etiqueta" style="background:var(--teal); color:#fff; margin-bottom:12px;">Marca Oficial</span>
          <h1>${escapar(perfil.brand_name || perfil.name || 'Marca')}</h1>
          ${perfil.brand_description ? `<p class="suave">${escapar(perfil.brand_description)}</p>` : ''}
        </div>
        <span class="icono-gigante" style="overflow:hidden; border-radius:20px; width:160px; height:160px; background:#fff; display:flex; align-items:center; justify-content:center; box-shadow:var(--sombra);">
          ${perfil.logo_url ? `<img src="${perfil.logo_url}" style="width:100%; height:100%; object-fit:cover;" />` : escapar((perfil.brand_name || perfil.name || 'M').charAt(0))}
        </span>
      </section>

      <div class="detalle" style="margin-top:24px">
        <div class="detalle-contenido" style="display:flex; flex-direction:column; gap:24px;">
          ${productos.length ? `
            <div>
              <h2 style="margin-bottom:16px">Productos Destacados</h2>
              <div class="grilla">${productos.map(tarjetaProducto).join("")}</div>
            </div>` : ''}
          ${locales.length ? `
            <div>
              <h2 style="margin-bottom:16px">Locales de la marca</h2>
              <div class="lista">${locales.map(tarjetaLocal).join("")}</div>
            </div>` : ''}
        </div>
        <aside class="detalle-aside">
          <div class="caja">
            <h2>Categorías</h2>
            <div class="chips" style="margin-top:12px">
              ${categorias.map(c => `<span class="chip">${escapar(c.name)}</span>`).join("") || '<p class="suave chico">Sin categorías cargadas</p>'}
            </div>
          </div>
        </aside>
      </div>
    </div>
  `;
}

function pantallaMarcaPublica(id) {
  const perfil = (window._db?.perfiles || []).find(p => String(p.id) === String(id));
  if (!perfil) return pantallaNoEncontrada();

  // featured_* puede llegar como array o como texto JSON
  const catIds = comoArray(perfil.featured_categories).map(String);
  const prodIds = comoArray(perfil.featured_products).map(String);
  const locIds = comoArray(perfil.featured_stores).map(String);
  const deLaMarca = (x) => String(x.merchant_user_id) === String(perfil.id);

  // Si la marca no eligió destacados, mostramos todo lo que tiene cargado
  const categorias = (window._db?.categorias || []).filter(c => catIds.length ? catIds.includes(String(c.id)) : deLaMarca(c));
  const productos = (window._db?.productos || []).filter(p => prodIds.length ? prodIds.includes(String(p.id)) : deLaMarca(p));
  const locales = (window._db?.locales || []).filter(l => locIds.length ? locIds.includes(String(l.id)) : deLaMarca(l));

  return layout("", generarVistaMarcaHTML(perfil, productos, locales, categorias, false));
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
  const esMarca = estado.usuario.role === "brand";
  
  if (esMarca) {
    const misProds = window._db?.productos || [];
    const misLocales = window._db?.locales || [];
    const misCanjes = window._db?.canjes || [];
    
    return layout("inicio", `
      <section class="bento">
        <div class="bloque ancho tinta">
          <p class="chico" style="opacity:.7">Panel de Marca</p>
          <p class="saludo-grande">Hola, ${escapar(estado.usuario.nombre)}.</p>
          <p>Gestioná tus productos, locales y canjes desde un solo lugar.</p>
        </div>
        <a class="bloque teal" href="#/productos"><span class="flecha" aria-hidden="true">↗</span><p class="grande">${misProds.length}</p><h3>productos</h3></a>
        <a class="bloque menta" href="#/locales"><span class="flecha" aria-hidden="true">↗</span><p class="grande">${misLocales.length}</p><h3>locales</h3></a>
        <a class="bloque ancho naranja" href="#/puntos" style="grid-column: span 2;"><span class="flecha" aria-hidden="true">↗</span>
          <p class="chico">Historial de canjes</p>
          <p class="grande">${misCanjes.length}</p>
          <h3>Canjes de usuarios</h3>
          <p class="chico">Tocá acá para escanear un QR o ver el detalle.</p>
        </a>
      </section>
      
      <section class="seccion"><div class="seccion-titulo"><h2>Últimos productos creados</h2><a href="#/admin">Gestionar</a></div>
        ${misProds.length ? `<div class="grilla">${misProds.slice(0, 4).map(tarjetaProducto).join("")}</div>` : vacio("Sin productos", "Creá tu primer producto en el Backoffice.")}
      </section>
      
      <section class="seccion"><div class="seccion-titulo"><h2>Mis locales</h2><a href="#/admin">Gestionar</a></div>
        ${misLocales.length ? `<div class="grilla filas">${misLocales.slice(0, 4).map(tarjetaLocal).join("")}</div>` : vacio("Sin locales", "Creá tu primer local en el Backoffice.")}
      </section>
    `);
  }

  // INICIO NORMAL (USUARIOS Y ADMIN)
  const recetas = window._db?.recetas || [];
  const productos = window._db?.productos || [];
  const locales = window._db?.locales || [];
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
      <a class="bloque naranja" href="#/recetas"><span class="flecha" aria-hidden="true">↗</span><p class="grande">${recetas.length}</p><h3>recetas</h3></a>
      <a class="bloque menta" href="#/locales"><span class="flecha" aria-hidden="true">↗</span><p class="grande">${locales.length}</p><h3>locales verificados</h3></a>
      <a class="bloque tostado" href="#/productos"><span class="flecha" aria-hidden="true">↗</span><p class="grande">${productos.length}</p><h3>productos</h3></a>
      <a class="bloque marron" href="#/puntos"><span class="flecha" aria-hidden="true">↗</span><p class="grande">${estado.cupones.length}</p><h3>cupones activos</h3></a>
    </section>
    
    <section class="seccion"><div class="seccion-titulo"><h2>Recetas para vos</h2><a href="#/recetas">Ver todas</a></div>
      ${recetas.length ? `<div class="grilla">${recetas.slice(0, 4).map(tarjetaReceta).join("")}</div>` : vacio("Sin recetas por ahora", "Pronto vamos a sumar más recetas.")}
    </section>
    
    <section class="seccion"><div class="seccion-titulo"><h2>Locales verificados</h2><a href="#/locales">Ver todos</a></div>
      ${locales.length ? `<div class="grilla filas">${locales.map(tarjetaLocal).join("")}</div>` : vacio("Sin locales por ahora", "Todavía no hay locales verificados.")}
    </section>
  `);
}

function barraFiltros(placeholder, opciones, actual, accion) {
  return `<div class="barra-filtros">
    <input class="buscador" type="search" placeholder="${placeholder}" aria-label="${placeholder}" data-busqueda value="${escapar(ui.busqueda)}">
    <div class="chips" role="group" aria-label="Filtros">${opciones.map((o) => `<button class="chip" data-accion="${accion}" data-valor="${o}" aria-pressed="${actual === o}">${o}</button>`).join("")}</div>
  </div>`;
}

function pantallaRecetas() {
  if (estado.usuario?.role === 'brand') return pantallaNoEncontrada(); // Bloqueo para marcas
  const fuente = window._db?.recetas || [];
  const q = ui.busqueda.toLowerCase();
  const lista = fuente.filter((receta) => { const r = normalizarReceta(receta); return (ui.filtroMomento === "Todas" || r.momento === ui.filtroMomento) && r.nombre.toLowerCase().includes(q); });
  
  return layout("recetas", `
    <div class="cabecera-pagina"><h1>Recetas</h1><span class="contador">${lista.length} ${lista.length === 1 ? "resultado" : "resultados"}</span></div>
    ${barraFiltros("Buscar receta", ["Todas", "Desayuno", "Almuerzo", "Merienda", "Cena"], ui.filtroMomento, "filtro-momento")}
    <div class="grilla">${lista.length ? lista.map(tarjetaReceta).join("") : vacio("No encontramos recetas", "Probá con otra búsqueda o cambiá el filtro.")}</div>`);
}

function pantallaReceta(id) {
  const original = (window._db?.recetas || []).find((x) => String(x.id) === String(id));
  if (!original) return pantallaNoEncontrada();
  const r = normalizarReceta(original);
  const n = r.nutricion;

  // Productos de la receta y los comercios donde se consiguen
  const productos = (window._db?.productos || []).filter((p) => r.productIds.includes(String(p.id)));
  const locales = [];
  productos.forEach((p) => localesDeProducto(p).forEach((l) => { if (!locales.some((x) => x.id === l.id)) locales.push(l); }));

  return layout("recetas", `${volver("#/recetas", "Recetas")}
    <section class="detalle-hero ${TONO_MOMENTO[r.momento] || "t-menta"}">
      <div>${sello(r)}<h1>${escapar(r.nombre)}</h1><div class="chips"><span class="etiqueta">${escapar(r.momento)}</span><span class="etiqueta">${r.minutos} min</span></div></div>
      <span class="icono-gigante">${icono(ICONO_MOMENTO[r.momento] || "libro")}</span>
    </section>
    <div class="detalle">
      <div style="display:flex;flex-direction:column;gap:16px">
        <div class="caja"><h2>Ingredientes</h2><p class="suave chico">Tocá cada uno a medida que lo tengas listo.</p>
          ${r.ingredientes.length
            ? `<ul class="checklist">${r.ingredientes.map((i, k) => `<li><input type="checkbox" id="ing${k}" data-accion="ingrediente"><label for="ing${k}"><span>${escapar(i)}</span></label></li>`).join("")}</ul>`
            : '<p class="suave" style="margin-top:8px">Esta receta todavía no tiene ingredientes cargados.</p>'}
        </div>
        <div class="caja"><h2>Paso a paso</h2>
          ${r.pasos.length
            ? `<ol class="lista-pasos">${r.pasos.map((paso) => `<li>${escapar(paso)}</li>`).join("")}</ol>`
            : '<p class="suave" style="margin-top:8px">Esta receta todavía no tiene pasos cargados.</p>'}
        </div>
        ${productos.length ? `
        <section class="seccion">
          <h2 style="margin-bottom:16px">Productos para esta receta</h2>
          <div class="grilla">${productos.map(tarjetaProducto).join("")}</div>
        </section>` : ""}
        ${locales.length ? `
        <section class="seccion">
          <h2 style="margin-bottom:16px">Dónde conseguirlos</h2>
          <div class="lista">${locales.map(tarjetaLocal).join("")}</div>
        </section>` : ""}
      </div>
      <aside>
        ${n ? `<div class="caja"><h2>Información nutricional</h2><p class="suave chico">Por porción, aproximada</p>
          <div class="datos"><div class="dato"><strong>${n.calorias ?? "-"}</strong>kcal</div><div class="dato"><strong>${n.proteinas ?? "-"} g</strong>Proteínas</div><div class="dato"><strong>${n.carbohidratos ?? "-"} g</strong>Carbohidratos</div><div class="dato"><strong>${n.grasas ?? "-"} g</strong>Grasas</div></div>
        </div>` : ""}
        <div class="caja"><div class="datos" style="margin:0"><div class="dato"><strong>${r.minutos} min</strong>Tiempo</div><div class="dato"><strong>${r.porciones}</strong>Porciones</div></div></div>
        ${r.pasos.length ? `<button class="btn btn-tinta btn-ancho" data-accion="abrir-pasos" data-id="${escapar(r.id)}">Cocinar paso a paso</button>` : ""}
      </aside>
    </div>`);
}

function pantallaProductos() {
  const fuente = window._db?.productos || [];
  const categorias = ["Todas", ...new Set(fuente.map((p) => p.category || p.categoria || 'Almacén').filter(Boolean))];
  const q = ui.busqueda.toLowerCase();
  const lista = fuente.filter((p) => {
      const cat = p.category || p.categoria || '';
      const nom = p.name || p.nombre || '';
      const mar = p.brand || p.marca || '';
      return (ui.categoria === "Todas" || cat.includes(ui.categoria)) && (nom + " " + mar).toLowerCase().includes(q);
  });
  
  return layout("productos", `
    <div class="cabecera-pagina"><h1>Productos</h1><span class="contador">${lista.length} ${lista.length === 1 ? "resultado" : "resultados"}</span></div>
    ${barraFiltros("Buscar producto o marca", categorias, ui.categoria, "filtro-categoria")}
    <div class="grilla">${lista.length ? lista.map(tarjetaProducto).join("") : vacio("No encontramos productos", "Probá con otra búsqueda o cambiá el filtro.")}</div>`);
}

function pantallaProducto(id) {
  const p = (window._db?.productos || []).find((x) => String(x.id) === String(id));
  if (!p) return pantallaNoEncontrada();
  
  // Locales donde se vende: primero store_ids; si no tiene, los locales de su comercio
  let donde = localesDeProducto(p);
  if (!donde.length && p.merchant_user_id) donde = (window._db?.locales || []).filter((l) => l.merchant_user_id === p.merchant_user_id);
  const cat = p.category || 'Almacén';
  const mar = p.brand || 'Marca';
  
  return layout("productos", `${volver("#/productos", "Productos")}
    <section class="detalle-hero ${TONO_CATEGORIA[cat] || "t-menta"}">
      <div>${sello(p)}<h1>${escapar(p.name)}</h1><p class="suave" style="margin-bottom:12px">${escapar(mar)} · ${escapar(cat)}</p><div class="chips"><span class="etiqueta">Libre de gluten</span><span class="etiqueta">Con registro RNPA</span></div></div>
      <span class="icono-gigante" style="overflow:hidden; border-radius:20px; width:160px; height:160px;">
        ${p.image_url ? `<img src="${p.image_url}" style="width:100%; height:100%; object-fit:cover;" />` : icono(ICONO_CATEGORIA[cat] || "frasco")}
      </span>
    </section>
    <div class="detalle">
      <div>${seccionReviews(p.id)}</div>
      <aside>
        <div class="caja"><p class="suave chico">Precio de referencia</p><p class="precio" style="font-size:2.6rem;letter-spacing:-.03em">${pesos(p.price || 0)}</p></div>
        ${donde.length ? `<div><h2 style="margin-bottom:14px">Dónde comprarlo</h2><div class="lista">${donde.map(tarjetaLocal).join("")}</div></div>` : ''}
      </aside>
    </div>`);
}

function pantallaLocales() {
  const lista = window._db?.locales || [];
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
  
  const localesAMostrar = window._db?.locales || [];

  // Cada local se ubica con las coordenadas guardadas en Supabase (latitude/longitude).
  // Los que todavía no tienen coordenadas no se muestran en el mapa, pero siguen en la lista.
  localesAMostrar.forEach(l => {
    const lat = Number(l.latitude), lng = Number(l.longitude);
    if (l.latitude == null || l.longitude == null || l.latitude === "" || l.longitude === "" || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    L.marker([lat, lng]).addTo(map).bindPopup(`<a href="#/local/${escapar(l.id)}"><strong>${escapar(l.name)}</strong></a><br>${escapar(l.type || 'Local')}`);
  });

  window._fintaccMap = map;
  setTimeout(()=>map.invalidateSize(),120);
}

function pantallaLocal(id) {
  const l = (window._db?.locales || []).find((x) => String(x.id) === String(id));
  if (!l) return pantallaNoEncontrada();
  
  // Productos que se venden en este local (store_ids). Si un producto no tiene locales
  // asignados, se muestra en los locales de su comercio.
  const productosMarca = (window._db?.productos || []).filter((p) => {
    const ids = comoArray(p.store_ids).map(String);
    if (ids.length) return ids.includes(String(l.id));
    return !!l.merchant_user_id && p.merchant_user_id === l.merchant_user_id;
  });
  // Otros locales solo si el local pertenece a una marca y esa marca tiene más de un local
  const otrosLocales = l.merchant_user_id
    ? (window._db?.locales || []).filter((x) => x.merchant_user_id === l.merchant_user_id && x.id !== l.id)
    : [];
  const botonMarca = l.merchant_user_id
    ? `<button class="btn btn-secundario btn-ancho" style="margin-top:16px" data-accion="ver-perfil-marca" data-id="${escapar(l.merchant_user_id)}">Ver perfil de la marca</button>`
    : "";
  const imgPrincipal = l.image_url || (l.images && l.images[0]);

  return layout("locales", `${volver("#/locales", "Locales")}
    <section class="detalle-hero ${tonoLocal(l)}">
      <div>${l.status !== 'inactive' ? '<span class="sello verificado">Local verificado</span>' : '<span class="sello no-apto">Sin verificar</span>'}
        <h1>${escapar(l.name)}</h1><p class="suave">${escapar(l.type || 'Local')} · ${escapar(l.address || '')} · ${estrellas(promedio(l.id, 5))}</p></div>
      <span class="icono-gigante" style="overflow:hidden; border-radius:20px; width:160px; height:160px;">
        ${imgPrincipal ? `<img src="${imgPrincipal}" style="width:100%; height:100%; object-fit:cover;" />` : iconoLocal(l)}
      </span>
    </section>
    
    <div class="detalle">
      <div style="display:flex;flex-direction:column;gap:16px" class="detalle-columna-principal">
        
        <!-- CARD DIRECCIÓN (SOLO MOBILE) -->
        <div class="caja solo-movil">
          <div class="datos" style="margin:0">
            <div class="dato"><strong style="font-size:1rem">Dirección</strong>${escapar(l.address || 'No especificada')}</div>
            <div class="dato"><strong style="font-size:1rem">Tipo</strong>${escapar(l.type || 'Local')}</div>
          </div>
          ${botonMarca}
        </div>

        <!-- CARD MENÚ -->
        <div class="caja">
          <h2>Menú sin TACC</h2>
          ${l.menu_url ? `<p style="margin-top:8px"><a href="${l.menu_url}" target="_blank" class="btn btn-chico">Ver menú completo (PDF/Link)</a></p>` : '<p class="suave" style="margin-top:6px">Este local todavía no cargó su menú.</p>'}
        </div>
        
        <!-- REVIEWS -->
        ${seccionReviews(l.id)}

        <!-- PRODUCTOS DE LA MARCA -->
        ${productosMarca.length ? `
        <section class="seccion">
          <h2 style="margin-bottom:16px">Productos en este local</h2>
          <div class="grilla">${productosMarca.map(tarjetaProducto).join("")}</div>
        </section>` : ''}

        <!-- OTROS LOCALES -->
        ${otrosLocales.length ? `
        <section class="seccion">
          <h2 style="margin-bottom:16px">Otros locales de la marca</h2>
          <div class="lista">${otrosLocales.map(tarjetaLocal).join("")}</div>
        </section>` : ''}

      </div>

      <!-- ASIDE (SOLO ESCRITORIO) -->
      <aside class="solo-escritorio">
        <div class="caja">
          <div class="datos" style="margin:0">
            <div class="dato"><strong style="font-size:1rem">Dirección</strong>${escapar(l.address || 'No especificada')}</div>
            <div class="dato"><strong style="font-size:1rem">Tipo</strong>${escapar(l.type || 'Local')}</div>
          </div>
          ${botonMarca}
        </div>
        ${l.status !== 'inactive' ? `<div class="caja"><h2>Qué verificamos</h2><ul class="checklist"><li><span class="tilde" aria-hidden="true">✓</span><span>Local adherido a Fintacc</span></li></ul></div>` : ''}
        ${l.status !== 'inactive' ? `<button class="btn btn-naranja btn-ancho" data-accion="abrir-compra" data-id="${l.id}">Sumar puntos en este local</button>` : ""}
      </aside>
    </div>`);
}
function seccionReviews(id) {
  const lista = reviewsDe(id);
  const esUsuario = estado.usuario?.role === 'user';
  
  return `<section class="caja">
    <h2>Comunidad</h2>
    ${lista.length ? lista.map((r) => `<div class="review"><p><strong>${escapar(r.autor)}</strong></p>${estrellas(r.estrellas)}<p style="margin-top:4px">${escapar(r.texto)}</p></div>`).join("") : '<p class="suave" style="margin:8px 0">Todavía no hay reviews.</p>'}
    
    ${esUsuario ? `
      <button class="btn btn-secundario btn-ancho" style="margin-top:14px" data-accion="abrir-review" data-id="${id}">Escribir una review</button>
    ` : ''}
  </section>`;
}

function pantallaPuntos() {
  const esMarca = estado.usuario.role === "brand";
  
  if (esMarca) {
    const canjes = window._db?.canjes || [];
    return layout("puntos", `
      <div class="cabecera-pagina"><h1>Canjes y Validación</h1></div>
      
      <section class="puntos-hero" style="grid-template-columns: 1fr; text-align: center;">
        <div>
          <p class="chico" style="opacity:.8">Validación de cupones</p>
          <h2 style="margin: 16px 0;">Escaneá el QR del cliente</h2>
          <p class="chico" style="margin-bottom: 24px; max-width: 400px; margin-inline: auto;">Usá la cámara para leer el código del cupón y marcarlo como utilizado en el sistema.</p>
          <button class="btn btn-naranja" style="font-size: 1.1rem; padding: 16px 32px;" data-accion="escanear-canje">
            Escanear QR de Canje
          </button>
        </div>
      </section>
      
      <div class="seccion">
        <h2 style="margin-bottom: 20px;">Historial de Canjes de Usuarios</h2>
        <div class="caja">
          ${canjes.length ? canjes.map(c => `
            <div class="movimiento" style="align-items:center;">
              <span>
                <strong>${escapar(c.profile?.name || 'Usuario')}</strong><br>
                <span class="suave chico">Cupón: ${c.code} · ${c.points} pts · Descuento: ${pesos(c.discount)}</span>
              </span>
              <span class="etiqueta" style="background: ${c.status === 'active' ? 'var(--menta)' : 'var(--linea)'}; color: ${c.status === 'active' ? 'var(--teal-oscuro)' : 'var(--texto-suave)'};">
                ${c.status === 'active' ? 'Pendiente' : 'Usado'}
              </span>
            </div>
          `).join("") : '<p class="suave">Todavía no hay canjes registrados.</p>'}
        </div>
      </div>
    `);
  }

  // PANTALLA DE PUNTOS NORMAL (USUARIO/ADMIN)
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

/* ---------- PERFIL ---------- */
function pantallaPerfil() {
  const esMarca = estado.usuario.role === "brand";
  const tabActual = ui.perfilTab || "personal";
  const tituloMostrar = (esMarca && tabActual === 'publico') ? (estado.usuario.brand_name || estado.usuario.nombre) : `Hola, ${estado.usuario.nombre}`;
  
  return layout("perfil", `<div class="estrecho" style="${esMarca && tabActual === 'publico' ? 'max-width:100%;' : ''}">
    <div class="cabecera-pagina">
      <h1>${escapar(tituloMostrar)}</h1>
      ${tabActual === 'personal' ? `<span class="contador">${escapar(estado.usuario.email)}</span>` : ''}
    </div>
    
    ${esMarca ? `
      <div class="selector-vista" style="margin-bottom:24px; max-width:400px;">
        <button data-accion="perfil-tab" data-valor="personal" aria-pressed="${tabActual === 'personal'}">Datos personales</button>
        <button data-accion="perfil-tab" data-valor="publico" aria-pressed="${tabActual === 'publico'}">Perfil público (Marca)</button>
      </div>
    ` : ''}

    ${(!esMarca || tabActual === "personal") ? `
      <section class="caja">
        <h2>Datos personales</h2>
        <p class="suave chico" style="margin:4px 0 14px">Rol actual: <strong style="text-transform:capitalize">${estado.usuario.role}</strong></p>
        <form id="form-perfil-personal" style="margin-top:16px">
          <div class="campo"><label>Nombre</label><input name="nombre" value="${escapar(estado.usuario.nombre)}" required></div>
          <button class="btn btn-chico">Guardar cambios</button>
        </form>
      </section>
    ` : ''}

    ${(esMarca && tabActual === "publico") ? `
      <div class="editor-split">
        <div class="editor-controles">
          <h2 style="margin-bottom:16px;">Editor de tienda</h2>
          
          <div class="campo" style="margin-bottom:20px;">
            <label>Nombre público de la marca</label>
            <input type="text" id="input-brand-name" placeholder="Ej: Almacén Raíz">
          </div>

          <div class="campo" style="margin-bottom:20px;">
            <label>Descripción de la marca</label>
            <input type="text" id="input-brand-desc" placeholder="Ej: Creamos experiencias personalizadas">
          </div>

          <div class="campo" style="margin-bottom:20px;">
            <label>Logo actual</label>
            <div style="display:flex; align-items:center; gap:12px; margin-bottom:8px;">
              <img id="preview-logo-izquierda" src="" style="width:50px; height:50px; border-radius:8px; object-fit:cover; background:var(--linea); display:none;">
              <button class="btn btn-secundario btn-chico" onclick="document.getElementById('upload-logo').click()">Seleccionar imagen</button>
            </div>
            <input type="file" id="upload-logo" accept="image/*" style="display:none">
            <span class="suave chico" id="estado-upload" style="display:block;"></span>
          </div>
          
          <h3 style="margin-bottom:12px; font-size:1rem;">Categorías Destacadas</h3>
          <div class="editor-panel" style="margin-bottom:20px;">
            <div class="editor-search-wrap">
              <input type="search" class="editor-search-input" id="search-cat" placeholder="Buscar categoría...">
            </div>
            <div class="editor-lista" id="lista-editor-categorias" style="max-height:160px;">
              <p class="suave chico" style="padding:16px;">Cargando...</p>
            </div>
          </div>

          <h3 style="margin-bottom:12px; font-size:1rem;">Productos Destacados</h3>
          <div class="editor-panel" style="margin-bottom:20px;">
            <div class="editor-search-wrap">
              <input type="search" class="editor-search-input" id="search-prod" placeholder="Buscar producto...">
            </div>
            <div class="editor-lista" id="lista-editor-productos" style="max-height:160px;">
              <p class="suave chico" style="padding:16px;">Cargando...</p>
            </div>
          </div>

          <h3 style="margin-bottom:12px; font-size:1rem;">Locales Destacados</h3>
          <div class="editor-panel">
            <div class="editor-search-wrap">
              <input type="search" class="editor-search-input" id="search-local" placeholder="Buscar local...">
            </div>
            <div class="editor-lista" id="lista-editor-locales" style="max-height:160px;">
              <p class="suave chico" style="padding:16px;">Cargando...</p>
            </div>
          </div>

          <button class="btn btn-tinta" style="margin-top:20px; width:auto;" id="btn-guardar-publico">${icono("guardar")} Guardar y Publicar</button>
        </div>

          <div class="editor-preview" style="background:var(--fondo); padding: 24px; border-radius: 24px; border: 1px dashed var(--linea); overflow:hidden;">
          
          <!-- BOTONES DE VISTA -->
            <div class="preview-toolbar" style="display:flex; justify-content:center; gap:8px; margin-bottom:24px;">
            <button class="btn btn-chico" data-accion="preview-view" data-valor="desktop" aria-pressed="${ui.previewView === 'desktop' || !ui.previewView}">
              ${icono("monitor")} Escritorio
            </button>
            <button class="btn btn-chico" data-accion="preview-view" data-valor="tablet" aria-pressed="${ui.previewView === 'tablet'}">
              ${icono("tablet")} Tablet
            </button>
            <button class="btn btn-chico" data-accion="preview-view" data-valor="mobile" aria-pressed="${ui.previewView === 'mobile'}">
              ${icono("smartphone")} Celular
            </button>
          </div>

          <!-- SIMULADOR DE PANTALLA -->
          <div id="preview-device" class="preview-device ${ui.previewView || 'desktop'}">
            <div id="preview-marca-contenido">
              <p class="suave" style="text-align:center; padding:40px;">Cargando vista previa...</p>
            </div>
          </div>

        </div>
      </div>
    ` : ''}

    <section class="fila-botones" style="margin-top:24px">
      ${estado.usuario.role === "administrator" ? '<a class="btn" href="#/admin" style="background:var(--marron);">Panel de Administración Global</a>' : ''}
      ${estado.usuario.role === "brand" ? '<a class="btn" href="#/admin" style="background:var(--teal);">Panel de mi Marca</a>' : ''}
      <button class="btn btn-secundario" data-accion="cerrar-sesion">Cerrar sesión</button>
    </section>
  </div>`);
}

// Función que trae los datos UNA SOLA VEZ desde Supabase
async function cargarEditorPublico() {
  const sb = window.fintaccSupabase;
  if (!sb) return;
  
  const boxCat = document.getElementById("lista-editor-categorias");
  if (!boxCat) return;

  const userId = estado.usuario.id;
  
  let categorias = [], productos = [], locales = [], perfil = {};

  try {
      const [catReq, prodReq, localReq, profileReq] = await Promise.all([
      sb.from("categories").select("id, name").eq("merchant_user_id", userId).order("name"),
      sb.from("products").select("id, name, image_url, price, brand").eq("merchant_user_id", userId).order("name"),
      sb.from("stores").select("id, name, image_url, type, address").eq("merchant_user_id", userId).order("name"),
      sb.from("profiles").select("featured_categories, featured_products, featured_stores, logo_url, brand_name").eq("id", userId).single(),
      sb.from("profiles").select("featured_categories, featured_products, featured_stores, logo_url, brand_name, brand_description").eq("id", userId).single()
    ]);
    if(catReq.data) categorias = catReq.data;
    if(prodReq.data) productos = prodReq.data;
    if(localReq.data) locales = localReq.data;
    if(profileReq.data) perfil = profileReq.data;
  } catch (err) { console.error("Error al cargar editor:", err); }
  
  window._allCategorias = categorias;
  window._allProductos = productos;
  window._allLocales = locales;

  const parseJsonArray = (val) => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    try { return JSON.parse(val); } catch(e) { return []; }
  };

  window._editorCat = parseJsonArray(perfil.featured_categories);
  window._editorProductos = parseJsonArray(perfil.featured_products);
  window._editorLocales = parseJsonArray(perfil.featured_stores);
  window._logoUrl = perfil.logo_url || "";

  // --- LOGICA DEL LOGO ---
    const updatePreviewLogo = (url) => {
    const el = document.getElementById("prev-logo"); // Logo grande (derecha)
    const elIzq = document.getElementById("preview-logo-izquierda"); // Logo chiquito (izquierda)
    
    if (url) {
      if (el) {
        el.innerHTML = `<img src="${url}" style="width:100%; height:100%; border-radius:16px; object-fit:cover;">`;
        el.style.background = "transparent";
      }
      if (elIzq) {
        elIzq.src = url;
        elIzq.style.display = "block";
      }
    } else {
      if (el) {
        el.innerHTML = escapar(estado.usuario.nombre.charAt(0).toUpperCase());
        el.style.background = "#fff";
      }
      if (elIzq) {
        elIzq.style.display = "none";
      }
    }
  };
  updatePreviewLogo(window._logoUrl);

  const fileInput = document.getElementById("upload-logo");
  if (fileInput) {
    const newFileInput = fileInput.cloneNode(true);
    fileInput.parentNode.replaceChild(newFileInput, fileInput);
    
    newFileInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const estadoTxt = document.getElementById("estado-upload");
      estadoTxt.textContent = "Subiendo imagen...";
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      
      const { data, error } = await sb.storage.from('brand_assets').upload(fileName, file);
      
      if (error) {
        estadoTxt.textContent = "Error al subir: " + error.message;
        return;
      }
      
      const { data: urlData } = sb.storage.from('brand_assets').getPublicUrl(fileName);
      window._logoUrl = urlData.publicUrl;
      estadoTxt.textContent = "Imagen subida con éxito";
      updatePreviewLogo(window._logoUrl);

      // Actualizar la vista previa de la izquierda
      const elIzq = document.getElementById("preview-logo-izquierda");
      if (elIzq) {
        elIzq.src = window._logoUrl;
        elIzq.style.display = "block";
      }

      // HABILITAR BOTÓN AL SUBIR FOTO
      const btnGuardar = document.getElementById("btn-guardar-publico");
      if (btnGuardar) btnGuardar.disabled = false;
    });
  }

  // --- LOGICA DEL NOMBRE DE MARCA ---
  const elBrandName = document.getElementById("input-brand-name");
  const elPrevNombre = document.getElementById("prev-nombre");
  const nombreMarca = perfil.brand_name || estado.usuario.nombre;
  
  if (elBrandName) {
    elBrandName.value = nombreMarca;
    elBrandName.addEventListener("input", (e) => {
      elPrevNombre.textContent = e.target.value || estado.usuario.nombre;
      
      // HABILITAR BOTÓN AL ESCRIBIR NOMBRE
      const btnGuardar = document.getElementById("btn-guardar-publico");
      if (btnGuardar) btnGuardar.disabled = false;
    });
  }
  if (elPrevNombre) elPrevNombre.textContent = nombreMarca;

   // LÓGICA DE LA DESCRIPCIÓN
  const elBrandDesc = document.getElementById("input-brand-desc");
  const descMarca = perfil.brand_description || "";
  if (elBrandDesc) {
    elBrandDesc.value = descMarca;
    elBrandDesc.addEventListener("input", () => {
      const btnGuardar = document.getElementById("btn-guardar-publico");
      if (btnGuardar) btnGuardar.disabled = false;
      renderEditorUI();
    });
  }

  // Asignar eventos a los buscadores
  const setupSearch = (id) => {
    const input = document.getElementById(id);
    if (input && !input.dataset.listening) {
      input.addEventListener("input", renderEditorUI);
      input.dataset.listening = "true";
    }
  };
  setupSearch("search-cat");
  setupSearch("search-prod");
  setupSearch("search-local");

  // Asignar eventos al botón de guardar
  const btnGuardar = document.getElementById("btn-guardar-publico");
  const newBtnGuardar = btnGuardar.cloneNode(true);
  btnGuardar.parentNode.replaceChild(newBtnGuardar, btnGuardar);
  
  newBtnGuardar.disabled = true; // Arranca deshabilitado

  newBtnGuardar.onclick = async () => {
    newBtnGuardar.disabled = true;
    newBtnGuardar.innerHTML = "Guardando...";
    try {
      const { data, error } = await sb.from("profiles").update({
        logo_url: window._logoUrl,
        brand_name: document.getElementById("input-brand-name").value.trim(),
        brand_description: document.getElementById("input-brand-desc").value.trim(),
        featured_categories: window._editorCat,
        featured_products: window._editorProductos,
        featured_stores: window._editorLocales
      }).eq("id", userId).select();
      
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("Supabase bloqueó la actualización. Revisá los permisos RLS.");

      avisar("Perfil público actualizado con éxito");
      newBtnGuardar.disabled = true; // Se vuelve a bloquear hasta que haya otro cambio
    } catch (e) {
      console.error(e);
      avisar("Error al guardar: " + e.message);
      newBtnGuardar.disabled = false;
    } finally {
      newBtnGuardar.innerHTML = `Guardar y Publicar`;
    }
  };

  renderEditorUI(); // Dibujamos por primera vez
}

// Función que DIBUJA la interfaz (se llama al cargar y al hacer clic/tipear)
function renderEditorUI() {
  const boxCat = document.getElementById("lista-editor-categorias");
  const boxProd = document.getElementById("lista-editor-productos");
  const boxLocal = document.getElementById("lista-editor-locales");
  if (!boxCat || !boxProd || !boxLocal) return;

  const termCat = document.getElementById("search-cat").value.toLowerCase();
  const termProd = document.getElementById("search-prod").value.toLowerCase();
  const termLocal = document.getElementById("search-local").value.toLowerCase();

  const catsFiltradas = window._allCategorias.filter(c => c.name.toLowerCase().includes(termCat));
  const prodsFiltrados = window._allProductos.filter(p => p.name.toLowerCase().includes(termProd));
  const localsFiltrados = window._allLocales.filter(l => l.name.toLowerCase().includes(termLocal));

  const crearListaHTML = (items, seleccionados, tipo) => {
    if (!items.length) return `<p class="suave chico" style="padding:16px;">No se encontraron resultados.</p>`;
    
    const seleccionadosStr = seleccionados.map(String);
    const seleccionadosData = seleccionadosStr.map(id => items.find(i => String(i.id) === id)).filter(Boolean);
    const noSeleccionadosData = items.filter(i => !seleccionadosStr.includes(String(i.id)));
    const listaFinal = [...seleccionadosData, ...noSeleccionadosData];

    return listaFinal.map((item) => {
      const isChecked = seleccionadosStr.includes(String(item.id));
      const esPrimero = isChecked && seleccionadosStr.indexOf(String(item.id)) === 0;
      const esUltimo = isChecked && seleccionadosStr.indexOf(String(item.id)) === seleccionadosStr.length - 1;
      
      return `
        <div class="editor-item ${isChecked ? 'seleccionado' : ''}" data-tipo="${tipo}" data-id="${item.id}" style="cursor: pointer;">
          <input type="checkbox" ${isChecked ? 'checked' : ''}>
          <span class="nombre">${escapar(item.name)}</span>
          ${isChecked ? `
            <div class="acciones">
              <button class="btn-flecha" data-accion="mover-editor" data-tipo="${tipo}" data-id="${item.id}" data-dir="up" ${esPrimero ? 'disabled' : ''}>${icono("arriba")}</button>
              <button class="btn-flecha" data-accion="mover-editor" data-tipo="${tipo}" data-id="${item.id}" data-dir="down" ${esUltimo ? 'disabled' : ''}>${icono("abajo")}</button>
            </div>
          ` : ''}
        </div>
      `;
    }).join("");
  };

  boxCat.innerHTML = crearListaHTML(catsFiltradas, window._editorCat, "categorias");
  boxProd.innerHTML = crearListaHTML(prodsFiltrados, window._editorProductos, "productos");
  boxLocal.innerHTML = crearListaHTML(localsFiltrados, window._editorLocales, "locales");

  // --- VISTA PREVIA UNIFICADA ---
  const previewContainer = document.getElementById("preview-marca-contenido");
  if (previewContainer) {
    const prodsSeleccionados = (window._editorProductos || []).map(id => window._allProductos.find(x => String(x.id) === String(id))).filter(Boolean);
    const localsSeleccionados = (window._editorLocales || []).map(id => window._allLocales.find(x => String(x.id) === String(id))).filter(Boolean);
    const catsSeleccionadas = (window._editorCat || []).map(id => window._allCategorias.find(x => String(x.id) === String(id))).filter(Boolean);

    // ACÁ ESTABA EL ERROR: Faltaba definir inputDesc
    const inputNombre = document.getElementById("input-brand-name");
    const inputDesc = document.getElementById("input-brand-desc"); 
    
    const perfilPreview = {
      brand_name: inputNombre ? inputNombre.value : estado.usuario.nombre,
      brand_description: inputDesc ? inputDesc.value : "",
      logo_url: window._logoUrl,
      name: estado.usuario.nombre
    };

    previewContainer.innerHTML = generarVistaMarcaHTML(perfilPreview, prodsSeleccionados, localsSeleccionados, catsSeleccionadas, true);
  }
}

// Manejo de clicks en los checkboxes y flechas
function manejarEventosEditor(e) {
  // Si hicieron clic en las flechas
  const btnFlecha = e.target.closest(".btn-flecha");
  if (btnFlecha) {
    const { tipo, id, dir } = btnFlecha.dataset;
    const idStr = String(id);
    let array = tipo === "categorias" ? window._editorCat : tipo === "productos" ? window._editorProductos : window._editorLocales;

    const idx = array.findIndex(x => String(x) === idStr);
    if (dir === "up" && idx > 0) [array[idx - 1], array[idx]] = [array[idx], array[idx - 1]];
    else if (dir === "down" && idx < array.length - 1) [array[idx + 1], array[idx]] = [array[idx], array[idx + 1]];
    
    const btnGuardar = document.getElementById("btn-guardar-publico");
    if (btnGuardar) btnGuardar.disabled = false;
    renderEditorUI();
    return;
  }

  // Si hicieron clic en la fila (el texto o el espacio en blanco)
  const fila = e.target.closest(".editor-item");
  if (fila && e.target.tagName !== "INPUT") {
    const { tipo, id } = fila.dataset;
    const idStr = String(id);
    let array = tipo === "categorias" ? window._editorCat : tipo === "productos" ? window._editorProductos : window._editorLocales;

    const index = array.findIndex(x => String(x) === idStr);
    if (index === -1) array.push(idStr);
    else array.splice(index, 1);

    const btnGuardar = document.getElementById("btn-guardar-publico");
    if (btnGuardar) btnGuardar.disabled = false;
    renderEditorUI();
    return;
  }
}

// Escuchar los cambios directos en los checkboxes
document.addEventListener("change", (e) => {
  if (e.target.matches('.editor-item input[type="checkbox"]')) {
    const fila = e.target.closest(".editor-item");
    const { tipo, id } = fila.dataset;
    const idStr = String(id);
    let array = tipo === "categorias" ? window._editorCat : tipo === "productos" ? window._editorProductos : window._editorLocales;

    if (e.target.checked) {
      if (!array.includes(idStr)) array.push(idStr);
    } else {
      const index = array.findIndex(x => String(x) === idStr);
      if (index > -1) array.splice(index, 1);
    }

    const btnGuardar = document.getElementById("btn-guardar-publico");
    if (btnGuardar) btnGuardar.disabled = false;
    renderEditorUI();
  }
});


/* =========================================================
   BACKOFFICE: ADMIN Y MARCAS
   ========================================================= */
const TABLAS_DB = { productos: "products", locales: "stores", categorias: "categories", recetas: "recipes" };
const NOMBRES_SINGULARES = { productos: "producto", locales: "local", categorias: "categoría", recetas: "receta" };

function pantallaAdmin() {
  const role = estado.usuario.role;
  if (role !== "administrator" && role !== "brand") return pantallaNoEncontrada();

  const tab = ui.adminTab || "productos";
  
  return layout("admin", `
    <div class="cabecera-pagina">
      <h1>Backoffice</h1>
      ${role === 'administrator' ? 
        '<span class="etiqueta" style="background:var(--marron); color:#fff">Admin Global</span>' : 
        '<button class="etiqueta" data-accion="ir-perfil-publico" style="background:var(--marron); color:#fff; border:none; cursor:pointer;">Ver mi Perfil Público</button>'
      }
    </div>

    <div class="selector-vista" style="margin-bottom:24px; max-width:600px;">
      <button data-accion="admin-tab" data-valor="productos" aria-pressed="${tab === 'productos'}">Productos</button>
      <button data-accion="admin-tab" data-valor="locales" aria-pressed="${tab === 'locales'}">Locales</button>
      <button data-accion="admin-tab" data-valor="categorias" aria-pressed="${tab === 'categorias'}">Categorías</button>
      ${role === 'administrator' ? `<button data-accion="admin-tab" data-valor="recetas" aria-pressed="${tab === 'recetas'}">Recetas</button>` : ''}
    </div>

    <section class="caja" style="position:relative; min-height:400px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
        <h2 style="text-transform:capitalize">Gestión de ${tab}</h2>
        <button class="btn btn-chico" data-accion="admin-nuevo" data-tipo="${tab}">+ Nuevo ${NOMBRES_SINGULARES[tab]}</button>
      </div>
      <div id="admin-tabla-contenedor" class="lista">
        <p class="suave">Cargando datos...</p>
      </div>
    </section>
  `);
}

async function cargarTablaAdmin(tab, role) {
  const box = document.getElementById("admin-tabla-contenedor");
  if (!box) return;
  const sb = window.fintaccSupabase;
  const tablaReal = TABLAS_DB[tab]; // <-- ACÁ ESTABA EL ERROR, AHORA SÍ BUSCA "products"
  const userId = (await sb.auth.getUser()).data.user.id;

  try {
    let query = sb.from(tablaReal).select("*").order("id", { ascending: false });
    if (role === 'brand') query = query.eq('merchant_user_id', userId);
    
    const { data, error } = await query;
    if (error) throw error;

    if (!data || !data.length) {
      box.innerHTML = `<p class="suave">No hay ${tab} cargados todavía.</p>`;
      return;
    }

    box.innerHTML = data.map(item => {
      let titulo = item.name || item.nombre || item.title;
      let subtitulo = "";
      
      if (tab === 'productos') subtitulo = `$${item.price || item.precio || 0} · ${item.category || item.categoria || 'Sin categoría'}`;
      if (tab === 'locales') subtitulo = `${item.address || item.direccion || ''} · ${item.status || 'active'}`;
      if (tab === 'recetas') subtitulo = `${item.momento || ''} · ${item.minutos || 0} min`;

      return `
        <div class="movimiento" style="align-items:center; padding:16px 0;">
          <span style="flex:1">
            <strong>${escapar(titulo)}</strong><br>
            <span class="suave chico">${escapar(subtitulo)}</span>
          </span>
          <div style="display:flex; gap:8px;">
            <button class="btn btn-chico btn-accion-editar" data-accion="admin-editar" data-tipo="${tab}" data-id="${item.id}">${icono("lapiz")}</button>
            <button class="btn btn-chico btn-accion-eliminar" data-accion="admin-borrar" data-tipo="${tab}" data-id="${item.id}">${icono("basura")}</button>
          </div>
        </div>
      `;
    }).join("");
  } catch (e) {
    box.innerHTML = `<p class="error">Error al cargar: ${e.message}</p>`;
  }
}

async function modalAdminForm(tipo, id = null) {
  const esEdicion = !!id;
  const tablaReal = TABLAS_DB[tipo];
  let item = {};
  const sb = window.fintaccSupabase;
  
  if (esEdicion) {
    const { data } = await sb.from(tablaReal).select("*").eq("id", id).single();
    if (data) item = data;
  }

  let formHTML = "";

  if (tipo === 'productos') {
    const { data: categoriasData } = await sb.from("categories").select("name");
    const categoriasExistentes = categoriasData ? categoriasData.map(c => c.name) : [];
    const categoriasSeleccionadas = (item.category || "").split(",").map(s=>s.trim());

    formHTML = `
      <div class="campo"><label>Nombre del producto</label><input name="nombre" value="${escapar(item.name || '')}" required></div>

      <div class="campo">
        <label>Categorías</label>
        <input type="text" class="cat-search-input" id="buscador-categorias" placeholder="Buscar categoría...">
        <div class="lista-checkboxes" id="lista-checkboxes-categorias">
          ${categoriasExistentes.map(c => `
            <label data-nombre="${escapar(c.toLowerCase())}">
              <input type="checkbox" name="categorias_check" value="${escapar(c)}" ${categoriasSeleccionadas.includes(c) ? 'checked' : ''}>
              ${escapar(c)}
            </label>
          `).join("")}
          ${!categoriasExistentes.length ? '<p class="suave chico" style="padding:8px;">No hay categorías creadas.</p>' : ''}
        </div>
      </div>

      <div class="campo">
        <label>Imagen del producto</label>
        <div class="file-upload-wrap" onclick="document.getElementById('input-imagen').click()">
          <span style="color:var(--teal); font-weight:600; font-size:0.9rem;">Hacé clic para subir una foto</span>
          <p>Formatos JPG o PNG</p>
          <input type="file" id="input-imagen" accept="image/*">
          <img id="preview-imagen" class="preview-img-modal" src="${item.image_url || ''}" style="${item.image_url ? 'display:block' : ''}">
        </div>
      </div>

      <div class="campo">
        <label>Precio</label>
        <div class="input-precio-wrap">
          <span>$</span>
          <input name="precio" type="text" value="${item.price || ''}" inputmode="decimal" placeholder="Ej: 1.500,50" required>
        </div>
      </div>
    `;
    } else if (tipo === 'locales') {
    formHTML = `
      <div class="campo"><label>Nombre del local</label><input name="nombre" value="${escapar(item.name || '')}" required></div>
      <div class="campo"><label>Dirección</label><input name="direccion" value="${escapar(item.address || '')}" required></div>
      
      <div class="campo">
        <label>Tipo de local</label>
        <select name="tipo" required>
          <option value="">Elegí una opción</option>
          <option ${item.type === 'Restaurante' ? 'selected' : ''}>Restaurante</option>
          <option ${item.type === 'Dietética' ? 'selected' : ''}>Dietética</option>
          <option ${item.type === 'Panadería' ? 'selected' : ''}>Panadería</option>
          <option ${item.type === 'Café' ? 'selected' : ''}>Café</option>
          <option ${item.type === 'Otro' ? 'selected' : ''}>Otro</option>
        </select>
      </div>

      <div class="campo">
        <label>Link o URL del Menú (opcional)</label>
        <input name="menu_url" value="${escapar(item.menu_url || '')}" placeholder="Ej: https://misitio.com/menu.pdf">
      </div>

      <div class="campo">
        <label>Fotos del local (múltiples)</label>
        <div class="file-upload-wrap" onclick="document.getElementById('input-imagenes').click()">
          <span style="color:var(--teal); font-weight:600; font-size:0.9rem;">Hacé clic para subir fotos</span>
          <p>Formatos JPG o PNG (podés elegir varias)</p>
          <input type="file" id="input-imagenes" accept="image/*" multiple>
        </div>
        <div id="preview-imagenes-multiples" style="display:flex; gap:8px; margin-top:8px; flex-wrap:wrap;">
          ${(item.images || []).map(img => `<img src="${img}" style="width:60px; height:60px; object-fit:cover; border-radius:8px;">`).join("")}
        </div>
      </div>
    `;
  } else if (tipo === 'categorias') {
    formHTML = `<div class="campo"><label>Nombre de la categoría</label><input name="nombre" value="${escapar(item.name || '')}" required></div>`;
  } else if (tipo === 'recetas') {
    formHTML = `
      <div class="campo"><label>Título de la receta</label><input name="nombre" value="${escapar(item.nombre || '')}" required></div>
      <div class="campo"><label>Momento del día</label><select name="momento"><option ${item.momento==='Desayuno'?'selected':''}>Desayuno</option><option ${item.momento==='Almuerzo'?'selected':''}>Almuerzo</option><option ${item.momento==='Merienda'?'selected':''}>Merienda</option><option ${item.momento==='Cena'?'selected':''}>Cena</option></select></div>
      <div class="campo"><label>Minutos</label><input name="minutos" type="number" value="${item.minutos || ''}" required></div>
    `;
  }

  const fondo = abrirModal(`
    <h2>${esEdicion ? 'Editar' : 'Nuevo'} ${NOMBRES_SINGULARES[tipo]}</h2>
    <form id="form-admin" style="margin-top:16px">
      ${formHTML}
      <button class="btn btn-ancho" style="margin-top:20px" type="submit">Guardar</button>
    </form>
  `);

  // Lógica: Imagen
  let imagenUrlTemporal = item.image_url || "";
  let imagenesLocales = item.images || []; // Array para múltiples fotos

  const inputImagen = fondo.querySelector("#input-imagen");
  const inputImagenes = fondo.querySelector("#input-imagenes");

  if (inputImagen) {
    // Lógica para producto (1 sola foto)
    inputImagen.addEventListener("change", async (e) => {
      // ... (dejá el código que ya tenías para productos)
    });
  }

  if (inputImagenes) {
    // Lógica para locales (múltiples fotos)
    inputImagenes.addEventListener("change", async (e) => {
      const files = Array.from(e.target.files);
      if (!files.length) return;
      
      const previewBox = fondo.querySelector("#preview-imagenes-multiples");
      previewBox.innerHTML = "<p class='suave chico'>Subiendo...</p>";
      
      const userId = (await sb.auth.getUser()).data.user.id;
      let nuevasUrls = [];

      for (const file of files) {
        const fileName = `${userId}-${Date.now()}-${Math.random().toString(36).substring(7)}.${file.name.split('.').pop()}`;
        const { data, error } = await sb.storage.from('brand_assets').upload(fileName, file);
        if (!error) {
          const { data: urlData } = sb.storage.from('brand_assets').getPublicUrl(fileName);
          nuevasUrls.push(urlData.publicUrl);
        }
      }
      
      imagenesLocales = [...imagenesLocales, ...nuevasUrls];
      previewBox.innerHTML = imagenesLocales.map(img => `<img src="${img}" style="width:60px; height:60px; object-fit:cover; border-radius:8px;">`).join("");
    });
  }

  // Lógica: Buscador de categorías (Mostrar máx 5 si está vacío)
  const inputBusquedaCat = fondo.querySelector("#buscador-categorias");
  const labelsCat = Array.from(fondo.querySelectorAll("#lista-checkboxes-categorias label"));
  
  const filtrarCategorias = (termino) => {
    let mostradas = 0;
    labelsCat.forEach(label => {
      const coincide = label.dataset.nombre.includes(termino.toLowerCase());
      if (coincide && (termino !== "" || mostradas < 5)) {
        label.style.display = "flex";
        if (termino === "") mostradas++;
      } else {
        label.style.display = "none";
      }
    });
  };
  if (inputBusquedaCat) {
    filtrarCategorias(""); // Inicializar mostrando solo 5
    inputBusquedaCat.addEventListener("input", (e) => filtrarCategorias(e.target.value));
  }

  // Lógica: Formatear Precio
  const inputPrecio = fondo.querySelector("input[name='precio']");
  if (inputPrecio) {
    inputPrecio.addEventListener("input", (e) => {
      let value = e.target.value.replace(/\D/g, ''); 
      if (!value) { e.target.value = ""; return; }
      if (e.target.value.includes(',')) {
        const partes = e.target.value.split(',');
        const entero = partes[0].replace(/\D/g, '');
        const decimal = partes[1] ? partes[1].replace(/\D/g, '').slice(0, 2) : '';
        e.target.value = `${Number(entero || 0).toLocaleString('es-AR')},${decimal}`;
      } else {
        e.target.value = Number(value).toLocaleString('es-AR');
      }
    });
  }

  // Guardar Formulario
  fondo.querySelector("#form-admin").addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const userId = (await sb.auth.getUser()).data.user.id;
    
    const payload = {};
    if (tipo === 'productos' || tipo === 'locales') payload.image_url = imagenUrlTemporal;

        if (tipo === 'productos') {
      const catChecks = formData.getAll("categorias_check");
      let precioString = formData.get("precio") || "0";
      precioString = precioString.replace(/\./g, '').replace(',', '.');
      
      payload.name = formData.get("nombre"); 
      
      const { data: perfilMarca } = await sb.from("profiles").select("brand_name, name").eq("id", userId).single();
      payload.brand = perfilMarca?.brand_name || perfilMarca?.name || estado.usuario.nombre;

      payload.category = catChecks.join(", ");
      payload.price = parseFloat(precioString) || 0;
    } else if (tipo === 'locales') {
      payload.name = formData.get("nombre"); 
      payload.address = formData.get("direccion");
      payload.type = formData.get("tipo");
      payload.menu_url = formData.get("menu_url");
      payload.images = imagenesLocales; // Guardamos el array de fotos
      if (imagenesLocales.length > 0) payload.image_url = imagenesLocales[0]; // Compatibilidad con la tarjeta
    }else if (tipo === 'categorias') {
      payload.name = formData.get("nombre");
    } else if (tipo === 'recetas') {
      payload.nombre = formData.get("nombre"); 
      payload.momento = formData.get("momento"); 
      payload.minutos = Number(formData.get("minutos"));
    }

    // SOLO si es edición, mantenemos el ID original. Si es nuevo, NO enviamos ID.
    if (!esEdicion) {
      payload.merchant_user_id = userId;
      if(tipo === 'locales') {
        payload.id = `local-${Date.now()}`;
        payload.qr_token = `FINTACC-STORE-${Date.now()}`;
        payload.status = 'active';
      }
    }

    // LIMPIADOR: Creamos un objeto nuevo solo con los datos que tienen valor.
    // Así evitamos enviar "null" o "undefined" a Supabase.
    const payloadLimpio = {};
    for (const key in payload) {
      if (payload[key] !== undefined && payload[key] !== null && payload[key] !== "") {
        payloadLimpio[key] = payload[key];
      }
    }

    try {
      let res;
      if (esEdicion) {
        res = await sb.from(tablaReal).update(payloadLimpio).eq("id", id);
      } else {
        res = await sb.from(tablaReal).insert(payloadLimpio);
      }
      
      if (res.error) throw res.error;

      cerrarModal();
      avisar("Guardado correctamente");
      cargarTablaAdmin(tipo, estado.usuario.role);
    } catch (err) {
      console.error("Error de Supabase:", err);
      avisar("Error al guardar: " + err.message);
    }
  });
}

function modalConfirmarBorrar(tipo, id) {
  const fondo = abrirModal(`
    <h2>Confirmar eliminación</h2>
    <p style="margin: 16px 0 24px; color: var(--texto-suave);">
      ¿Estás seguro que querés eliminar este ${NOMBRES_SINGULARES[tipo]}? Esta acción no se puede deshacer.
    </p>
    <div class="fila-botones">
      <button class="btn btn-secundario" style="flex:1" data-cerrar>Cancelar</button>
      <button class="btn" style="flex:1; background: var(--error); color: white;" id="btn-confirmar-eliminar">Eliminar</button>
    </div>
  `);
  
    fondo.querySelector("#btn-confirmar-eliminar").addEventListener("click", async () => {
    const sb = window.fintaccSupabase;
    const tablaReal = TABLAS_DB[tipo];
    try {
      // ACÁ TAMBIÉN VERIFICAMOS EL ERROR
      const { error } = await sb.from(tablaReal).delete().eq("id", id);
      if (error) throw error;

      cerrarModal();
      avisar("Eliminado correctamente");
      cargarTablaAdmin(tipo, estado.usuario.role);
    } catch (err) {
      avisar("Error al eliminar: " + err.message);
    }
  });
}

function pantallaMarca() {
  if(estado.usuario.role !== "brand" && estado.usuario.role !== "administrator") return pantallaNoEncontrada();
  return layout("",`<div class="cabecera-pagina"><h1>Panel de Marca</h1><button class="btn btn-secundario" data-accion="actualizar-compras">Actualizar</button></div><section id="qr-cajas" class="dos-columnas seccion"></section><h2 style="margin:24px 0 12px">Compras por validar</h2><div id="compras-pendientes" class="lista"><p class="suave">Cargando…</p></div>`);
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
   MODALES
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
    <h2>${escapar(receta.nombre)}</h2>
    <div class="paso-a-paso">
      <div class="numero-paso">${i + 1}<span class="suave" style="font-size:1rem"> / ${total}</span></div>
      <p>${escapar(receta.pasos[i])}</p>
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

function modalCupon(cupon) {
  abrirModal(`
    <h2>${pesos(cupon.descuento)} de descuento</h2>
    <p class="suave" style="margin-top:6px">Mostrá este código en la caja del comercio aliado.</p>
    <div class="qr" id="qr"></div>
    <p class="codigo">${cupon.codigo}</p>
    <button class="btn btn-ancho" style="margin-top:20px" data-cerrar>Listo</button>`);
  const contenedor = document.getElementById("qr");
  if (window.qrcode) {
    const qr = qrcode(0, "M");
    qr.addData(`CANJE:${cupon.codigo}:${cupon.descuento}`);
    qr.make();
    contenedor.innerHTML = qr.createSvgTag({ cellSize: 6, margin: 0, scalable: true });
    contenedor.querySelector("svg").setAttribute("style", "width:200px;height:200px");
  } else {
    contenedor.textContent = "No se pudo generar el QR. Usá el código de abajo.";
  }
}

function modalEscanearCanje() {
  const fondo = abrirModal(`
    <h2>Validar Cupón de Canje</h2>
    <p class="suave" style="margin:6px 0 16px">Escaneá el QR que muestra el usuario en su celular o ingresá el código manualmente.</p>
    
    <video id="camara-qr" playsinline style="display:none;width:100%;border-radius:16px;margin-bottom:12px"></video>
    <button class="btn btn-secundario btn-ancho" type="button" id="iniciar-escaneo" style="margin-bottom:16px;">Abrir Cámara</button>
    
    <form id="form-validar-canje">
      <div class="campo">
        <label for="codigo-cupon">Código del cupón</label>
        <input id="codigo-cupon" placeholder="Ej: A1B2C3D4" required>
        <span class="error" id="error-cupon"></span>
      </div>
      <button class="btn btn-ancho" type="submit">Validar y Marcar como Usado</button>
    </form>
  `);

  const inputCodigo = fondo.querySelector("#codigo-cupon");
  const camera = fondo.querySelector("#camara-qr");
  let stream;

  fondo.querySelector("#iniciar-escaneo").addEventListener("click", async () => {
    try {
      if (!("BarcodeDetector" in window)) throw new Error("Tu navegador no soporta escaneo. Ingresá el código a mano.");
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      camera.srcObject = stream; camera.style.display = "block"; await camera.play();
      const detector = new BarcodeDetector({formats:["qr_code"]});
      const scan = async () => {
        if (!camera.isConnected) return;
        const hits = await detector.detect(camera);
        if (hits.length) {
          // El QR generado tiene formato "CANJE:CODIGO:PRECIO"
          const token = hits[0].rawValue;
          const partes = token.split(":");
          if (partes[0] === "CANJE" && partes[1]) inputCodigo.value = partes[1];
          stream.getTracks().forEach(t => t.stop());
          camera.style.display = "none";
          avisar("Código QR leído");
        } else {
          requestAnimationFrame(scan);
        }
      };
      scan();
    } catch (e) {
      avisar(e.message || "No se pudo abrir la cámara");
    }
  });

  fondo.querySelector("#form-validar-canje").addEventListener("submit", async (e) => {
    e.preventDefault();
    const codigo = inputCodigo.value.trim().toUpperCase();
    if(!codigo) return;

    const sb = window.fintaccSupabase;
    try {
      // Buscamos el cupón en la base de datos y lo marcamos como usado
      const { data, error } = await sb.from("coupons")
        .update({ status: "used" })
        .eq("code", codigo)
        .eq("status", "active")
        .select();

      if (error) throw error;
      if (!data || data.length === 0) throw new Error("El cupón no existe o ya fue utilizado.");

      cerrarModal();
      avisar("¡Cupón validado y utilizado con éxito!");
      
      // Recargar la lista de canjes
      await prepararVista();
      render();
    } catch (err) {
      fondo.querySelector("#error-cupon").textContent = err.message;
    }
  });
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
  const ancla = e.target.closest("[data-ancla]");
  if (ancla) {
    e.preventDefault();
    ui.menuAbierto = false;
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
    case "abrir-pasos": {
      const receta = (window._db?.recetas || []).find((r) => String(r.id) === String(id));
      if (!receta) return;
      ui.paso = 0; modalPasos(normalizarReceta(receta)); return;
    }
    case "abrir-compra": modalCompra(id); return;
    case "escanear-canje": modalEscanearCanje(); return;
    case "abrir-review": modalReview(id); return;
    case "admin-tab": ui.adminTab = valor; render(); break;
    case "ir-perfil-publico":
      ui.perfilTab = "publico";
      location.hash = "#/perfil";
      break;
      case "preview-view": 
      ui.previewView = valor; 
      const device = document.getElementById("preview-device");
      if (device) {
        device.className = `preview-device ${valor}`;
        document.querySelectorAll('[data-accion="preview-view"]').forEach(btn => {
          btn.setAttribute("aria-pressed", btn.dataset.valor === valor);
        });
      }
      return;
    case "perfil-tab": ui.perfilTab = valor; render(); break;
    case "ver-perfil-marca":
      location.hash = `#/marca-publica/${id}`;
      return;
    case "admin-nuevo": modalAdminForm(el.dataset.tipo); return;
    case "admin-editar": modalAdminForm(el.dataset.tipo, el.dataset.id); return;
    case "admin-borrar": 
      modalConfirmarBorrar(el.dataset.tipo, el.dataset.id);
      return;
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

app.addEventListener("input", (e) => {
  if (!e.target.matches("[data-busqueda]")) return;
  ui.busqueda = e.target.value;
  const posicion = e.target.selectionStart;
  render();
  const input = $("[data-busqueda]");
  input.focus();
  input.setSelectionRange(posicion, posicion);
});

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
    puntos: pantallaPuntos, 
    perfil: pantallaPerfil, 
    marca: pantallaMarca, 
    admin: pantallaAdmin,
    "marca-publica": () => pantallaMarcaPublica(id) // <--- AGREGAR ESTA LÍNEA
  };
  app.innerHTML = (rutas[seccion || ""] || pantallaNoEncontrada)();
  
  iniciarMapa();
  cargarComprasPendientes();

  if (seccion === "perfil" && estado.usuario.role === "brand" && ui.perfilTab === "publico") {
    setTimeout(cargarEditorPublico, 100);
  }
  
  if (seccion === "admin") {
    setTimeout(() => {
      const tab = ui.adminTab || "productos";
      cargarTablaAdmin(tab, estado.usuario.role);
    }, 100);
  }
}

let seccionAnterior = null;
window.addEventListener("hashchange", async () => {
  const seccion = location.hash.split("/")[1] || "";
  if (seccion !== seccionAnterior) { ui.busqueda = ""; seccionAnterior = seccion; }
  ui.menuAbierto = false;
  cerrarModal();
  
  const seccionesData = ['productos', 'producto', 'locales', 'local', 'recetas', 'receta', ''];
  if (seccionesData.includes(seccion) && window.fintaccSupabase) {
      await prepararVista();
  }
  
  render();
  window.scrollTo(0, 0);
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape") cerrarModal(); });

// Arranque de la app
async function initApp() {
  if (window.fintaccSupabase) {
    await prepararVista();
  }
  render();
  hidratarCuenta();
}
initApp();