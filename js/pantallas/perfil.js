/* =========================================================
   Perfil
   Datos personales, contraseña y acceso al editor de la marca.
   ========================================================= */

/**
 * Perfil: nombre, contraseña y, para las marcas, el editor del perfil público.
 * @returns {string} HTML de la pantalla.
 */
function pantallaPerfil() {
  const esMarca = estado.usuario.rol === ROLES.marca;
  const pestanaActual = ui.pestanaPerfil || "personal";
  const tituloMostrar =
    esMarca && pestanaActual === "publico"
      ? estado.usuario.nombreMarca || estado.usuario.nombre
      : `Hola, ${estado.usuario.nombre}`;

  return estructuraPagina(
    "perfil",
    `<div class="estrecho ${esMarca && pestanaActual === "publico" ? "ancho-completo" : ""}">
    <div class="cabecera-pagina">
      <h1>${escapar(tituloMostrar)}</h1>
      ${pestanaActual === "personal" ? `<span class="contador">${escapar(estado.usuario.email)}</span>` : ""}
    </div>
    
    ${
      esMarca
        ? `
      <div class="selector-vista selector-pestanas" role="group" aria-label="Secciones del perfil">
        <button data-accion="perfil-pestana" data-valor="personal" aria-pressed="${pestanaActual === "personal"}">Datos personales</button>
        <button data-accion="perfil-pestana" data-valor="publico" aria-pressed="${pestanaActual === "publico"}">Perfil público</button>
      </div>
    `
        : ""
    }

    ${
      !esMarca || pestanaActual === "personal"
        ? `
      <section class="caja">
        <h2>Datos personales</h2>
        <p class="suave chico rol-actual">Rol actual: <strong class="capitalizar">${estado.usuario.rol}</strong></p>
        <form class="mt-16" id="formulario-perfil-nombre" novalidate>
          <div class="campo">
            <label for="perfil-nombre">Nombre</label>
            <input type="text" id="perfil-nombre" name="nombre" autocomplete="name" value="${escapar(estado.usuario.nombre)}" aria-describedby="error-nombre-perfil" required>
            <span class="error" id="error-nombre-perfil" role="alert"></span>
          </div>
          <button class="boton boton-chico" type="submit">Guardar cambios</button>
        </form>
      </section>

      <section class="caja mt-16">
        <h2>Contraseña</h2>
        <form class="mt-16" id="formulario-perfil-clave" novalidate>
          <div class="campo">
            <label for="perfil-clave">Contraseña nueva</label>
            <input id="perfil-clave" name="clave" type="password" autocomplete="new-password" minlength="8" aria-describedby="ayuda-clave-perfil error-clave-perfil" required>
            <span class="suave chico" id="ayuda-clave-perfil">Mínimo 8 caracteres.</span>
          </div>
          <div class="campo">
            <label for="perfil-confirmacion">Repetí la contraseña</label>
            <input id="perfil-confirmacion" name="confirmacion" type="password" autocomplete="new-password" required>
          </div>
          <span class="error" id="error-clave-perfil" role="alert"></span>
          <button class="boton boton-chico" type="submit">Cambiar contraseña</button>
        </form>
      </section>
    `
        : ""
    }

    ${
      esMarca && pestanaActual === "publico"
        ? `
      <div class="editor-columnas">
        <div class="editor-controles">
          <h2 class="mb-16">Editor de tienda</h2>
          
          <div class="campo mb-20">
            <label for="campo-nombre-marca">Nombre público de la marca</label>
            <input type="text" id="campo-nombre-marca" placeholder="Ej: Rojas Gluten Free">
          </div>

          <div class="campo mb-20">
            <label for="campo-descripcion-marca">Descripción de la marca</label>
            <input type="text" id="campo-descripcion-marca" placeholder="Ej: Panadería 100% sin TACC en Caballito">
          </div>

          <div class="campo mb-20">
            <span class="etiqueta-campo">Logo actual</span>
            <div class="logo-editor mb-8">
              <img id="logo-editor" src="data:," alt="Logo actual" hidden>
              <label class="boton boton-secundario boton-chico" for="subir-logo">Seleccionar imagen</label>
            </div>
            <input type="file" id="subir-logo" class="visualmente-oculto" accept="image/*">
            <span class="suave chico bloque-texto" id="estado-subida" role="status"></span>
          </div>
          
          <h3 class="subtitulo-editor">Categorías destacadas</h3>
          <div class="editor-panel mb-20">
            <div class="contenedor-buscador-editor">
              <input type="search" class="buscador-editor" id="buscar-categorias-editor" placeholder="Buscar categoría..." aria-label="Buscar categoría">
            </div>
            <div class="editor-lista" id="lista-editor-categorias">
              <p class="suave chico p-16">Cargando...</p>
            </div>
          </div>

          <h3 class="subtitulo-editor">Productos destacados</h3>
          <div class="editor-panel mb-20">
            <div class="contenedor-buscador-editor">
              <input type="search" class="buscador-editor" id="buscar-productos-editor" placeholder="Buscar producto..." aria-label="Buscar producto">
            </div>
            <div class="editor-lista" id="lista-editor-productos">
              <p class="suave chico p-16">Cargando...</p>
            </div>
          </div>

          <h3 class="subtitulo-editor">Locales destacados</h3>
          <div class="editor-panel">
            <div class="contenedor-buscador-editor">
              <input type="search" class="buscador-editor" id="buscar-locales-editor" placeholder="Buscar local..." aria-label="Buscar local">
            </div>
            <div class="editor-lista" id="lista-editor-locales">
              <p class="suave chico p-16">Cargando...</p>
            </div>
          </div>

          <button class="boton boton-tinta boton-publicar mt-20" id="boton-guardar-publico">${icono("guardar")} Guardar y publicar</button>
        </div>

          <div class="editor-vista-previa">
            <div class="vista-previa-herramientas">
            <button class="boton boton-chico" data-accion="elegir-dispositivo" data-valor="escritorio" aria-pressed="${ui.dispositivoVistaPrevia === "escritorio" || !ui.dispositivoVistaPrevia}">
              ${icono("monitor")} Escritorio
            </button>
            <button class="boton boton-chico" data-accion="elegir-dispositivo" data-valor="tableta" aria-pressed="${ui.dispositivoVistaPrevia === "tableta"}">
              ${icono("tableta")} Tablet
            </button>
            <button class="boton boton-chico" data-accion="elegir-dispositivo" data-valor="celular" aria-pressed="${ui.dispositivoVistaPrevia === "celular"}">
              ${icono("celular")} Celular
            </button>
          </div>
          <div id="vista-previa-dispositivo" class="vista-previa-dispositivo ${ui.dispositivoVistaPrevia || "escritorio"}">
            <div id="vista-previa-marca" class="vista-previa-contenido">
              <p class="suave centrado p-40">Cargando vista previa...</p>
            </div>
          </div>

        </div>
      </div>
    `
        : ""
    }

    <section class="fila-botones mt-24">
      ${estado.usuario.rol === ROLES.administracion ? '<a class="boton boton-marron" href="#/backoffice">Panel de administración</a>' : ""}
      ${estado.usuario.rol === ROLES.marca ? '<a class="boton boton-petroleo" href="#/backoffice">Panel de mi marca</a>' : ""}
      <button class="boton boton-secundario" data-accion="cerrar-sesion">Cerrar sesión</button>
    </section>
  </div>`
  );
}
