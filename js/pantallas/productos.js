/* =========================================================
   Productos
   Listado con filtros y detalle de cada producto.
   ========================================================= */

/**
 * Estado del listado paginado: productos ya traídos, filtros con los que se pidieron y página siguiente.
 * @type {{ clave: ?string, productos: Object[], total: number, pagina: number, hayMas: boolean, cargando: boolean, error: string }}
 */
const listadoProductos = { clave: null, productos: [], total: 0, pagina: 0, hayMas: true, cargando: false, error: "" };

/** Observer que pide la página siguiente cuando el final del listado entra en pantalla. */
let observadorProductos = null;

/** Temporizador para no consultar la base en cada tecla del buscador. */
let esperaBusquedaProductos = null;

/** Milisegundos que se espera después de la última tecla antes de buscar. */
const ESPERA_BUSQUEDA = 300;

/**
 * Identifica la combinación de filtros actual. Si cambia, el listado se pide de nuevo desde la primera página.
 * @returns {string}
 */
function claveFiltrosProductos() {
  return [ui.busqueda.trim().toLowerCase(), ui.categoria, estado.usuario?.id].join("|");
}

/**
 * Texto que resume cuántos productos se muestran.
 * @returns {string}
 */
function textoEstadoProductos() {
  const { productos, total, hayMas, cargando } = listadoProductos;
  if (cargando && hayMas && productos.length) return "Cargando más productos…";
  if (!productos.length) return "";
  return hayMas ? `Mostrando ${productos.length} de ${total} productos` : `Se muestran los ${total} productos`;
}

/**
 * Listado de productos con búsqueda, filtro por categoría y scroll infinito.
 * Los productos se piden de a páginas; las categorías salen del catálogo completo.
 * @returns {string} HTML de la pantalla.
 */
function pantallaProductos() {
  const fuente = db.productos || [];
  const categorias = ["Todas", ...new Set(fuente.map((p) => p.category || "Almacén").filter(Boolean))];
  const { productos, total, hayMas, cargando, error } = listadoProductos;
  const primeraCarga = cargando && !productos.length;

  let contenido;
  if (error) contenido = vacio("No pudimos cargar los productos", escapar(error));
  else if (primeraCarga) contenido = '<p class="suave centrado">Cargando productos…</p>';
  else if (!productos.length)
    contenido = vacio("No encontramos productos", "Probá con otra búsqueda o cambiá el filtro.");
  else contenido = productos.map(tarjetaProducto).join("");

  return estructuraPagina(
    "productos",
    `
    <div class="cabecera-pagina"><h1>Productos</h1><span class="contador">${primeraCarga ? "Buscando…" : `${total} ${total === 1 ? "resultado" : "resultados"}`}</span></div>
    ${barraFiltros("Buscar producto o marca", categorias, ui.categoria, "filtro-categoria")}
    <div class="grilla" id="grilla-productos">${contenido}</div>
    <p class="suave chico centrado mt-16" id="estado-productos" role="status">${textoEstadoProductos()}</p>
    ${hayMas && productos.length ? '<div class="centinela" id="centinela-productos" aria-hidden="true"></div>' : ""}`
  );
}

/**
 * Prepara el listado después de dibujar la pantalla: si cambiaron los filtros lo pide de nuevo
 * (esperando a que se termine de escribir) y, si no, conecta el scroll infinito.
 */
function prepararListadoProductos() {
  const clave = claveFiltrosProductos();
  if (listadoProductos.clave === clave) {
    observarFinalProductos();
    return;
  }
  Object.assign(listadoProductos, {
    clave,
    productos: [],
    total: 0,
    pagina: 0,
    hayMas: true,
    cargando: true,
    error: ""
  });
  clearTimeout(esperaBusquedaProductos);
  esperaBusquedaProductos = setTimeout(() => cargarPaginaProductos(true), ESPERA_BUSQUEDA);
}

/**
 * Pide la página siguiente de productos y la agrega al listado.
 * La primera página vuelve a dibujar la pantalla; las siguientes se agregan al final de la grilla.
 * @param {boolean} [primera=false] true si es la primera página de una búsqueda nueva.
 * @returns {Promise<void>}
 */
