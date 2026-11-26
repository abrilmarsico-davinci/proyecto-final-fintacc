/* =========================================================
   Tarjetas
   Tarjetas de recetas, productos y locales, y datos de marca de cada local.
   ========================================================= */

/**
 * Marca del local y perfil de la cuenta dueña, si tiene.
 * @param {Object} l Local.
 * @returns {{ marca: ?Object, perfil: ?Object }}
 */
function marcaDeLocal(l) {
  const marca = l.brand_id ? (db.marcas || []).find((b) => String(b.id) === String(l.brand_id)) : null;
  const duenio = marca?.owner_user_id || l.merchant_user_id;
  const perfil = duenio ? (db.perfiles || []).find((p) => String(p.id) === String(duenio)) : null;
  return { marca, perfil };
}

/**
 * Logo de la marca del local.
 * @param {Object} l Local.
 * @returns {string} URL del logo o cadena vacía.
 */
function logoDeLocal(l) {
  const { marca, perfil } = marcaDeLocal(l);
  return perfil?.logo_url || marca?.logo_url || "";
}

/**
 * Iniciales de la marca, para cuando no tiene logo.
 * @param {string} nombre Nombre de la marca.
 * @returns {string} Hasta dos letras en mayúscula.
 */
function inicialesMarca(nombre) {
  const palabras = String(nombre || "")
    .replace(/\(.*\)/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return palabras
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
}

/**
 * Imagen del local: logo de la marca, foto del local, iniciales o ícono, en ese orden.
 * @param {Object} l Local.
 * @returns {string} HTML de la imagen.
 */
function visualLocal(l) {
  const logo = logoDeLocal(l);
  if (urlSegura(logo)) return `<img class="logo-marca" src="${urlSegura(logo)}" alt="" />`;
  const foto = l.image_url || comoArray(l.images)[0];
  if (urlSegura(foto)) return `<img src="${urlSegura(foto)}" class="imagen-contener" alt="" />`;
  const { marca, perfil } = marcaDeLocal(l);
  const nombre = perfil?.brand_name || marca?.name;
  return nombre ? `<span class="monograma">${escapar(inicialesMarca(nombre))}</span>` : iconoLocal(l);
}

/**
 * Un local figura como verificado solo cuando el equipo lo confirmó (columna verified).
 * @param {Object} l Local.
 * @returns {boolean}
 */
const esVerificado = (l) => l.verified === true;

/**
 * Color de fondo del local según si está verificado.
 * @param {Object} l Local.
 * @returns {string} Clase de color.
 */
const tonoLocal = (l) => (esVerificado(l) ? "t-menta" : "t-tostado");

/**
 * Sello de local verificado.
 * @param {Object} l Local.
 * @returns {string} HTML del sello o cadena vacía.
 */
const selloVerificacion = (l) => (esVerificado(l) ? '<span class="sello verificado">Local verificado</span>' : "");

/**
 * Locales donde se vende un producto (columna store_ids).
 * @param {Object} p Producto.
 * @returns {Object[]}
 */
function localesDeProducto(p) {
  const ids = comoArray(p.store_ids).map(String);
  return (db.locales || []).filter((l) => ids.includes(String(l.id)));
}

/**
 * Tarjeta de receta para las grillas.
 * @param {Object} receta Fila de la tabla recipes.
 * @returns {string} HTML de la tarjeta.
 */
function tarjetaReceta(receta) {
  const r = normalizarReceta(receta);
  const nombre = r.nombre;
  const momento = r.momento;
  const minutos = r.minutos;
  const imagen = r.image_url;

  return `<a class="tarjeta" href="#/receta/${escapar(r.id)}">
    <span class="visual ${TONO_MOMENTO[momento] || "t-menta"}" >
      ${urlSegura(imagen) ? `<img src="${urlSegura(imagen)}" class="imagen-contener imagen-superpuesta" alt="" />` : icono(ICONO_MOMENTO[momento] || "libro")}
      ${sello()}
    </span>
    <div class="cuerpo"><h3>${escapar(nombre)}</h3><span class="meta">${escapar(momento)} · ${minutos} min</span></div></a>`;
}

/**
 * Nombres de los comercios donde se vende un producto, sin repetir.
 * @param {Object} p Producto.
 * @returns {string[]}
 */
function comerciosDeProducto(p) {
  const marcas = db.marcas || [];
  const nombres = [];
  localesDeProducto(p).forEach((l) => {
    const marca = l.brand_id && marcas.find((b) => String(b.id) === String(l.brand_id));
    const nombre = marca ? marca.name : String(l.name || "").replace(/\s*\(.*\)\s*$/, "");
    if (nombre && !nombres.includes(nombre)) nombres.push(nombre);
  });
  return nombres;
}

/**
 * Comercios con nombre distinto a la marca del producto.
 * @param {Object} p Producto.
 * @returns {string[]}
 */
function comerciosAparte(p) {
  const normalizar = (t) =>
    String(t || "")
      .trim()
      .toLowerCase();
  const marca = normalizar(p.brand || p.marca);
  return comerciosDeProducto(p).filter((n) => normalizar(n) !== marca);
}

/**
 * Resumen de dónde se consigue un producto.
 * @param {Object} p Producto.
 * @returns {string} Ej: "En Sintaxis y 2 más", o cadena vacía.
 */
function textoComercios(p) {
  const n = comerciosAparte(p);
  if (!n.length) return "";
  return n.length === 1 ? `En ${n[0]}` : `En ${n[0]} y ${n.length - 1} más`;
}

/**
 * Tarjeta de producto para las grillas.
 * @param {Object} p Fila de la tabla products.
 * @returns {string} HTML de la tarjeta.
 */
function tarjetaProducto(p) {
  const nombre = p.name || p.nombre;
  const categoria = p.category || p.categoria || "Almacén";
  const marca = p.brand || p.marca || "Sin marca";
  const precio = p.price || p.precio || 0;
  const imagen = p.image_url;

  return `<a class="tarjeta" href="#/producto/${escapar(p.id)}">
    <span class="visual ${TONO_CATEGORIA[categoria] || "t-menta"}" >
      ${urlSegura(imagen) ? `<img src="${urlSegura(imagen)}" class="imagen-contener imagen-superpuesta" alt="" />` : icono(ICONO_CATEGORIA[categoria] || "frasco")}
      ${sello()}
    </span>
    <div class="cuerpo"><h3>${escapar(nombre)}</h3><span class="meta">Marca: ${escapar(marca)}</span>${textoComercios(p) ? `<span class="meta">${escapar(textoComercios(p))}</span>` : ""}<span class="precio">${pesos(precio)}</span></div></a>`;
}

/**
 * Fila de local para los listados, con distancia si hay ubicación.
 * @param {Object} l Fila de la tabla stores.
 * @returns {string} HTML de la fila.
 */
function tarjetaLocal(l) {
  const nombre = l.name || l.nombre;
  const tipo = l.type || l.tipo || "Local";
  const direccion = l.address || l.direccion || "";

  return `<a class="fila" href="#/local/${escapar(l.id)}">
    <span class="icono icono-recortado ${tonoLocal(l)}" aria-hidden="true">${visualLocal(l)}</span>
    <div class="cuerpo"><h3>${escapar(nombre)}</h3><span class="meta">${escapar(tipo)} · ${escapar(direccion)}${l._dist != null ? ` · <strong>${textoDistancia(l._dist)}</strong>` : ""} · ${estrellas(promedio(l.id, l.rating))}</span>
    ${selloVerificacion(l)}</div></a>`;
}

/**
 * Sello circular giratorio de la página de bienvenida (decorativo).
 * @returns {string} HTML del sello.
 */
function selloGiratorio() {
  return `<div class="sello-giratorio" aria-hidden="true">
    <svg viewBox="0 0 150 150"><defs><path id="circulo" d="M75 75 m-60 0 a60 60 0 1 1 120 0 a60 60 0 1 1 -120 0"/></defs>
      <circle cx="75" cy="75" r="74"/>
      <text font-family="Poppins, sans-serif" font-size="13" font-weight="700"><textPath href="#circulo" textLength="370" lengthAdjust="spacing">VERIFICADO · COMÉ SEGURO · SIN VUELTAS · </textPath></text>
    </svg>
    <span class="centro"><img src="${MARCA.mono}" alt=""></span>
  </div>`;
}
