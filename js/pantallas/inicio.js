/* =========================================================
   Pantalla de inicio
   Resumen para usuarios y panel para marcas.
   ========================================================= */

/**
 * Inicio con sesión. Las marcas ven su panel; usuarios y administración, el resumen del catálogo y sus puntos.
 * @returns {string} HTML de la pantalla.
 */
function pantallaInicio() {
  const esMarca = estado.usuario.rol === ROLES.marca;

  if (esMarca) {
    const misProductos = db.productos || [];
    const misLocales = db.locales || [];

    return estructuraPagina(
      "inicio",
      `
      <section class="bento">
        <div class="bloque ancho tinta">
          <p class="chico">Panel de marca</p>
          <h1 class="saludo-grande">Hola, ${escapar(estado.usuario.nombre)}.</h1>
          <p>Gestioná tus productos, locales y canjes desde un solo lugar.</p>
        </div>
        <a class="bloque petroleo" href="#/productos"><span class="flecha" aria-hidden="true">↗</span><p class="grande">${misProductos.length}</p><h3>productos</h3></a>
        <a class="bloque menta" href="#/locales"><span class="flecha" aria-hidden="true">↗</span><p class="grande">${misLocales.length}</p><h3>locales</h3></a>
        <a class="bloque ancho naranja ocupa-dos" href="#/puntos"><span class="flecha" aria-hidden="true">↗</span>
          <p class="chico">Puntos</p>
          <h3>Gestión de puntos</h3>
          <p class="chico">Cargá puntos por compras, validá cupones y mirá la actividad de tus locales.</p>
        </a>
      </section>
      
      <section class="seccion"><div class="seccion-titulo"><h2>Últimos productos creados</h2><a href="#/backoffice">Gestionar</a></div>
        ${misProductos.length ? `<div class="grilla">${misProductos.slice(0, 4).map(tarjetaProducto).join("")}</div>` : vacio("Sin productos", "Creá tu primer producto en el Backoffice.")}
      </section>
      
      <section class="seccion"><div class="seccion-titulo"><h2>Mis locales</h2><a href="#/backoffice">Gestionar</a></div>
        ${misLocales.length ? `<div class="grilla filas">${misLocales.slice(0, 4).map(tarjetaLocal).join("")}</div>` : vacio("Sin locales", "Creá tu primer local en el Backoffice.")}
      </section>
    `
    );
  }

  // Inicio de usuarios y administradores
  const recetas = db.recetas || [];
  const productos = db.productos || [];
  const locales = db.locales || [];
  const sig = siguienteNivel();

  return estructuraPagina(
    "inicio",
    `
    <section class="bento">
      <div class="bloque ancho tinta">
        <p class="chico">Todo sin TACC, en un solo lugar</p>
        <h1 class="saludo-grande">Hola, ${escapar(estado.usuario.nombre)}.</h1>
        <p>Esto es lo que encontramos para vos hoy.</p>
      </div>
      <a class="bloque ancho petroleo" href="#/puntos"><span class="flecha" aria-hidden="true">↗</span>
        <p class="chico">Tus puntos · nivel ${nivelActual().nombre}</p>
        <p class="grande">${estado.puntos}</p>
        ${sig ? `<div class="barra"><span style="width:${Math.min(100, (estado.puntosGanados / sig.desde) * 100)}%"></span></div><p class="chico">Te faltan ${sig.desde - estado.puntosGanados} para el nivel ${sig.nombre}</p>` : '<p class="chico">Llegaste al nivel más alto</p>'}
      </a>
      <a class="bloque naranja" href="#/recetas"><span class="flecha" aria-hidden="true">↗</span><p class="grande">${recetas.length}</p><h3>recetas</h3></a>
      <a class="bloque menta" href="#/locales"><span class="flecha" aria-hidden="true">↗</span><p class="grande">${locales.length}</p><h3>locales sin TACC</h3></a>
      <a class="bloque tostado" href="#/productos"><span class="flecha" aria-hidden="true">↗</span><p class="grande">${productos.length}</p><h3>productos</h3></a>
      <a class="bloque marron" href="#/puntos"><span class="flecha" aria-hidden="true">↗</span><p class="grande">${estado.cupones.length}</p><h3>cupones activos</h3></a>
    </section>
    
    <section class="seccion"><div class="seccion-titulo"><h2>Recetas para vos</h2><a href="#/recetas">Ver todas</a></div>
      ${recetas.length ? `<div class="grilla">${recetas.slice(0, 4).map(tarjetaReceta).join("")}</div>` : vacio("Sin recetas por ahora", "Pronto vamos a sumar más recetas.")}
    </section>
    
    <section class="seccion"><div class="seccion-titulo"><h2>Locales sin TACC</h2><a href="#/locales">Ver todos</a></div>
      ${locales.length ? `<div class="grilla filas">${locales.map(tarjetaLocal).join("")}</div>` : vacio("Sin locales por ahora", "Todavía no hay locales cargados.")}
    </section>
  `
  );
}
