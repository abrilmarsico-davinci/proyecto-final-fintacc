/* =========================================================
   Locales
   Listado, mapa con filtro por cercanía y detalle de cada local.
   ========================================================= */

/**
 * Coordenadas del local.
 * @param {Object} l Local.
 * @returns {?[number, number]} [latitud, longitud] o null si no tiene.
 */
function coordenadasLocal(l) {
  const lat = Number(l.latitude),
    lng = Number(l.longitude);
  if (l.latitude == null || l.longitude == null || l.latitude === "" || l.longitude === "") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return [lat, lng];
}

/**
 * Distancia entre dos puntos con la fórmula de Haversine.
 * @param {[number, number]} origen [latitud, longitud].
 * @param {[number, number]} destino [latitud, longitud].
 * @returns {number} Distancia en kilómetros.
 */
function distanciaKm([lat1, lng1], [lat2, lng2]) {
  const rad = (g) => (g * Math.PI) / 180,
    R = 6371;
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Distancia legible, redondeada a 50 m o en km con un decimal.
 * @param {number} km Distancia en kilómetros.
 * @returns {string} Ej: "a 350 m" o "a 2,4 km".
 */
function textoDistancia(km) {
  const metros = Math.round((km * 1000) / 50) * 50;
  return metros < 1000 ? `a ${metros} m` : `a ${km.toLocaleString("es-AR", { maximumFractionDigits: 1 })} km`;
}

/**
 * Locales filtrados por búsqueda y, si hay ubicación, por radio y ordenados por cercanía.
 * @returns {Object[]} Locales con la distancia calculada en _dist.
 */
function localesFiltrados() {
  const q = ui.busqueda.toLowerCase();
  let lista = (db.locales || [])
    .filter((l) => `${l.name || ""} ${l.neighborhood || ""} ${l.type || ""}`.toLowerCase().includes(q))
    .map((l) => {
      const c = coordenadasLocal(l);
      return { ...l, _dist: ui.ubicacion && c ? distanciaKm(ui.ubicacion, c) : null };
    });
  if (ui.ubicacion) {
    const radio = RADIOS_LOCALES[ui.radioLocales];
    if (radio) lista = lista.filter((l) => l._dist != null && l._dist <= radio);
    lista.sort((a, b) => (a._dist ?? Infinity) - (b._dist ?? Infinity));
  }
  return lista;
}

/**
 * Pide la ubicación del navegador. Solo se llama cuando el usuario lo solicita.
 */
function pedirUbicacion() {
  if (!navigator.geolocation) {
    avisar("La geolocalización no está disponible en este navegador.", "error");
    return;
  }
  avisar("Buscando tu ubicación...");
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      ui.ubicacion = [pos.coords.latitude, pos.coords.longitude];
      ui.localesVisibles = LOCALES_POR_PAGINA;
      render();
    },
    () => avisar("No se pudo acceder a tu ubicación. Revisá los permisos del navegador.", "error"),
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

/**
 * Listado y mapa de locales, con filtro por cercanía y paginado.
 * @returns {string} HTML de la pantalla.
 */
function pantallaLocales() {
  const lista = localesFiltrados();
  const visibles = lista.slice(0, ui.localesVisibles);
  const vista = ui.vistaLocales;
  const radios = Object.keys(RADIOS_LOCALES);

  return estructuraPagina(
    "locales",
    `
    <div class="cabecera-pagina"><h1>Locales</h1><div class="fila-botones centrar-items">
      <span class="contador">${lista.length} ${lista.length === 1 ? "local" : "locales"}</span>
      <div class="selector-vista solo-movil" role="group" aria-label="Cambiar vista">
        <button data-accion="vista-locales" data-valor="lista" aria-pressed="${vista === "lista"}">Lista</button>
        <button data-accion="vista-locales" data-valor="mapa" aria-pressed="${vista === "mapa"}">Mapa</button>
      </div></div></div>
    ${barraFiltros("Buscar por nombre, barrio o tipo", radios, ui.ubicacion ? ui.radioLocales : "", "filtro-cercania")}
    <div class="aviso-ubicacion">
      ${
        ui.ubicacion
          ? `<span>Ordenados por cercanía a tu ubicación.</span><button class="boton boton-chico boton-secundario" data-accion="quitar-ubicacion">Quitar ubicación</button>`
          : `<span>Activá tu ubicación para ver los locales más cercanos.</span><button class="boton boton-chico" data-accion="usar-ubicacion">Usar mi ubicación</button>`
      }
    </div>
    <div class="locales-vista">
      <div class="${vista === "mapa" ? "solo-escritorio" : ""}">
        <div class="lista">${visibles.length ? visibles.map(tarjetaLocal).join("") : vacio("No encontramos locales", ui.ubicacion && RADIOS_LOCALES[ui.radioLocales] ? "No hay locales en ese radio. Probá con una distancia mayor." : "Probá con otra búsqueda.")}</div>
        ${
          lista.length > visibles.length
            ? `
          <div class="ver-mas-locales">
            <p class="suave chico">Mostrando ${visibles.length} de ${lista.length} locales</p>
            <button class="boton boton-secundario" data-accion="ver-mas-locales">Ver más locales</button>
          </div>`
            : ""
        }
      </div>
      <div class="${vista === "lista" ? "solo-escritorio" : ""}">${mapa(lista)}</div>
    </div>`
  );
}

/**
 * Contenedor del mapa de Leaflet. Los marcadores se agregan en iniciarMapa().
 * @param {Object[]} lista Locales que se van a mostrar en el mapa.
 * @returns {string} HTML del mapa.
 */
function mapa(lista) {
  return `<div id="mapa-leaflet" class="mapa mapa-leaflet" role="application" aria-label="Mapa de locales sin TACC"></div>
  <p class="suave chico mt-8">Mapa de OpenStreetMap. La ubicación se solicita solo cuando tocás "Usar mi ubicación".</p>`;
}

/**
 * Crea el mapa de Leaflet si la pantalla tiene uno y agrega los locales, la ubicación y el radio elegido.
 */
function iniciarMapa() {
  const contenedor = document.getElementById("mapa-leaflet");
  if (!contenedor || !window.L) return;

  const mapaLocales = L.map(contenedor).setView([-34.6037, -58.435], 11);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap" }).addTo(
    mapaLocales
  );

  // En Locales, el mapa usa la lista filtrada
  const localesAMostrar = location.hash.startsWith("#/locales") ? localesFiltrados() : db.locales || [];

  // Los locales sin coordenadas no aparecen en el mapa, pero siguen en la lista
  localesAMostrar.forEach((l) => {
    const coordenadas = coordenadasLocal(l);
    if (!coordenadas) return;
    L.marker(coordenadas)
      .addTo(mapaLocales)
      .bindPopup(
        `<a href="#/local/${escapar(l.id)}"><strong>${escapar(l.name)}</strong></a><br>${escapar(l.type || "Local")}`
      );
  });

  if (ui.ubicacion) {
    const petroleo = getComputedStyle(document.documentElement).getPropertyValue("--petroleo").trim();
    L.circleMarker(ui.ubicacion, { radius: 9, color: "#fff", weight: 3, fillColor: petroleo, fillOpacity: 1 })
      .addTo(mapaLocales)
      .bindPopup("Tu ubicación");
    const radio = RADIOS_LOCALES[ui.radioLocales];
    if (radio) {
      const circulo = L.circle(ui.ubicacion, {
        radius: radio * 1000,
        color: petroleo,
        weight: 1,
        fillOpacity: 0.06
      }).addTo(mapaLocales);
      mapaLocales.fitBounds(circulo.getBounds());
    } else mapaLocales.setView(ui.ubicacion, 13);
  }

  setTimeout(() => mapaLocales.invalidateSize(), 120);
}

