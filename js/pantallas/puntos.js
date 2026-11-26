/* =========================================================
   Puntos
   Saldo, niveles y canjes del usuario; carga de puntos y validación de cupones de la marca.
   ========================================================= */

/**
 * Puntos. Los usuarios ven saldo, niveles, canjes e historial; las marcas, la carga de puntos y la validación de cupones.
 * @returns {string} HTML de la pantalla.
 */
function pantallaPuntos() {
  if (esGestorPuntos()) {
    return estructuraPagina(
      "puntos",
      `
      <div class="cabecera-pagina"><h1>Gestión de puntos</h1></div>
      <section class="puntos-portada gestion-puntos">
        <div>
          <p class="chico tenue">En la caja</p>
          <h2 class="my-12">Cargá puntos por una compra</h2>
          <p class="chico mb-20 atenuado-suave">Escaneá el código del cliente (o escribí su email), elegí el local y el monto. Se acredita 1 punto cada ${pesos(PESOS_POR_PUNTO)}.</p>
          <button class="boton boton-naranja" data-accion="cargar-puntos">Cargar puntos</button>
        </div>
        <div>
          <p class="chico tenue">Canjes</p>
          <h2 class="my-12">Validá un cupón</h2>
          <p class="chico mb-20 atenuado-suave">Escaneá el QR del cupón que muestra el cliente y aplicá el descuento. El cupón queda como usado.</p>
          <button class="boton boton-blanco" data-accion="escanear-canje">Validar cupón</button>
        </div>
      </section>
      <div class="seccion">
        <div class="cabecera-pagina mb-16"><h2>Actividad</h2><button class="boton boton-chico boton-secundario" data-accion="actualizar-actividad">Actualizar</button></div>
        <div class="caja" id="actividad-puntos"><p class="suave">Cargando…</p></div>
      </div>`
    );
  }

  const actual = nivelActual().nombre;
  const activos = estado.cupones.filter((c) => c.estado === "active");
  const usados = estado.cupones.filter((c) => c.estado !== "active");
  return estructuraPagina(
    "puntos",
    `
    <div class="cabecera-pagina"><h1>Tus puntos</h1></div>
    <section class="puntos-portada">
      <div><p class="chico tenue">Saldo disponible</p><p class="numero-gigante">${estado.puntos}</p></div>
      <div>
        <ol class="niveles" aria-label="Niveles">${NIVELES.map((n) => `<li class="nivel ${estado.puntosGanados >= n.desde ? "logrado" : ""} ${n.nombre === actual ? "actual" : ""}">${n.nombre}<small>desde ${n.desde} pts</small></li>`).join("")}</ol>
        <p class="chico mt-24 atenuado-suave">Mostrá tu código en la caja de un comercio adherido: la marca carga tu compra y sumás 1 punto cada ${pesos(PESOS_POR_PUNTO)}. Los puntos no vencen.</p>
        <button class="boton boton-naranja mt-16" data-accion="mostrar-codigo">Mostrar mi código · ${codigoCliente(estado.usuario.id)}</button>
      </div>
    </section>
    <div class="dos-columnas seccion">
      <section><h2 class="mb-16">Canjeá tus puntos</h2><div class="lista">
        ${CANJES.map(
          (
            c
          ) => `<div class="canje"><span class="monto">${pesos(c.descuento)}<small>de descuento</small></span><div class="cuerpo"><h3>${c.puntos} puntos</h3><span class="suave chico">En cualquier comercio adherido</span></div>
          <button class="boton boton-chico" data-accion="canjear" data-id="${c.id}" ${estado.puntos < c.puntos ? "disabled" : ""}>Canjear</button></div>`
        ).join("")}
        ${activos.length ? `<h2 class="titulo-cupones">Tus cupones</h2>${activos.map((c) => `<button class="canje" data-accion="ver-cupon" data-codigo="${escapar(c.codigo)}"><span class="monto">${pesos(c.descuento)}</span><span class="cuerpo"><strong class="titulo-canje">Código ${escapar(c.codigo)}</strong><span class="suave chico">Tocá para ver el QR</span></span></button>`).join("")}` : ""}
        ${usados.length ? `<h2 class="titulo-cupones">Cupones usados</h2>${usados.map((c) => `<div class="canje usado"><span class="monto">${pesos(c.descuento)}</span><div class="cuerpo"><h3>Código ${escapar(c.codigo)}</h3><span class="suave chico">Ya utilizado</span></div></div>`).join("")}` : ""}
      </div></section>
      <section><h2 class="mb-16">Historial</h2><div class="caja historial">
        ${estado.historial.length ? estado.historial.map((h) => `<div class="movimiento"><span><strong>${escapar(h.detalle)}</strong><br><span class="suave chico">${escapar(h.fecha)}</span></span><strong class="${h.puntos > 0 ? "puntos-suma" : "puntos-resta"}">${h.puntos > 0 ? "+" : ""}${h.puntos}</strong></div>`).join("") : '<p class="suave">Todavía no tenés movimientos.</p>'}
      </div></section>
    </div>`
  );
}

/**
 * Carga la actividad de la marca (compras y canjes) en #actividad-puntos.
 * @returns {Promise<void>}
 */
async function cargarActividadPuntos() {
  const contenedor = document.getElementById("actividad-puntos");
  if (!contenedor) return;
  try {
    const filas = await obtenerActividadMarca();
    contenedor.innerHTML = filas.length
      ? filas
          .map(
            (f) => `
      <div class="movimiento">
        <span><strong>${escapar(f.cliente || "Cliente")}</strong> · ${f.tipo === "compra" ? "Compra" : "Canje"}<br>
          <span class="suave chico">${escapar(f.detalle || "")} · ${f.fecha ? new Date(f.fecha).toLocaleString("es-AR") : ""}${f.monto ? ` · ${pesos(f.monto)}` : ""}</span></span>
        <strong class="${f.puntos > 0 ? "puntos-suma" : "puntos-resta"}">${f.puntos > 0 ? "+" : ""}${f.puntos} pts</strong>
      </div>`
          )
          .join("")
      : '<p class="suave">Todavía no cargaste compras ni validaste cupones.</p>';
  } catch (error) {
    contenedor.innerHTML = `<p class="error">${escapar(error.message)}</p>`;
  }
}
