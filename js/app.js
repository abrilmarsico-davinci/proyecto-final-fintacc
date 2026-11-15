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
  const profile=async(user)=>check(await sb.from("profiles").select("id,name,role,points,earned,brand_logo_url").eq("id",user.id).single());
  const requireAdmin=async()=>{const user=await currentUser(),p=await profile(user);if(p.role!=="administrator")throw new Error("Esta acción requiere rol administrador.");return {user,p};};
  const requireAdminOrBrand=async()=>{const user=await currentUser(),p=await profile(user);if(!["administrator","brand"].includes(p.role))throw new Error("Esta acción requiere rol administrador o marca.");return {user,p};};
  const mapStore=x=>({...x,nombre:x.name,tipo:x.type,barrio:x.neighborhood,direccion:x.address,horario:x.hours,rating:x.rating||0,verificado:x.verified,verificacion:x.verification||[],menu:x.menu||[],imagen:x.image_url,x:x.map_x||50,y:x.map_y||50});
  const mapProduct=x=>({...x,nombre:x.name,marca:x.brand,categoria:x.category,precio:x.price,imagen:x.image_url,locales:x.store_ids||[]});
  const mapRecipe=x=>({...x,nombre:x.name,momento:x.moment,minutos:x.minutes,porciones:x.servings,nutricion:{calorias:x.nutrition?.calories||0,proteinas:x.nutrition?.proteins||0,carbohidratos:x.nutrition?.carbohydrates||0,grasas:x.nutrition?.grasas||x.nutrition?.fat||0},ingredientes:x.ingredients||[],pasos:x.steps||[],productos:x.product_ids||[],locales:x.store_ids||[]});
  if(path==="/catalog" && method==="GET") {
    const [stores,products,recipes]=await Promise.all([sb.from("stores").select("*").eq("status","active").eq("public_visible",true).order("display_order").order("name"),sb.from("products").select("*").eq("active",true).eq("public_visible",true).order("display_order").order("name"),sb.from("recipes").select("*").eq("active",true).order("name")]);
    return {stores:check(stores).map(mapStore),products:check(products).map(mapProduct),recipes:check(recipes).map(mapRecipe)};
  }
  if(path==="/admin/catalog" && method==="GET") {
    const {user,p}=await requireAdminOrBrand();
    const profileQuery=sb.from("profiles").select("id,name,role,points,earned,created_at,brand_logo_url").order("created_at");
    const queries=[sb.from("stores").select("*").order("name"),sb.from("products").select("*").order("name"),profileQuery,sb.from("brand_customers").select("brand_user_id,customer_user_id,created_at"),sb.from("product_categories").select("*").order("name")];
    if(p.role==="administrator")queries.push(sb.from("profiles").select("id,name,role,created_at,brand_logo_url").eq("role","brand").order("name"));
    if(p.role==="administrator")queries.push(sb.from("recipes").select("*").order("name"));
    const [stores,products,profiles,links,categories,...extras]=await Promise.all(queries);
    const brands=p.role==="administrator"?check(extras[0]):[];
    const recipes=p.role==="administrator"?check(extras[1]):[];
    return {role:p.role,stores:check(stores),products:check(products),recipes,categories:check(categories),profiles:check(profiles),brands,brandCustomers:check(links),currentUserId:user.id,currentProfile:p};
  }
  if(path==="/admin/clients/link" && method==="POST") {
    const {user,p}=await requireAdminOrBrand();
    return check(await sb.rpc("link_brand_customer",{p_brand_user_id:p.role==="administrator"?body.brand_user_id:user.id,p_customer_email:body.email}));
  }
  if(path==="/admin/clients" && method==="GET") {
    const {p}=await requireAdminOrBrand();
    return check(await sb.from("profiles").select("id,name,points,earned,role").order("name"));
  }
  if(path.startsWith("/admin/clients/search") && method==="GET") {
    await requireAdminOrBrand();
    const q=new URLSearchParams(path.split("?")[1]||"").get("q")||"";
    return check(await sb.rpc("search_brand_customers",{p_query:q}));
  }
  if(path==="/admin/brand-logo" && method==="PATCH") {
    await requireAdminOrBrand();
    return check(await sb.rpc("update_brand_logo",{p_logo_url:body.brand_logo_url}));
  }
  if(path==="/admin/categories" && method==="POST") {
    const {user,p}=await requireAdminOrBrand();
    return check(await sb.from("product_categories").insert({brand_user_id:p.role==="brand"?user.id:body.brand_user_id,name:body.name.trim()}).select().single());
  }
  const pointsMatch=path.match(/^\/admin\/clients\/([^/]+)\/points$/);
  if(pointsMatch && method==="PATCH") {
    await requireAdminOrBrand();
    return check(await sb.rpc("manage_client_points",{p_user_id:decodeURIComponent(pointsMatch[1]),p_delta:Number(body.delta),p_detail:body.detail}));
  }
  const adminProfileMatch=path.match(/^\/admin\/profiles\/([^/]+)$/);
  if(adminProfileMatch && method==="PATCH") {
    await requireAdmin();
    return check(await sb.rpc("admin_update_profile",{p_user_id:decodeURIComponent(adminProfileMatch[1]),p_name:body.name,p_role:body.role}));
  }
  const adminMatch=path.match(/^\/admin\/(stores|products|recipes|profiles)(?:\/([^/]+))?$/);
  if(adminMatch && method!=="GET") {
    const {user,p}=await requireAdminOrBrand();
    const table=adminMatch[1],id=adminMatch[2];
    if(table==="profiles")throw new Error("Los perfiles solo se editan desde su formulario de administración.");
    if(table==="recipes") { await requireAdmin(); }
    const payload={...body};
    if(p.role==="brand") { if(!["stores","products"].includes(table))throw new Error("Las marcas solo gestionan sus locales y productos.");payload.brand_user_id=user.id; }
    if(method==="DELETE") return table==="stores"?check(await sb.from(table).update({status:"inactive"}).eq("id",id)):check(await sb.from(table).update({active:false}).eq("id",id));
    const result=method==="PATCH"?await sb.from(table).update(payload).eq("id",id).select().single():await sb.from(table).insert(payload).select().single(); return check(result);
  }

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
  if(path==="/me" && method==="GET") {
    const user=await currentUser(), p=await profile(user);
    const [moves,coupons]=await Promise.all([
      sb.from("movements").select("detail,points,date:created_at").eq("user_id",user.id).order("id",{ascending:false}),
      sb.from("coupons").select("code,points,discount,status").eq("user_id",user.id).order("id",{ascending:false})
    ]);
    return {...p,name:p.name,email:user.email,history:check(moves),coupons:check(coupons)};
  }
  if(path==="/me" && method==="PATCH") {
    await currentUser();
    return check(await sb.rpc("update_own_profile",{p_name:body.name}));
  }
  if(path==="/reviews" && method==="GET") {
    const {p}=await requireAdminOrBrand();if(p.role!=="administrator")throw new Error("Solo un administrador puede consultar reseñas con sesión iniciada.");
    return check(await sb.from("reviews").select("target,stars,text,author,created_at").order("id",{ascending:false}));
  }
  if(path==="/reviews" && method==="POST") {
    const {user,p}=await requireAdmin();
    return check(await sb.from("reviews").insert({user_id:user.id,author:p.name,target:body.target,stars:body.stars,text:body.text}).select().single());
  }
  if(path==="/stores" && method==="GET") return check(await sb.from("stores").select("id,name,qr_token").eq("status","active").eq("public_visible",true));
  if(path==="/purchases" && method==="POST") throw new Error("Los puntos los gestiona la marca del local.");
  if(path==="/coupons" && method==="POST") return check(await sb.rpc("redeem_coupon",{p_points:Number(body.points)}));
  if(path==="/merchants" && method==="POST") return check(await sb.from("merchants").insert({name:body.name,email:body.email,type:body.type,address:body.address,status:"pending"}));
  if(path==="/merchant/purchases" && method==="GET") {
    await requireAdminOrBrand();
    const since=new Date(Date.now()-24*60*60*1000).toISOString();
    return check(await sb.from("purchases").select("id,amount,points,created_at,store:stores(name)").eq("status","pending").gt("created_at",since).order("created_at")).map(p=>({...p,store:p.store?.name || "Comercio"}));
  }
  if(path==="/merchant/stores" && method==="GET") {
    const {user,p}=await requireAdminOrBrand(); const q=sb.from("stores").select("id,name,qr_token").eq("status","active");if(p.role==="brand")q.eq("brand_user_id",user.id);return check(await q);
  }
  const confirm=path.match(/^\/merchant\/purchases\/(\d+)\/confirm$/);
  if(confirm && method==="POST") {await requireAdminOrBrand();return check(await sb.rpc("confirm_purchase",{p_purchase_id:Number(confirm[1]),p_receipt:body.receipt}));}
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
    if(cuenta.role!=="user")try { const catalog=await api("/catalog"); CATALOGOS.stores=catalog.stores; CATALOGOS.products=catalog.products; CATALOGOS.recipes=cuenta.role==="administrator"?catalog.recipes:RECETAS; } catch(_) { CATALOGOS.stores=LOCALES; CATALOGOS.products=PRODUCTOS; CATALOGOS.recipes=RECETAS; }
    estado.usuario = { id: cuenta.id, nombre: cuenta.name, email: cuenta.email, role: cuenta.role, brand_logo_url: cuenta.brand_logo_url };
    estado.puntos = cuenta.points; estado.puntosGanados = cuenta.earned;
    estado.historial = cuenta.history || []; estado.cupones = cuenta.coupons || [];
    if(cuenta.role==="administrator")estado.reviews = (await api("/reviews")).map(r => ({ objetivo:r.target, autor:r.author, estrellas:r.stars, texto:r.text }));
    render();
  } catch (_) { estado={...estadoInicial(),marca:estado.marca}; render(); }
}

