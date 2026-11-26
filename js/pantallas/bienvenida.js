/* =========================================================
   Página de bienvenida
   Página pública para visitantes sin sesión.
   ========================================================= */

/**
 * Landing pública: presentación, módulos, criterios de verificación, reviews y comercios.
 * @returns {string} HTML de la pantalla.
 */
function pantallaBienvenida() {
  const locales = db.locales;
  const recetas = db.recetas.map(normalizarReceta);
  const productos = db.productos;
  const localDestacado = locales[1] || locales[0];
  const recetaDestacada = recetas[1] || recetas[0];
  const reviews = estado.reviews.slice(0, 3);
  const palabras = ["Sin TACC", "Locales", "Recetas", "Productos", "Comunidad celíaca", "Puntos"];

  const nombreObjetivo = (id) => {
    const l = locales.find((x) => String(x.id) === String(id));
    if (l) return l.name || l.nombre;
    const p = productos.find((x) => String(x.id) === String(id));
    return p ? p.name || p.nombre : "Comunidad";
  };

  return `${barraPublica()}
  <main id="contenido" tabindex="-1">
    <section class="portada">
      <div class="portada-panel">
        <div>
          <h1 class="titular">Comé seguro,<br><span class="linea-2">sin vueltas.</span></h1>
          <p class="bajada">Recetas, productos y locales sin TACC en una sola plataforma pensada para personas celíacas.</p>
          <div class="fila-botones"><button class="boton boton-blanco" data-accion="ir-registro">Crear cuenta gratis</button><button class="boton boton-tinta" data-accion="ir-ingreso">Ingresar</button></div>
          <div class="portada-datos">
            <div class="portada-dato"><strong>+${locales.length}</strong><span>Locales en mapa</span></div>
            <div class="portada-dato"><strong>+${productos.length}</strong><span>Productos sin TACC</span></div>
            <div class="portada-dato"><strong>+${recetas.length}</strong><span>Recetas paso a paso</span></div>
          </div>
        </div>
        <div class="portada-tarjetas">
          ${localDestacado ? `<div class="fila"><span class="icono t-menta">${icono("cubiertos")}</span><div class="cuerpo"><h3>${escapar(localDestacado.name || localDestacado.nombre)}</h3><span class="meta">${escapar(localDestacado.type || localDestacado.tipo || "Restaurante")} · ${escapar(localDestacado.barrio || localDestacado.address || localDestacado.direccion || "")}</span><span class="sello">100% sin TACC</span></div></div>` : ""}
          ${recetaDestacada ? `<div class="fila"><span class="icono t-menta">${icono("cuenco")}</span><div class="cuerpo"><h3>${escapar(recetaDestacada.nombre)}</h3><span class="meta">${escapar(recetaDestacada.momento)} · ${recetaDestacada.minutos} min</span><span class="sello">Sin TACC</span></div></div>` : ""}
          <div class="fila"><span class="icono t-naranja">${icono("ticket")}</span><div class="cuerpo"><h3>+50 puntos</h3><span class="meta">Bono de bienvenida al registrarte</span></div></div>
        </div>
      </div>
      ${selloGiratorio()}
    </section>
    <div class="marquesina-contenedor" aria-hidden="true">
      <div class="marquesina"><div class="pista">${[...palabras, ...palabras].map((r) => `<span>${r}</span>`).join("")}</div></div>
    </div>
    <section class="franja" id="como-funciona"><div class="contenedor">
      <div class="encabezado-franja"><h2>Cómo funciona</h2><p class="intro">Todo lo que ves en la plataforma es sin TACC. Vos solo elegís qué necesitás hoy.</p></div>
      <div class="linea-tiempo">
        <div class="hito"><span class="numero" aria-hidden="true">01</span><h3>Creá tu cuenta</h3><p class="suave">En un minuto y gratis. Recibís 50 puntos de bienvenida.</p></div>
        <div class="hito"><span class="numero" aria-hidden="true">02</span><h3>Encontrá productos y locales sin TACC</h3><p class="suave">Recetas, productos y locales sin TACC, sin tener que preguntar diez veces.</p></div>
        <div class="hito"><span class="numero" aria-hidden="true">03</span><h3>Sumá puntos</h3><p class="suave">Cada compra en un comercio aliado suma puntos que canjeás por descuentos.</p></div>
      </div>
    </div></section>
    <section class="franja sin-padding-arriba" id="modulos"><div class="contenedor">
      <div class="encabezado-franja"><h2>Todo en un solo lugar</h2><p class="intro">Cinco servicios conectados para que dejes de buscar en mil sitios distintos. Tocá cualquiera para ver una vista previa.</p></div>
      <div class="bento">
        <button type="button" class="bloque ancho alto petroleo" data-accion="vista-previa-modulo" data-valor="locales"><span class="flecha" aria-hidden="true">↗</span>${icono("marcador", "icono-bloque")}<span class="grande bloque-texto">Locales sin TACC</span><span class="bloque-texto">Restaurantes, cafés y dietéticas que cuidan la contaminación cruzada, con su menú sin TACC y el sello cuando el local está verificado.</span></button>
        <button type="button" class="bloque naranja" data-accion="vista-previa-modulo" data-valor="recetas"><span class="flecha" aria-hidden="true">↗</span>${icono("libro", "icono-bloque")}<span class="bloque-titulo">Recetas</span><span class="bloque-texto">Sin TACC, paso a paso y con información nutricional.</span></button>
        <button type="button" class="bloque tostado" data-accion="vista-previa-modulo" data-valor="productos"><span class="flecha" aria-hidden="true">↗</span>${icono("bolsa", "icono-bloque")}<span class="bloque-titulo">Productos</span><span class="bloque-texto">Qué comprar, a qué precio y dónde conseguirlo.</span></button>
        <button type="button" class="bloque menta" data-accion="vista-previa-modulo" data-valor="comunidad"><span class="flecha" aria-hidden="true">↗</span>${icono("chat", "icono-bloque")}<span class="bloque-titulo">Comunidad</span><span class="bloque-texto">Reviews de otras personas celíacas.</span></button>
        <button type="button" class="bloque marron" data-accion="vista-previa-modulo" data-valor="puntos"><span class="flecha" aria-hidden="true">↗</span>${icono("estrella", "icono-bloque")}<span class="bloque-titulo">Puntos</span><span class="bloque-texto">Descuentos en comercios aliados con código QR.</span></button>
      </div>
    </div></section>
    <section class="franja sin-padding-arriba" id="verificacion"><div class="contenedor">
      <div class="encabezado-franja"><h2>Qué significa “verificado”</h2><p class="intro">Para evitar la contaminación cruzada, diferenciamos locales 100 % libres de gluten de espacios con protocolos seguros.</p></div>
      <div class="grilla-criterios">
        <article class="tarjeta-criterio"><span class="criterio-icono">${icono("cubiertos")}</span><h3>Cocina o sector separado</h3><p>Áreas de elaboración independientes o protocolo estricto para evitar contacto con harinas con gluten.</p></article>
        <article class="tarjeta-criterio"><span class="criterio-icono">${icono("pan")}</span><h3>Utensilios exclusivos</h3><p>Tostadoras, freidoras, hornos y tablas dedicadas únicamente a preparaciones sin TACC.</p></article>
        <article class="tarjeta-criterio"><span class="criterio-icono">${icono("frasco")}</span><h3>Insumos con registro</h3><p>Productos envasados de origen controlado y certificación oficial vigente en Argentina (ANMAT).</p></article>
        <article class="tarjeta-criterio"><span class="criterio-icono">${icono("usuario")}</span><h3>Personal capacitado</h3><p>Equipos informados sobre manipulación segura para que no tengas que explicar qué es la celiaquía.</p></article>
      </div>
    </div></section>
    ${
      reviews.length
        ? `<section class="franja sin-padding-arriba"><div class="contenedor">
      <div class="encabezado-franja"><h2>Lo que dice la comunidad</h2><p class="intro">Reseñas de personas celíacas sobre atención, seguridad en cocina y productos.</p></div>
      <div class="grilla-citas">
        ${reviews
          .map(
            (review) => `
          <figure class="tarjeta-cita">
            <div>
              <span class="estrellas" role="img" aria-label="${review.estrellas} de 5 estrellas">${"★".repeat(review.estrellas)}${"☆".repeat(5 - review.estrellas)}</span>
              <blockquote>“${escapar(review.texto)}”</blockquote>
            </div>
            <figcaption>${escapar(review.autor)} · ${escapar(nombreObjetivo(review.objetivo))}</figcaption>
          </figure>
        `
          )
          .join("")}
      </div>
    </div></section>`
        : ""
    }
    <section class="franja sin-padding-arriba" id="comercios"><div class="contenedor">
      <div class="comercios">
        <div><h2>¿Tenés un comercio apto?</h2><p>Sumate a la red de comercios aliados y llegá a clientes que buscan exactamente lo que ofrecés, sin hardware extra.</p></div>
        <div><ul><li>Sello de local verificado</li><li>Visibilidad en el mapa de la plataforma</li><li>Clientes fieles con el sistema de puntos QR</li></ul>
        <button class="boton boton-naranja" data-accion="aviso-comercios">Quiero ser aliado</button></div>
      </div>
    </div></section>
  </main>${pie()}`;
}
