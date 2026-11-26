/* =========================================================
   Perfil público de marca
   Página de cada marca con sus productos, locales y categorías.
   ========================================================= */

/**
 * Contenido del perfil público de una marca. Se usa en la pantalla pública y en la vista previa del editor.
 * @param {ReturnType<typeof datosVistaMarca>} perfil Datos visibles de la marca.
 * @param {Object[]} productos Productos destacados.
 * @param {Object[]} locales Locales destacados.
 * @param {Array<{ name: string }>} categorias Categorías destacadas.
 * @param {boolean} [esVistaPrevia=false] true en la vista previa del editor (sin botón de volver).
 * @returns {string} HTML del perfil.
 */
function generarVistaMarcaHTML(perfil, productos, locales, categorias, esVistaPrevia = false) {
  const botonVolver = esVistaPrevia ? "" : volver("#/locales", "Volver");

  return `${botonVolver}
    <div class="ancho-total">
      <section class="detalle-portada t-menta ${esVistaPrevia ? "" : "mt-20"}">
        <div>
          <span class="etiqueta etiqueta-petroleo mb-12">${perfil.sinCuenta ? "Marca" : "Marca oficial"}</span>
          <h1>${escapar(perfil.brand_name || perfil.name || "Marca")}</h1>
          ${perfil.brand_description ? `<p class="suave">${escapar(perfil.brand_description)}</p>` : ""}
          ${
            perfil.website || perfil.instagram
              ? `<div class="fila-botones mt-12">
            ${urlSegura(perfil.website) ? `<a class="boton boton-chico" href="${urlSegura(perfil.website)}" target="_blank" rel="noopener">Visitar sitio web</a>` : ""}
            ${perfil.instagram ? `<a class="boton boton-chico boton-secundario" href="https://www.instagram.com/${encodeURIComponent(perfil.instagram)}/" target="_blank" rel="noopener">@${escapar(perfil.instagram)}</a>` : ""}
          </div>`
              : ""
          }
        </div>
        <span class="icono-gigante con-imagen con-logo">
          ${urlSegura(perfil.logo_url) ? `<img class="imagen-cubrir" src="${urlSegura(perfil.logo_url)}" alt="Logo de ${escapar(perfil.brand_name || perfil.name || "la marca")}" />` : escapar((perfil.brand_name || perfil.name || "M").charAt(0))}
        </span>
      </section>

      <div class="detalle mt-24">
        <div class="detalle-contenido">
          ${
            productos.length
              ? `
            <div>
              <h2 class="mb-16">Productos destacados</h2>
              <div class="grilla">${productos.map(tarjetaProducto).join("")}</div>
            </div>`
              : ""
          }
          ${
            locales.length
              ? `
            <div>
              <h2 class="mb-16">Locales de la marca</h2>
              <div class="lista">${locales.map(tarjetaLocal).join("")}</div>
            </div>`
              : ""
          }
        </div>
        <aside class="detalle-aside">
          <div class="caja">
            <h2>Categorías</h2>
            <div class="chips mt-12">
              ${categorias.map((c) => `<span class="chip">${escapar(c.name)}</span>`).join("") || '<p class="suave chico">Sin categorías cargadas</p>'}
            </div>
          </div>
        </aside>
      </div>
    </div>
  `;
}

/**
 * Perfil público de una marca (tabla brands y, si tiene cuenta, su perfil).
 * @param {string} id Id de la marca o de la cuenta dueña.
 * @returns {string} HTML de la pantalla.
 */
function pantallaMarcaPublica(id) {
  const marca =
    (db.marcas || []).find((b) => String(b.id) === String(id)) ||
    (db.marcas || []).find((b) => b.owner_user_id && String(b.owner_user_id) === String(id));
  const perfil = (db.perfiles || []).find(
    (p) => String(p.id) === String(id) || (marca?.owner_user_id && String(p.id) === String(marca.owner_user_id))
  );
  if (!marca && !perfil) return pantallaNoEncontrada();

  // Respeta el orden elegido en el editor
  const enOrden = (ids, lista) =>
    comoArray(ids)
      .map((x) => (lista || []).find((item) => String(item.id) === String(x)))
      .filter(Boolean);

  let productos, locales, categorias;
  if (perfil) {
    // Marca con cuenta: destacados elegidos en el editor
    productos = enOrden(perfil.featured_products, db.productos);
    locales = enOrden(perfil.featured_stores, db.locales);
    categorias = enOrden(perfil.featured_categories, db.categorias);
  } else {
    // Marca sin cuenta: sus locales, sus productos y sus categorías
    locales = (db.locales || []).filter((l) => String(l.brand_id) === String(marca.id));
    const idsLocales = locales.map((l) => String(l.id));
    productos = (db.productos || []).filter((p) =>
      comoArray(p.store_ids)
        .map(String)
        .some((x) => idsLocales.includes(x))
    );
    const nombres = new Set();
    productos.forEach((p) =>
      String(p.category || "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
        .forEach((n) => nombres.add(n))
    );
    categorias = [...nombres].map((name) => ({ name }));
  }

  return estructuraPagina(
    "",
    generarVistaMarcaHTML(datosVistaMarca(perfil, marca), productos, locales, categorias, false)
  );
}

/**
 * Combina el perfil de la cuenta y la fila de brands en los datos que muestra la vista de marca.
 * @param {?Object} perfil Perfil de la cuenta de la marca.
 * @param {?Object} marca Fila de la tabla brands.
 * @returns {{ name: string, brand_name: string, brand_description: string, logo_url: string, website: string, instagram: string, sinCuenta: boolean }}
 */
function datosVistaMarca(perfil, marca) {
  return {
    name: perfil?.name || marca?.name,
    brand_name: perfil?.brand_name || marca?.name,
    brand_description: perfil?.brand_description || marca?.description,
    logo_url: perfil?.logo_url || marca?.logo_url,
    website: marca?.website,
    instagram: marca?.instagram,
    sinCuenta: !perfil && !!marca && !marca.owner_user_id
  };
}