/* ---------- Utilidades ---------- */
const $ = (selector) => app.querySelector(selector);
const pesos = (n) => "$" + n.toLocaleString("es-AR");
const marca = () => MARCAS[estado.marca];
const CATALOGOS={stores:LOCALES,products:PRODUCTOS,recipes:RECETAS};

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
  const secciones=estado.usuario.role==="user"?[SECCIONES.find(x=>x[0]==="puntos")]:SECCIONES;
  const admin=estado.usuario.role==="administrator";
  return `
    <header class="topbar"><div class="barra-vidrio">
      <a class="logo-link" href="${estado.usuario.role==="user"?"#/perfil":"#/"}" aria-label="${marca().nombre}, ir al inicio"><img class="imagotipo" src="${marca().logo}" alt="Fintacc"></a>
      <nav class="menu ${ui.menuAbierto ? "abierto" : ""}" id="menu" aria-label="Navegación principal">
        ${secciones.map(([id, texto, href]) => `<a href="${href}" ${actual === id ? 'aria-current="page"' : ""}>${texto}</a>`).join("")}
        <a class="solo-movil" href="#/perfil" ${actual === "perfil" ? 'aria-current="page"' : ""}>Mi perfil</a>
        ${estado.usuario.role !== "user" ? `<a class="backoffice-nav" href="#/admin">${admin?"Administración global":"Mi marca"}</a>` : ''}
        ${estado.usuario.role !== "user" ? '<a class="backoffice-nav" href="#/comercio">Validar compras</a>' : ''}
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
    <span class="visual ${TONO_CATEGORIA[p.categoria] || "t-menta"}" >${p.imagen?`<img src="${escapar(p.imagen)}" alt="${escapar(p.nombre)}" loading="lazy">`:icono(ICONO_CATEGORIA[p.categoria])}${sello(p)}</span>
    <span class="cuerpo"><h3>${p.nombre}</h3><span class="meta">${p.marca}</span><span class="precio">${pesos(p.precio)}</span></span></a>`;
}
function tarjetaLocal(l) {
  return `<a class="fila" href="#/local/${l.id}">
    <span class="icono ${tonoLocal(l)}" aria-hidden="true">${l.imagen?`<img src="${escapar(l.imagen)}" alt="" loading="lazy">`:iconoLocal(l)}</span>
    <span class="cuerpo"><h3>${l.nombre}</h3><span class="meta">${l.barrio} · ${estrellas(promedio(l.id, l.rating))}</span>
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
  const recetas = CATALOGOS.recipes;
  const productos = CATALOGOS.products;
  const locales = CATALOGOS.stores.filter((l) => l.verificado);
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
  const lista = CATALOGOS.recipes.filter((r) => (ui.filtroMomento === "Todas" || r.momento === ui.filtroMomento) && r.nombre.toLowerCase().includes(q));
  return layout("recetas", `
    <div class="cabecera-pagina"><h1>Recetas</h1><span class="contador">${lista.length} ${lista.length === 1 ? "resultado" : "resultados"}</span></div>
    ${barraFiltros("Buscar receta", ["Todas", "Desayuno", "Almuerzo", "Merienda", "Cena"], ui.filtroMomento, "filtro-momento")}
    <div class="grilla">${lista.length ? lista.map(tarjetaReceta).join("") : vacio("No encontramos recetas", "Probá con otra búsqueda o cambiá el filtro.")}</div>`);
}

function pantallaReceta(id) {
  const r = CATALOGOS.recipes.find((x) => x.id === id);
  if (!r) return pantallaNoEncontrada();
  const n = r.nutricion;
  const relacionados=[...(r.productos||[]).map(pid=>{const p=CATALOGOS.products.find(x=>x.id===pid);return p?`<a href="#/producto/${p.id}">${escapar(p.nombre)}</a>`:null;}),...(r.locales||[]).map(sid=>{const l=CATALOGOS.stores.find(x=>x.id===sid);return l?`<a href="#/local/${l.id}">${escapar(l.nombre)}</a>`:null;})].filter(Boolean);
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
        ${relacionados.length?`<div class="caja"><h2>Productos y locales</h2><div class="lista">${relacionados.join(" · ")}</div></div>`:""}
        <button class="btn btn-tinta btn-ancho" data-accion="abrir-pasos" data-id="${r.id}">Cocinar paso a paso</button>
      </aside>
    </div>`);
}