async function cargarPaginaProductos(primera = false) {
  if (!primera && (listadoProductos.cargando || !listadoProductos.hayMas)) return;
  const clave = listadoProductos.clave;
  listadoProductos.cargando = true;
  actualizarEstadoProductos();

  try {
    const pagina = await listarProductos({
      busqueda: ui.busqueda,
      categoria: ui.categoria,
      pagina: listadoProductos.pagina,
      usuario: estado.usuario
    });
    // Si los filtros cambiaron mientras se esperaba la respuesta, se descarta
    if (clave !== listadoProductos.clave) return;
    listadoProductos.productos.push(...pagina.productos);
    listadoProductos.total = pagina.total;
    listadoProductos.hayMas = pagina.hayMas;
    listadoProductos.pagina += 1;
    listadoProductos.cargando = false;

    if (primera) redibujarConservandoBusqueda();
    else agregarProductosAlListado(pagina.productos);
  } catch (error) {
    if (clave !== listadoProductos.clave) return;
    Object.assign(listadoProductos, { cargando: false, hayMas: false, error: error.message });
    redibujarConservandoBusqueda();
  }
}

/**
 * Agrega una página de productos a la grilla sin volver a dibujar la pantalla, para no perder el scroll.
 * @param {Object[]} productos Productos de la página nueva.
 */
function agregarProductosAlListado(productos) {
  document.getElementById("grilla-productos")?.insertAdjacentHTML("beforeend", productos.map(tarjetaProducto).join(""));
  actualizarEstadoProductos();
  if (listadoProductos.hayMas) {
    // Se vuelve a observar: si el final sigue a la vista, el observer avisa de nuevo
    observarFinalProductos();
  } else {
    observadorProductos?.disconnect();
    document.getElementById("centinela-productos")?.remove();
  }
}

/**
 * Actualiza el texto que indica cuántos productos se muestran.
 */
function actualizarEstadoProductos() {
  const texto = document.getElementById("estado-productos");
  if (texto) texto.textContent = textoEstadoProductos();
}

/**
 * Vuelve a dibujar la pantalla y devuelve el foco y el cursor al buscador si estaba en uso.
 */
function redibujarConservandoBusqueda() {
  const buscador = document.activeElement?.matches("[data-busqueda]") ? document.activeElement : null;
  const posicion = buscador?.selectionStart;
  render();
  if (!buscador) return;
  const nuevo = $("[data-busqueda]");
  nuevo?.focus();
  nuevo?.setSelectionRange(posicion, posicion);
}

/**
 * Observa el final del listado con IntersectionObserver y pide la página siguiente cuando aparece en pantalla.
 */
function observarFinalProductos() {
  observadorProductos?.disconnect();
  const centinela = document.getElementById("centinela-productos");
  if (!centinela) return;
  observadorProductos = new IntersectionObserver(
    (entradas) => {
      if (entradas.some((entrada) => entrada.isIntersecting)) cargarPaginaProductos();
    },
    { rootMargin: "300px 0px" }
  );
  observadorProductos.observe(centinela);
}

/**
 * Detalle de un producto con sus reviews y los locales donde se vende.
 * @param {string} id Id del producto.
 * @returns {string} HTML de la pantalla.
 */
function pantallaProducto(id) {
  const p = (db.productos || []).find((x) => String(x.id) === String(id));
  if (!p) return pantallaNoEncontrada();

  // Locales donde se vende: primero store_ids; si no tiene, los locales de su comercio
  let donde = localesDeProducto(p);
  if (!donde.length && p.merchant_user_id)
    donde = (db.locales || []).filter((l) => l.merchant_user_id === p.merchant_user_id);
  const categoria = p.category || "Almacén";
  const marca = p.brand || "Marca";

  return estructuraPagina(
    "productos",
    `${volver("#/productos", "Productos")}
    <section class="detalle-portada ${TONO_CATEGORIA[categoria] || "t-menta"}">
      <div>${sello(p)}<h1>${escapar(p.name)}</h1><p class="suave mb-12">Marca: ${escapar(marca)} · ${escapar(categoria)}${comerciosAparte(p).length ? ` · Se vende en ${escapar(comerciosAparte(p).join(", "))}` : ""}</p><div class="chips"><span class="etiqueta">Libre de gluten</span><span class="etiqueta">Con registro RNPA</span></div></div>
      <span class="icono-gigante con-imagen">
        ${urlSegura(p.image_url) ? `<img class="imagen-cubrir" src="${urlSegura(p.image_url)}" alt="${escapar(p.name)}" />` : icono(ICONO_CATEGORIA[categoria] || "frasco")}
      </span>
    </section>
    <div class="detalle">
      <div>${seccionReviews(p.id)}</div>
      <aside class="detalle-aside">
        <div class="caja"><p class="suave chico">Precio de referencia</p><p class="precio precio-grande">${pesos(p.price || 0)}</p></div>
        ${donde.length ? `<div><h2 class="mb-14">Dónde comprarlo</h2><div class="lista">${donde.map(tarjetaLocal).join("")}</div></div>` : ""}
      </aside>
    </div>`
  );
}
