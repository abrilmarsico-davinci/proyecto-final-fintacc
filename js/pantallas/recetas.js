/* =========================================================
   Recetas
   Listado con filtros y detalle de cada receta.
   ========================================================= */

/**
 * Listado de recetas con búsqueda y filtro por momento del día.
 * @returns {string} HTML de la pantalla.
 */
function pantallaRecetas() {
  if (estado.usuario?.rol === ROLES.marca) return pantallaNoEncontrada();
  const fuente = db.recetas || [];
  const q = ui.busqueda.toLowerCase();
  const lista = fuente.filter((receta) => {
    const r = normalizarReceta(receta);
    return (ui.filtroMomento === "Todas" || r.momento === ui.filtroMomento) && r.nombre.toLowerCase().includes(q);
  });

  return estructuraPagina(
    "recetas",
    `
    <div class="cabecera-pagina"><h1>Recetas</h1><span class="contador">${lista.length} ${lista.length === 1 ? "resultado" : "resultados"}</span></div>
    ${barraFiltros("Buscar receta", ["Todas", "Desayuno", "Almuerzo", "Merienda", "Cena"], ui.filtroMomento, "filtro-momento")}
    <div class="grilla">${lista.length ? lista.map(tarjetaReceta).join("") : vacio("No encontramos recetas", "Probá con otra búsqueda o cambiá el filtro.")}</div>`
  );
}

/**
 * Detalle de una receta: ingredientes, pasos, información nutricional y dónde comprar los productos.
 * @param {string} id Id de la receta.
 * @returns {string} HTML de la pantalla.
 */
function pantallaReceta(id) {
  const original = (db.recetas || []).find((x) => String(x.id) === String(id));
  if (!original) return pantallaNoEncontrada();
  const r = normalizarReceta(original);
  const n = r.nutricion;

  // Productos de la receta y los comercios donde se consiguen
  const productos = (db.productos || []).filter((p) => r.idsProductos.includes(String(p.id)));
  const locales = [];
  productos.forEach((p) =>
    localesDeProducto(p).forEach((l) => {
      if (!locales.some((x) => x.id === l.id)) locales.push(l);
    })
  );

  return estructuraPagina(
    "recetas",
    `${volver("#/recetas", "Recetas")}
    <section class="detalle-portada ${TONO_MOMENTO[r.momento] || "t-menta"}">
      <div>${sello(r)}<h1>${escapar(r.nombre)}</h1><div class="chips"><span class="etiqueta">${escapar(r.momento)}</span><span class="etiqueta">${r.minutos} min</span></div></div>
      ${
        urlSegura(r.image_url)
          ? `<span class="icono-gigante con-imagen"><img class="imagen-cubrir" src="${urlSegura(r.image_url)}" alt=""></span>`
          : `<span class="icono-gigante">${icono(ICONO_MOMENTO[r.momento] || "libro")}</span>`
      }
    </section>
    <div class="detalle">
      <div class="columna-16">
        <div class="caja"><h2>Ingredientes</h2><p class="suave chico">Tocá cada uno a medida que lo tengas listo.</p>
          ${
            r.ingredientes.length
              ? `<ul class="lista-tildes">${r.ingredientes.map((i, k) => `<li><input type="checkbox" id="ing${k}" data-accion="ingrediente"><label for="ing${k}"><span>${escapar(i)}</span></label></li>`).join("")}</ul>`
              : '<p class="suave mt-8">Esta receta todavía no tiene ingredientes cargados.</p>'
          }
        </div>
        <div class="caja"><h2>Paso a paso</h2>
          ${
            r.pasos.length
              ? `<ol class="lista-pasos">${r.pasos.map((paso) => `<li>${escapar(paso)}</li>`).join("")}</ol>`
              : '<p class="suave mt-8">Esta receta todavía no tiene pasos cargados.</p>'
          }
        </div>
        ${
          productos.length
            ? `
        <section class="seccion">
          <h2 class="mb-16">Productos para esta receta</h2>
          <div class="grilla">${productos.map(tarjetaProducto).join("")}</div>
        </section>`
            : ""
        }
        ${
          locales.length
            ? `
        <section class="seccion">
          <h2 class="mb-16">Dónde conseguirlos</h2>
          <div class="lista">${locales.map(tarjetaLocal).join("")}</div>
        </section>`
            : ""
        }
      </div>
      <aside class="detalle-aside">
        ${
          n
            ? `<div class="caja"><h2>Información nutricional</h2><p class="suave chico">Por porción, aproximada</p>
          <div class="datos"><div class="dato"><strong>${n.calorias ?? "-"}</strong>kcal</div><div class="dato"><strong>${n.proteinas ?? "-"} g</strong>Proteínas</div><div class="dato"><strong>${n.carbohidratos ?? "-"} g</strong>Carbohidratos</div><div class="dato"><strong>${n.grasas ?? "-"} g</strong>Grasas</div></div>
        </div>`
            : ""
        }
        <div class="caja"><div class="datos sin-margen"><div class="dato"><strong>${r.minutos} min</strong>Tiempo</div><div class="dato"><strong>${r.porciones}</strong>Porciones</div></div></div>
        ${r.pasos.length ? `<button class="boton boton-tinta boton-ancho" data-accion="abrir-pasos" data-id="${escapar(r.id)}">Cocinar paso a paso</button>` : ""}
      </aside>
    </div>`
  );
}