function pantallaProductos() {
  const categorias = ["Todas", ...new Set(CATALOGOS.products.map((p) => p.categoria))];
  const q = ui.busqueda.toLowerCase();
  const lista = CATALOGOS.products.filter((p) => (ui.categoria === "Todas" || p.categoria === ui.categoria) && (p.nombre + " " + p.marca).toLowerCase().includes(q));
  return layout("productos", `
    <div class="cabecera-pagina"><h1>Productos</h1><span class="contador">${lista.length} ${lista.length === 1 ? "resultado" : "resultados"}</span></div>
    ${barraFiltros("Buscar producto o marca", categorias, ui.categoria, "filtro-categoria")}
    <div class="grilla">${lista.length ? lista.map(tarjetaProducto).join("") : vacio("No encontramos productos", "Probá con otra búsqueda o cambiá el filtro.")}</div>`);
}

function pantallaProducto(id) {
  const p = CATALOGOS.products.find((x) => x.id === id);
  if (!p) return pantallaNoEncontrada();
  const donde = CATALOGOS.stores.filter((l) => p.locales.includes(l.id));
  return layout("productos", `${volver("#/productos", "Productos")}
    <section class="detalle-hero ${TONO_CATEGORIA[p.categoria] || "t-menta"}">
      <div>${sello(p)}<h1>${p.nombre}</h1><p class="suave" style="margin-bottom:12px">${p.marca} · ${p.categoria}</p><div class="chips"><span class="etiqueta">Libre de gluten</span><span class="etiqueta">Con registro RNPA</span></div></div>
      ${p.imagen?`<img class="detail-image" src="${escapar(p.imagen)}" alt="${escapar(p.nombre)}">`:`<span class="icono-gigante">${icono(ICONO_CATEGORIA[p.categoria])}</span>`}
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
  const lista = CATALOGOS.stores;
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
  CATALOGOS.stores.forEach(l => { const point=l.latitude!=null&&l.longitude!=null?[Number(l.latitude),Number(l.longitude)]:coords[l.id]; if(point) L.marker(point).addTo(map).bindPopup(`<a href="#/local/${l.id}"><strong>${escapar(l.nombre)}</strong></a><br>${escapar(l.barrio)}${l.verificado ? " · Verificado" : ""}`); });
  window._fintaccMap = map;
  setTimeout(()=>map.invalidateSize(),120);
}

function pantallaLocal(id) {
  const l = CATALOGOS.stores.find((x) => x.id === id);
  if (!l) return pantallaNoEncontrada();
  const menu = l.menu;
  return layout("locales", `${volver("#/locales", "Locales")}
    <section class="detalle-hero ${tonoLocal(l)}">
      <div>${l.verificado ? '<span class="sello verificado">Local verificado</span>' : '<span class="sello no-apto">Sin verificar</span>'}
        <h1>${l.nombre}</h1><p class="suave">${l.barrio} · ${estrellas(promedio(l.id, l.rating))}</p></div>
      ${l.imagen?`<img class="detail-image" src="${escapar(l.imagen)}" alt="${escapar(l.nombre)}">`:`<span class="icono-gigante">${iconoLocal(l)}</span>`}
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
      </aside>
    </div>`);
}

/* ---------- Comunidad: reviews en locales y productos ---------- */
function seccionReviews(id) {
  const lista = reviewsDe(id);
  return `<section class="caja">
    <h2>Comunidad</h2>
    ${lista.length ? lista.map((r) => `<div class="review"><p><strong>${escapar(r.autor)}</strong></p>${estrellas(r.estrellas)}<p style="margin-top:4px">${escapar(r.texto)}</p></div>`).join("") : '<p class="suave" style="margin:8px 0">Todavía no hay reviews. Sé la primera persona en opinar.</p>'}
    ${estado.usuario.role==="administrator"?`<button class="btn btn-secundario btn-ancho" style="margin-top:14px" data-accion="abrir-review" data-id="${id}">Escribir una review</button>`:""}
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
    <div class="cabecera-pagina"><h1>Mi perfil</h1><span class="contador">${escapar(estado.usuario.email)}</span></div>
    ${estado.usuario.role==="brand"?`<div class="backoffice-only"><form class="caja" data-profile-edit><h2>Datos personales</h2><label class="campo">Nombre<input name="name" required minlength="2" value="${escapar(estado.usuario.nombre)}"></label><button class="btn">Guardar datos personales</button></form><section class="caja" style="margin-top:16px"><h2>Perfil público</h2><p class="suave">Elegí qué mostrar y en qué orden. El logo aparece junto a tu marca.</p><div id="perfil-marca-publico">Cargando locales y productos…</div></section></div><div class="desktop-only-notice caja">La edición del perfil de marca está disponible desde una computadora.</div>`:`<form class="caja" data-profile-edit><h2>Datos de la cuenta</h2><label class="campo">Nombre<input name="name" required minlength="2" value="${escapar(estado.usuario.nombre)}"></label><button class="btn">Guardar perfil</button></form>`}
    ${estado.usuario.role==="user"?`<section class="caja" style="margin-top:16px"><h2>Mis puntos</h2><p class="grande">${estado.puntos} pts</p><a class="btn btn-secundario" href="#/puntos">Ver y canjear puntos</a></section>`:""}
    ${estado.usuario.role !== "user" ? `<div class="fila-botones backoffice-only" style="margin-top:16px"><a class="btn" href="#/admin">${estado.usuario.role==="administrator"?"Administrar todo":"Administrar mi marca"}</a><a class="btn btn-secundario" href="#/comercio">Validar compras</a></div>${estado.usuario.role==="brand"?'<div class="desktop-only-notice caja">Las herramientas de marca están disponibles desde una computadora.</div>':''}` : ''}
    <section class="fila-botones" style="margin-top:24px"><button class="btn btn-secundario" data-accion="cerrar-sesion">Cerrar sesión</button></section>
  </div>`);
}

function pantallaComercio() {
  if(!["brand","administrator"].includes(estado.usuario.role)) return pantallaNoEncontrada();
  return layout("",`<div class="backoffice-only"><div class="cabecera-pagina"><h1>Validar compras</h1><button class="btn btn-secundario" data-accion="actualizar-compras">Actualizar</button></div><section id="qr-cajas" class="dos-columnas seccion"></section><h2 style="margin:24px 0 12px">Compras por validar</h2><div id="compras-pendientes" class="lista"><p class="suave">Cargando…</p></div></div><div class="desktop-only-notice caja">La validación de compras está disponible desde una computadora.</div>`);
}

async function cargarComprasPendientes() {
  if(window.matchMedia("(max-width: 960px)").matches)return;
  const box=document.getElementById("compras-pendientes"); if(!box)return;
  try {
    const [items,stores]=await Promise.all([api("/merchant/purchases"),api("/merchant/stores")]);
    const qrBox=document.getElementById("qr-cajas"); if(qrBox){qrBox.innerHTML=stores.map((s,i)=>`<article class="caja"><h2>${escapar(s.name)} · QR de caja</h2><div class="qr" id="qr-caja-${i}"></div><button type="button" class="btn btn-secundario" data-accion="descargar-qr" data-token="${escapar(s.qr_token)}" data-nombre="${escapar(s.name)}">Descargar QR para imprimir</button><p class="suave chico">Este QR no vence.</p></article>`).join("");stores.forEach((s,i)=>{if(window.qrcode){const qr=qrcode(0,"M");qr.addData(s.qr_token);qr.make();const target=document.getElementById(`qr-caja-${i}`);target.innerHTML=qr.createSvgTag({cellSize:5,margin:0,scalable:true});target.querySelector("svg").style="width:180px;height:180px";}});}
    box.innerHTML=items.length?items.map(p=>`<form class="caja formulario-validacion" data-compra="${p.id}"><h2>${escapar(p.store)} · ${pesos(p.amount)}</h2><p class="suave">Compra ${p.id} · ${p.points} puntos potenciales</p><div class="campo"><label>Número de ticket</label><input name="receipt" required minlength="4" placeholder="Ej: A-001-000123" /></div><button class="btn">Validar compra</button></form>`).join(""):'<div class="vacio"><strong>No hay compras pendientes</strong>Las compras escaneadas aparecerán acá durante 24 horas.</div>';
  }
  catch(error){box.innerHTML=`<p class="error">${escapar(error.message)}</p>`;}
}

function pantallaNoEncontrada() {
  return layout("", `${volver("#/", "Inicio")}${vacio("No encontramos esta página", "Volvé al inicio para seguir navegando.")}`);
}
function pantallaAdmin() {
  if(!["administrator","brand"].includes(estado.usuario.role)) return pantallaNoEncontrada();
  const admin=estado.usuario.role==="administrator";
  return layout("",`<div class="backoffice-only"><div class="cabecera-pagina"><div><h1>${admin?"Administración global":"Mi marca"}</h1><p class="suave">Locales, productos, clientes y operación diaria.</p></div><div class="fila-botones">${estado.usuario.role==="brand"?'<a class="btn" href="#/comercio">Validar compras</a>':''}<button class="btn btn-secundario" data-accion="admin-recargar">Actualizar</button></div></div>
    <p class="suave seccion">${admin?"Gestionás todas las marcas, catálogos, perfiles y puntos.":"Gestionás solo tus locales, productos y clientes asociados."} Los cambios se guardan directamente en Supabase.</p>
    <div id="admin-catalogo" class="lista"><p class="suave">Cargando datos sincronizados…</p></div></div><div class="desktop-only-notice caja">El backoffice está disponible desde una computadora para que puedas gestionar tus datos con comodidad.</div>`);
}
async function cargarAdmin() {
  if(window.matchMedia("(max-width: 960px)").matches)return;
  const box=document.getElementById("admin-catalogo");if(!box)return;
  try { const d=await api("/admin/catalog");
    const rows=(table,items,labels)=>`<section class="caja admin-seccion"><h2>${labels}</h2><form class="admin-form" data-admin-form="${table}">${adminFields(table,d)}<button class="btn">Agregar ${table==="stores"?"local":table==="products"?"producto":"receta"}</button></form><div class="admin-rows">${items.map(x=>{const enabled=table==="stores"?x.status!=="inactive":x.active!==false;return `<article class="admin-row"><div><strong>${escapar(x.name)}</strong><p class="suave chico">${table==="stores"?`${escapar(x.address||'')} · ${escapar(x.neighborhood||'')}`:table==="products"?`${escapar(x.category)} · ${pesos(Number(x.price))}`:""}</p></div><div class="fila-botones"><button class="btn btn-secundario" type="button" data-accion="admin-editar" data-tabla="${table}" data-id="${escapar(x.id)}">Editar</button><label class="switch-control"><input type="checkbox" data-estado-tabla="${table}" data-id="${escapar(x.id)}" ${enabled?"checked":""}><span></span><span class="suave chico">${enabled?"Activo":"Inactivo"}</span></label>${table==="stores"?`<button class="btn btn-secundario" type="button" data-accion="descargar-qr" data-token="${escapar(x.qr_token)}" data-nombre="${escapar(x.name)}">Descargar QR</button>`:""}</div></article>`;}).join("")||'<p class="suave">Todavía no hay registros. Completá el formulario para agregar el primero.</p>'}</div></section>`;
    const admin=d.role==="administrator";
    const linkForm=`<section class="caja admin-seccion"><h2>Clientes y puntos</h2><p class="suave chico">Buscá por nombre o email para asociar clientes y gestionar sus puntos.</p><form class="admin-link-client" data-link-client>${admin?`<label class="campo">Marca<select name="brand_user_id" required>${d.brands.map(b=>`<option value="${b.id}">${escapar(b.name)}</option>`).join("")}</select></label>`:`<input name="brand_user_id" type="hidden" value="${d.currentUserId}">`}<label class="campo">Buscar usuario<input name="customer_search" type="search" autocomplete="off" minlength="2" placeholder="Nombre o email" data-client-search><input name="email" type="hidden" required><div class="client-search-results" data-client-results></div></label><button class="btn" disabled>Asociar cliente seleccionado</button></form>${d.brandCustomers.filter(link=>admin||link.brand_user_id===d.currentUserId).map(link=>{const x=d.profiles.find(p=>p.id===link.customer_user_id);return x?`<article class="admin-row"><strong>${escapar(x.name)} · ${x.points} puntos</strong><form class="admin-points" data-client-points="${x.id}"><input name="delta" type="number" step="1" required placeholder="+ / − puntos"><input name="detail" required minlength="3" placeholder="Motivo"><button class="btn btn-secundario">Ajustar puntos</button></form></article>`:""}).join("")}</section>`;
    const forms=admin?`${rows("recipes",d.recipes,"Recetas")}<section class="caja admin-seccion"><h2>Perfiles y roles</h2>${d.profiles.map(x=>`<article class="admin-row"><form class="admin-role" data-admin-role="${x.id}"><strong>${escapar(x.name)}</strong><input name="name" required value="${escapar(x.name)}" aria-label="Nombre"><select name="role"><option value="user" ${x.role==="user"?"selected":""}>Usuario</option><option value="brand" ${x.role==="brand"?"selected":""}>Marca</option><option value="administrator" ${x.role==="administrator"?"selected":""}>Administrador</option></select><button class="btn btn-secundario">Guardar perfil</button></form><form class="admin-points" data-client-points="${x.id}"><strong>${x.points} puntos</strong><input name="delta" type="number" step="1" required placeholder="+ / − puntos"><input name="detail" required minlength="3" placeholder="Motivo"><button class="btn btn-secundario">Ajustar puntos</button></form></article>`).join("")}</section>${linkForm}`:linkForm;
    const categoryForm=admin?`<section class="caja admin-seccion"><h2>Categorías</h2><form class="admin-link-client" data-category-form><select name="brand_user_id" required>${d.brands.map(b=>`<option value="${b.id}">${escapar(b.name)}</option>`).join("")}</select><input name="name" required minlength="2" placeholder="Nueva categoría"><button class="btn">Crear categoría</button></form><p class="suave chico">Cada categoría pertenece a una marca.</p></section>`:"";
    box.innerHTML=`${rows("stores",d.stores,"Locales")}${rows("products",d.products,"Productos")}${categoryForm}${forms}`;
  } catch(e){box.innerHTML=`<p class="error">${escapar(e.message)}</p>`;}
}
function adminFields(t,d){
  const brands=d.brands||[],defaultOwner=brands[0]?.id, owner=estado.usuario.role==="administrator"?`<label class="campo">Marca propietaria<select name="brand_user_id" required>${brands.map(b=>`<option value="${b.id}">${escapar(b.name)}</option>`).join("")}</select></label>`:"";
  if(t==="stores")return `<label class="campo">Nombre del local<input name="name" required placeholder="Ej.: TACC OFF"></label><label class="campo">Barrio<input name="neighborhood" required placeholder="Ej.: Palermo"></label><label class="campo">Dirección<input name="address" required placeholder="Ej.: Gorriti 4800"></label><label class="campo">Horarios<input name="hours" placeholder="Lun a sáb · 9 a 20 h"></label><label class="campo">Foto del local<input name="image" type="file" accept="image/png,image/jpeg,image/webp"><small>JPG, PNG o WebP · hasta 5 MB</small></label><label class="switch-control"><input name="active" type="checkbox" value="true" checked><span></span><span>Local activo</span></label>${owner}`;
  if(t==="products"){
    const categories=d.categories||[];
    const stores=d.stores.filter(s=>estado.usuario.role!=="brand"||s.brand_user_id===estado.usuario.id);
    return `<label class="campo">Nombre del producto<input name="name" required placeholder="Ej.: Pan de campo"></label>${owner}<label class="campo">Categoría<select name="category" required><option value="">Elegir categoría</option>${categories.map(c=>`<option value="${escapar(c.name)}" data-category-brand="${c.brand_user_id}" ${defaultOwner&&c.brand_user_id!==defaultOwner?"hidden":""}>${escapar(c.name)}</option>`).join("")}<option value="__new">+ Crear categoría</option></select></label><label class="campo hidden" data-new-category-field>Nueva categoría<input name="new_category" placeholder="Nombre de categoría"></label><label class="campo">Precio<input name="price" type="text" inputmode="decimal" autocomplete="off" required placeholder="Ej.: 12.500,50" data-price-format><small>Solo números. Usá coma para centavos.</small></label><fieldset class="campo selector-dropdown"><legend>Locales donde se vende</legend><details class="multi-select"><summary>Seleccionar locales</summary><div class="multi-select-options">${stores.map(s=>`<label><input type="checkbox" name="store_ids" value="${escapar(s.id)}" data-store-brand="${s.brand_user_id}" ${defaultOwner&&s.brand_user_id!==defaultOwner?"hidden":""}><span>${escapar(s.name)}</span></label>`).join("")||'<span class="suave chico">Primero agregá un local para esta marca.</span>'}</div></details><small>Elegí todos los locales en los que se vende.</small></fieldset><label class="campo">Foto del producto<input name="image" type="file" accept="image/png,image/jpeg,image/webp"><small>JPG, PNG o WebP · hasta 5 MB</small></label>`;
  }
  return `<label class="campo">Nombre<input name="name" required></label><label class="campo">Momento<select name="moment"><option>Desayuno</option><option>Almuerzo</option><option>Merienda</option><option>Cena</option></select></label><label class="campo">Minutos<input name="minutes" type="number" min="1" required></label><label class="campo">Porciones<input name="servings" type="number" min="1" required></label><label class="campo">Calorías<input name="calories" type="number" min="0"></label><label class="campo">Proteínas (g)<input name="proteins" type="number" min="0"></label><label class="campo">Carbohidratos (g)<input name="carbs" type="number" min="0"></label><label class="campo">Grasas (g)<input name="fat" type="number" min="0"></label><label class="campo">Ingredientes<textarea name="ingredients" placeholder="Un ingrediente por línea"></textarea></label><label class="campo">Preparación<textarea name="steps" placeholder="Un paso por línea"></textarea></label><fieldset class="campo selector-dropdown"><legend>Productos relacionados</legend><details class="multi-select"><summary>Seleccionar productos</summary><div class="multi-select-options">${d.products.map(x=>`<label><input type="checkbox" name="product_ids" value="${escapar(x.id)}"><span>${escapar(x.name)}</span></label>`).join("")}</div></details></fieldset><fieldset class="campo selector-dropdown"><legend>Locales relacionados</legend><details class="multi-select"><summary>Seleccionar locales</summary><div class="multi-select-options">${d.stores.map(x=>`<label><input type="checkbox" name="store_ids" value="${escapar(x.id)}"><span>${escapar(x.name)}</span></label>`).join("")}</div></details></fieldset>`;
}

async function guardarImagen(file,folder){
  if(!file||!file.size)return null;
  if(!/^image\/(jpeg|png|webp)$/.test(file.type)||file.size>5*1024*1024)throw new Error("La imagen debe ser JPG, PNG o WebP y pesar hasta 5 MB.");
  const sb=window.fintaccSupabase,{data:userData,error:userError}=await sb.auth.getUser();if(userError)throw userError;
  const ext=file.type.split("/")[1].replace("jpeg","jpg"),path=`${userData.user.id}/${folder}/${crypto.randomUUID()}.${ext}`;
  const {error}=await sb.storage.from("brand-assets").upload(path,file,{upsert:false,contentType:file.type});if(error)throw error;
  return sb.storage.from("brand-assets").getPublicUrl(path).data.publicUrl;
}
async function geocodificarLocal(address,neighborhood){
  const query=`${address}, ${neighborhood}, Buenos Aires, Argentina`;
  const url=`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=ar&q=${encodeURIComponent(query)}`;
  const response=await fetch(url,{headers:{Accept:"application/json"}});if(!response.ok)throw new Error("No se pudo ubicar la dirección. Revisá la conexión e intentá otra vez.");
  const [place]=await response.json();if(!place)throw new Error("No encontramos esa dirección. Revisá la calle y el barrio.");
  return {latitude:Number(place.lat),longitude:Number(place.lon)};
}
function normalizarPrecio(value){const clean=String(value||"").replace(/\./g,"").replace(",",".").replace(/[^0-9.]/g,"");const n=Number(clean);if(!Number.isFinite(n)||n<0)throw new Error("Ingresá un precio válido usando coma para los decimales.");return n;}
async function cargarPerfilMarca(){
  if(window.matchMedia("(max-width: 960px)").matches)return;
  const box=document.getElementById("perfil-marca-publico");if(!box)return;
  try{const d=await api("/admin/catalog"),stores=d.stores.filter(x=>x.brand_user_id===estado.usuario.id),products=d.products.filter(x=>x.brand_user_id===estado.usuario.id);
    const choices=(kind,items)=>`<section class="public-items"><h3>${kind==="stores"?"Locales visibles":"Productos visibles"}</h3>${items.map((x,i)=>`<label class="public-item"><input type="checkbox" name="${kind}" value="${x.id}" ${x.public_visible!==false?"checked":""}><span>${escapar(x.name)}</span><input aria-label="Orden de ${escapar(x.name)}" type="number" name="${kind}_order_${x.id}" value="${x.display_order??i+1}" min="1"><span class="suave chico">Orden</span></label>`).join("")||'<p class="suave">Todavía no hay registros.</p>'}</section>`;
    box.innerHTML=`<form data-brand-public-profile><label class="campo">Logo de la marca<input name="brand_logo" type="file" accept="image/png,image/jpeg,image/webp"><small>JPG, PNG o WebP · hasta 5 MB</small></label>${estado.usuario.brand_logo_url?`<img class="brand-logo-preview" src="${escapar(estado.usuario.brand_logo_url)}" alt="Logo actual de ${escapar(estado.usuario.nombre)}">`:""}${choices("stores",stores)}${choices("products",products)}<button class="btn">Guardar perfil público</button></form>`;
  }catch(e){box.innerHTML=`<p class="error">${escapar(e.message)}</p>`;}
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
  const aliados = CATALOGOS.stores.filter((l) => l.verificado);
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
  const clientPick=e.target.closest("[data-select-customer]");
  if(clientPick){const form=clientPick.closest("[data-link-client]");form.querySelector('[name="email"]').value=clientPick.dataset.email;form.querySelector('[name="customer_search"]').value=`${clientPick.dataset.name} · ${clientPick.dataset.email}`;form.querySelector('[type="submit"]').disabled=false;form.querySelector("[data-client-results]").innerHTML="";return;}
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
    case "admin-recargar": cargarAdmin(); return;
    case "descargar-qr": {if(!window.qrcode){avisar("No se pudo generar el QR.");return;}const qr=qrcode(0,"H");qr.addData(el.dataset.token);qr.make();const a=document.createElement("a");a.href=qr.createDataURL(10,4);a.download=`qr-${(el.dataset.nombre||"local").toLowerCase().replace(/[^a-z0-9]+/g,"-")}.png`;a.click();return;}
    case "admin-baja": { const tabla=el.dataset.tabla,id=el.dataset.id;if(!confirm("¿Dar de baja este registro?"))return;try{await api(`/admin/${tabla}/${encodeURIComponent(id)}`,{method:"DELETE"});await cargarAdmin();avisar("Registro dado de baja");}catch(error){avisar(error.message);}return; }
    case "admin-editar": { const table=el.dataset.tabla,id=el.dataset.id;try{const catalog=await api("/admin/catalog"),item=(table==="stores"?catalog.stores:table==="products"?catalog.products:catalog.recipes).find(x=>x.id===id);if(!item)throw new Error("No encontramos el registro.");const fields=table==="stores"?`<label class="campo">Barrio<input name="neighborhood" required value="${escapar(item.neighborhood||"")}"></label><label class="campo">Dirección<input name="address" required value="${escapar(item.address||"")}"></label><label class="campo">Horarios<input name="hours" value="${escapar(item.hours||"")}"></label>`:table==="products"?`<input name="brand_user_id" type="hidden" value="${escapar(item.brand_user_id||"")}"><label class="campo">Categoría<select name="category" required>${catalog.categories.filter(c=>c.brand_user_id===item.brand_user_id).map(c=>`<option ${c.name===item.category?"selected":""}>${escapar(c.name)}</option>`).join("")}<option value="__new">+ Crear categoría</option></select></label><label class="campo hidden" data-new-category-field>Nueva categoría<input name="new_category"></label><label class="campo">Precio<input name="price" data-price-format inputmode="decimal" required value="${Number(item.price).toLocaleString("es-AR")}"></label><fieldset class="campo selector-dropdown"><legend>Locales donde se vende</legend><details class="multi-select"><summary>Seleccionar locales</summary><div class="multi-select-options">${catalog.stores.filter(s=>s.brand_user_id===item.brand_user_id).map(s=>`<label><input type="checkbox" name="store_ids" value="${escapar(s.id)}" ${item.store_ids.includes(s.id)?"checked":""}><span>${escapar(s.name)}</span></label>`).join("")}</div></details></fieldset>`:`<label class="campo">Momento<select name="moment">${["Desayuno","Almuerzo","Merienda","Cena"].map(m=>`<option ${item.moment===m?"selected":""}>${m}</option>`).join("")}</select></label><label class="campo">Minutos<input name="minutes" type="number" min="1" required value="${item.minutes}"></label><label class="campo">Porciones<input name="servings" type="number" min="1" required value="${item.servings}"></label><label class="campo">Calorías<input name="calories" type="number" value="${item.nutrition?.calories||0}"></label><label class="campo">Proteínas<input name="proteins" type="number" value="${item.nutrition?.proteins||0}"></label><label class="campo">Carbohidratos<input name="carbs" type="number" value="${item.nutrition?.carbohydrates||0}"></label><label class="campo">Grasas<input name="fat" type="number" value="${item.nutrition?.fat||0}"></label><label class="campo">Ingredientes<textarea name="ingredients">${escapar((item.ingredients||[]).join("\n"))}</textarea></label><label class="campo">Preparación<textarea name="steps">${escapar((item.steps||[]).join("\n"))}</textarea></label>`;abrirModal(`<h2>Editar ${table==="stores"?"local":table==="products"?"producto":"receta"}</h2><form data-admin-edit="${table}" data-id="${escapar(id)}"><label class="campo">Nombre<input name="name" required value="${escapar(item.name)}"></label>${fields}${table==="stores"||table==="products"?`<label class="campo">Cambiar foto<input type="file" name="image" accept="image/png,image/jpeg,image/webp"></label>`:""}<button class="btn">Guardar cambios</button><button class="btn btn-secundario" type="button" data-cerrar>Cancelar</button></form>`);return;}catch(error){avisar(error.message);return;} }
    case "filtro-momento": ui.filtroMomento = valor; break;
    case "filtro-categoria": ui.categoria = valor; break;
    case "vista-locales": ui.vistaLocales = valor; break;
    case "ingrediente": el.closest("li").classList.toggle("tachado", el.checked); return;
    case "abrir-pasos": ui.paso = 0; modalPasos(CATALOGOS.recipes.find((r) => r.id === id)); return;
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
  if(e.target.matches("[data-price-format]")){const input=e.target;const raw=input.value.replace(/[^0-9,]/g,"");const parts=raw.split(",");const integer=(parts[0]||"").replace(/\B(?=(\d{3})+(?!\d))/g,".");input.value=integer+(parts.length>1?`,`+parts.slice(1).join("").slice(0,2):"");input.setSelectionRange(input.value.length,input.value.length);return;}
  if(e.target.matches("[data-client-search]")){const input=e.target,form=input.closest("[data-link-client]"),results=form.querySelector("[data-client-results]");form.querySelector('[name="email"]').value="";form.querySelector('[type="submit"]').disabled=true;clearTimeout(window._clientSearchTimer);const query=input.value.trim();if(query.length<2){results.innerHTML="";return;}window._clientSearchTimer=setTimeout(async()=>{try{const matches=await api(`/admin/clients/search?q=${encodeURIComponent(query)}`);results.innerHTML=matches.length?matches.map(x=>`<button class="client-search-option" type="button" data-select-customer data-email="${escapar(x.email)}" data-name="${escapar(x.name)}"><strong>${escapar(x.name)}</strong><span>${escapar(x.email)}</span></button>`).join(""):'<span class="suave chico">No encontramos usuarios con ese nombre o email.</span>';}catch(error){results.innerHTML=`<span class="error">${escapar(error.message)}</span>`;}},250);return;}
  if (!e.target.matches("[data-busqueda]")) return;
  ui.busqueda = e.target.value;
  const posicion = e.target.selectionStart;
  render();
  const input = $("[data-busqueda]");
  input.focus();
  input.setSelectionRange(posicion, posicion);
});

app.addEventListener("change",async(e)=>{
  const toggle=e.target.closest("[data-estado-tabla]");if(toggle){const table=toggle.dataset.estadoTabla,field=table==="stores"?"status":"active",value=table==="stores"?(toggle.checked?"active":"inactive"):toggle.checked;toggle.disabled=true;try{await api(`/admin/${table}/${encodeURIComponent(toggle.dataset.id)}`,{method:"PATCH",body:JSON.stringify({[field]:value})});await cargarAdmin();avisar(value==="inactive"||value===false?"Registro pausado":"Registro activado");}catch(error){toggle.checked=!toggle.checked;avisar(error.message);}finally{toggle.disabled=false;}return;}
  const categorySelect=e.target.closest('select[name="category"]');if(categorySelect){const form=categorySelect.closest("form"),newField=form.querySelector("[data-new-category-field]");if(newField){newField.classList.toggle("hidden",categorySelect.value!=="__new");if(categorySelect.value==="__new")newField.querySelector("input").focus();}}
  const multi=e.target.closest(".multi-select-options input[type=checkbox]");if(multi){const details=multi.closest("details"),count=details.querySelectorAll('input[type="checkbox"]:checked').length;details.querySelector("summary").textContent=count?`${count} seleccionado${count===1?"":"s"}`:"Seleccionar";}
  const owner=e.target.closest('[data-admin-form="products"] select[name="brand_user_id"]');if(owner){const form=owner.closest("form"),category=form.querySelector('select[name="category"]');[...category.options].forEach(option=>{if(option.dataset.categoryBrand)option.hidden=option.dataset.categoryBrand!==owner.value;});category.value="";form.querySelectorAll('[name="store_ids"]').forEach(input=>{input.hidden=input.dataset.storeBrand!==owner.value;input.checked=false;input.closest("label").hidden=input.hidden;});}
});

// Formulario de registro / ingreso con validación
app.addEventListener("submit", async (e) => {
  const profileForm=e.target.closest("[data-profile-edit]");if(profileForm){e.preventDefault();try{const data=Object.fromEntries(new FormData(profileForm));const saved=await api("/me",{method:"PATCH",body:JSON.stringify(data)});estado.usuario.nombre=saved.name;render();avisar("Perfil actualizado");}catch(error){avisar(error.message);}return;}
  const editForm=e.target.closest("[data-admin-edit]");if(editForm){e.preventDefault();const fd=new FormData(editForm),d=Object.fromEntries(fd),table=editForm.dataset.adminEdit;try{let payload={};if(table==="stores"){const point=await geocodificarLocal(d.address,d.neighborhood),image=await guardarImagen(fd.get("image"),"stores");payload={name:d.name,address:d.address,neighborhood:d.neighborhood,hours:d.hours,latitude:point.latitude,longitude:point.longitude};if(image)payload.image_url=image;}else if(table==="products"){let category=d.category;if(category==="__new"){if(!d.new_category?.trim())throw new Error("Escribí el nombre de la categoría.");await api("/admin/categories",{method:"POST",body:JSON.stringify({brand_user_id:d.brand_user_id,name:d.new_category.trim()})});category=d.new_category.trim();}const store_ids=fd.getAll("store_ids");if(!store_ids.length)throw new Error("Elegí al menos un local.");const image=await guardarImagen(fd.get("image"),"products");payload={name:d.name,category,price:normalizarPrecio(d.price),store_ids};if(image)payload.image_url=image;}else{payload={name:d.name,moment:d.moment,minutes:Number(d.minutes),servings:Number(d.servings),nutrition:{calories:Number(d.calories)||0,proteins:Number(d.proteins)||0,carbohydrates:Number(d.carbs)||0,fat:Number(d.fat)||0},ingredients:d.ingredients.split("\n").map(x=>x.trim()).filter(Boolean),steps:d.steps.split("\n").map(x=>x.trim()).filter(Boolean)};}await api(`/admin/${table}/${encodeURIComponent(editForm.dataset.id)}`,{method:"PATCH",body:JSON.stringify(payload)});cerrarModal();await cargarAdmin();avisar("Cambios guardados");}catch(error){avisar(error.message);}return;}
  const roleForm=e.target.closest("[data-admin-role]");if(roleForm){e.preventDefault();try{const data=Object.fromEntries(new FormData(roleForm));await api(`/admin/profiles/${roleForm.dataset.adminRole}`,{method:"PATCH",body:JSON.stringify(data)});await cargarAdmin();avisar("Perfil actualizado");}catch(error){avisar(error.message);}return;}
  const linkForm=e.target.closest("[data-link-client]");if(linkForm){e.preventDefault();try{const data=Object.fromEntries(new FormData(linkForm));await api("/admin/clients/link",{method:"POST",body:JSON.stringify(data)});await cargarAdmin();avisar("Cliente asociado a la marca");}catch(error){avisar(error.message);}return;}
  const pointsForm=e.target.closest("[data-client-points]");if(pointsForm){e.preventDefault();try{const data=Object.fromEntries(new FormData(pointsForm));await api(`/admin/clients/${pointsForm.dataset.clientPoints}/points`,{method:"PATCH",body:JSON.stringify({delta:Number(data.delta),detail:data.detail})});await cargarAdmin();avisar("Puntos actualizados");}catch(error){avisar(error.message);}return;}
  const publicForm=e.target.closest("[data-brand-public-profile]");if(publicForm){e.preventDefault();const submit=publicForm.querySelector('[type="submit"]');submit.disabled=true;try{const logo=await guardarImagen(publicForm.elements.brand_logo.files[0],"logo");if(logo){const saved=await api("/admin/brand-logo",{method:"PATCH",body:JSON.stringify({brand_logo_url:logo})});estado.usuario.brand_logo_url=saved.brand_logo_url;}const kinds=["stores","products"];for(const table of kinds){const visible=new Set([...publicForm.querySelectorAll(`input[name="${table}"]:checked`)].map(x=>x.value));const items=table==="stores"?await api("/admin/catalog").then(d=>d.stores.filter(x=>x.brand_user_id===estado.usuario.id)):await api("/admin/catalog").then(d=>d.products.filter(x=>x.brand_user_id===estado.usuario.id));await Promise.all(items.map(item=>{const order=Number(publicForm.elements[`${table}_order_${item.id}`]?.value)||0;return api(`/admin/${table}/${encodeURIComponent(item.id)}`,{method:"PATCH",body:JSON.stringify({public_visible:visible.has(item.id),display_order:order})});}));}await cargarPerfilMarca();avisar("Perfil público actualizado");}catch(error){avisar(error.message);}finally{submit.disabled=false;}return;}
  const categoryForm=e.target.closest("[data-category-form]");if(categoryForm){e.preventDefault();try{const data=Object.fromEntries(new FormData(categoryForm));await api("/admin/categories",{method:"POST",body:JSON.stringify(data)});await cargarAdmin();avisar("Categoría creada");}catch(error){avisar(error.message);}return;}
  const adminForm=e.target.closest("[data-admin-form]");if(adminForm){e.preventDefault();const formData=new FormData(adminForm),t=adminForm.dataset.adminForm,d=Object.fromEntries(formData);try{let payload={};if(t==="stores"){const location=await geocodificarLocal(d.address,d.neighborhood),image_url=await guardarImagen(formData.get("image"),"stores");payload={name:d.name,brand_user_id:d.brand_user_id||estado.usuario.id,address:d.address,neighborhood:d.neighborhood,hours:d.hours||"",latitude:location.latitude,longitude:location.longitude,status:d.active?"active":"inactive",image_url,rating:0,verified:false,verification:[],menu:[]};}
      if(t==="products"){const brand_user_id=d.brand_user_id||estado.usuario.id;let category=d.category;if(category==="__new"){if(!d.new_category?.trim())throw new Error("Escribí el nombre de la categoría nueva.");await api("/admin/categories",{method:"POST",body:JSON.stringify({brand_user_id,name:d.new_category.trim()})});category=d.new_category.trim();}const store_ids=formData.getAll("store_ids");if(!store_ids.length)throw new Error("Elegí al menos un local para este producto.");const image_url=await guardarImagen(formData.get("image"),"products");payload={name:d.name,brand_user_id,category,price:normalizarPrecio(d.price),store_ids,image_url,active:true};}
      if(t==="recipes")payload={name:d.name,moment:d.moment,minutes:Number(d.minutes),servings:Number(d.servings),nutrition:{calories:Number(d.calories)||0,proteins:Number(d.proteins)||0,carbohydrates:Number(d.carbs)||0,fat:Number(d.fat)||0},ingredients:d.ingredients.split("\n").map(x=>x.trim()).filter(Boolean),steps:d.steps.split("\n").map(x=>x.trim()).filter(Boolean),product_ids:formData.getAll("product_ids"),store_ids:formData.getAll("store_ids"),active:true};
      await api(`/admin/${t}`,{method:"POST",body:JSON.stringify(payload)});adminForm.reset();await cargarAdmin();avisar("Registro agregado y sincronizado");}catch(error){avisar(error.message);}return;}
  const brandProfileForm=e.target.closest("[data-brand-public-profile]");if(brandProfileForm)return;
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
  let [, seccion, id] = location.hash.replace(/^#/, "").split("/");
  if(estado.usuario.role==="user"&&!(["perfil","puntos"].includes(seccion||""))){location.hash="#/perfil";seccion="perfil";}
  const rutas = {
    "": pantallaInicio, admin:pantallaAdmin,
    recetas: pantallaRecetas, receta: () => pantallaReceta(id),
    productos: pantallaProductos, producto: () => pantallaProducto(id),
    locales: pantallaLocales, local: () => pantallaLocal(id),
    puntos: pantallaPuntos, perfil: pantallaPerfil, comercio: pantallaComercio
  };
  app.innerHTML = (rutas[seccion || ""] || pantallaNoEncontrada)();
  iniciarMapa();
  cargarComprasPendientes();
  cargarAdmin();
  cargarPerfilMarca();
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