/**
 * Detalle de un local: datos, menú sin TACC, reviews, productos y otros locales de la marca.
 * @param {string} id Id del local.
 * @returns {string} HTML de la pantalla.
 */
function pantallaLocal(id) {
  const l = (db.locales || []).find((x) => String(x.id) === String(id));
  if (!l) return pantallaNoEncontrada();

  // Productos que se venden en este local (store_ids). Si un producto no tiene locales
  // asignados, se muestra en los locales de su comercio.
  const productosMarca = (db.productos || []).filter((p) => {
    const ids = comoArray(p.store_ids).map(String);
    if (ids.length) return ids.includes(String(l.id));
    return !!l.merchant_user_id && p.merchant_user_id === l.merchant_user_id;
  });
  // Marca del local
  const idMarca = l.brand_id || l.merchant_user_id || null;
  const mismaMarca = (x) =>
    l.brand_id
      ? String(x.brand_id) === String(l.brand_id)
      : !!l.merchant_user_id && x.merchant_user_id === l.merchant_user_id;
  const otrosLocales = idMarca ? (db.locales || []).filter((x) => mismaMarca(x) && x.id !== l.id) : [];
  const botonMarca = idMarca
    ? `<button class="boton boton-secundario boton-ancho mt-16" data-accion="ver-perfil-marca" data-id="${escapar(idMarca)}">Ver perfil de la marca</button>`
    : "";
  // Dirección, tipo, barrio y horario (se muestran arriba en celular y al costado en escritorio)
  const datosLocal = `
    <div class="datos sin-margen">
      <div class="dato"><strong>Dirección</strong>${escapar(l.address || "No especificada")}</div>
      <div class="dato"><strong>Tipo</strong>${escapar(l.type || "Local")}</div>
      ${l.neighborhood ? `<div class="dato"><strong>Barrio</strong>${escapar(l.neighborhood)}</div>` : ""}
      ${l.hours ? `<div class="dato dato-ancho"><strong>Horario</strong>${escapar(l.hours)}</div>` : ""}
    </div>
    ${botonMarca}`;
  // Destacados del menú
  const platosLocal = comoArray(l.menu)
    .map((m) => (m && typeof m === "object" ? m.plato : m))
    .filter(Boolean);

  return estructuraPagina(
    "locales",
    `${volver("#/locales", "Locales")}
    <section class="detalle-portada ${tonoLocal(l)}">
      <div>${selloVerificacion(l)}
        <h1>${escapar(l.name)}</h1><p class="suave">${escapar(l.type || "Local")} · ${escapar(l.address || "")} · ${estrellas(promedio(l.id, 5))}</p></div>
      <span class="icono-gigante con-imagen">
        ${visualLocal(l)}
      </span>
    </section>
    
    <div class="detalle">
      <div class="detalle-columna-principal columna-16">
        <div class="caja solo-movil">${datosLocal}</div>
        <div class="caja">
          <h2>Menú sin TACC</h2>
          ${platosLocal.length ? `<ul class="lista-tildes">${platosLocal.map((plato) => `<li><span class="tilde" aria-hidden="true">✓</span><span>${escapar(plato)}</span></li>`).join("")}</ul>` : ""}
          ${urlSegura(l.menu_url) ? `<p class="mt-12"><a href="${urlSegura(l.menu_url)}" target="_blank" rel="noopener" class="boton boton-chico">Ver menú completo</a></p>` : ""}
          ${!platosLocal.length && !urlSegura(l.menu_url) ? '<p class="suave mt-6">Este local todavía no cargó su menú.</p>' : ""}
        </div>
        ${seccionReviews(l.id)}
        ${
          productosMarca.length
            ? `
        <section class="seccion">
          <h2 class="mb-16">Productos en este local</h2>
          <div class="grilla">${productosMarca.map(tarjetaProducto).join("")}</div>
        </section>`
            : ""
        }
        ${
          otrosLocales.length
            ? `
        <section class="seccion">
          <h2 class="mb-16">Otros locales de la marca</h2>
          <div class="lista">${otrosLocales.map(tarjetaLocal).join("")}</div>
        </section>`
            : ""
        }

      </div>
      <aside class="detalle-aside solo-escritorio">
        <div class="caja">${datosLocal}</div>
        ${
          esVerificado(l) && comoArray(l.verification).length
            ? `<div class="caja"><h2>Qué verificamos</h2><ul class="lista-tildes">${comoArray(l.verification)
                .map((v) => `<li><span class="tilde" aria-hidden="true">✓</span><span>${escapar(v)}</span></li>`)
                .join("")}</ul></div>`
            : ""
        }
        ${l.merchant_user_id && !esGestorPuntos() ? `<button class="boton boton-naranja boton-ancho" data-accion="mostrar-codigo">Sumar puntos en este local</button>` : ""}
      </aside>
    </div>`
  );
}
