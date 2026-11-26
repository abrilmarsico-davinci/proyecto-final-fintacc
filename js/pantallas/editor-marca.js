/* =========================================================
   Editor del perfil público
   La marca elige logo, descripción y destacados, con vista previa.
   ========================================================= */

/** Datos del editor del perfil público mientras la marca lo edita. */
const editor = {
  categorias: [],
  productos: [],
  locales: [],
  destacadas: { categorias: [], productos: [], locales: [] },
  urlLogo: ""
};

/**
 * Habilita el botón de guardar cuando hay cambios sin publicar.
 */
const habilitarGuardado = () => {
  const boton = document.getElementById("boton-guardar-publico");
  if (boton) boton.disabled = false;
};

/**
 * Agrega, quita o mueve un elemento de los destacados y vuelve a dibujar el editor.
 * @param {"categorias"|"productos"|"locales"} tipo Lista a modificar.
 * @param {string} id Id del elemento.
 * @param {"alternar"|"agregar"|"quitar"|"subir"|"bajar"} accion Cambio a aplicar.
 */
function cambiarDestacado(tipo, id, accion) {
  const lista = editor.destacadas[tipo];
  const i = lista.indexOf(id);
  if (accion === "alternar") i === -1 ? lista.push(id) : lista.splice(i, 1);
  if (accion === "agregar" && i === -1) lista.push(id);
  if (accion === "quitar" && i > -1) lista.splice(i, 1);
  if (accion === "subir" && i > 0) [lista[i - 1], lista[i]] = [lista[i], lista[i - 1]];
  if (accion === "bajar" && i > -1 && i < lista.length - 1) [lista[i + 1], lista[i]] = [lista[i], lista[i + 1]];
  habilitarGuardado();
  dibujarEditor();
}

/**
 * Actualiza la miniatura del logo en el editor.
 */
function mostrarLogoEditor() {
  const miniatura = document.getElementById("logo-editor");
  if (!miniatura) return;
  const valida = Boolean(urlSegura(editor.urlLogo));
  miniatura.hidden = !valida;
  if (valida) miniatura.src = editor.urlLogo;
}

/**
 * Carga los datos del editor, completa sus campos y conecta la subida del logo y el guardado.
 * @returns {Promise<void>}
 */
async function cargarEditorPublico() {
  const lista = document.getElementById("lista-editor-categorias");
  if (!hayConexion() || !lista) return;

  const idUsuario = estado.usuario.id;
  let perfil = {};
  try {
    const datos = await obtenerDatosEditor(idUsuario);
    editor.categorias = datos.categorias;
    editor.productos = datos.productos;
    editor.locales = datos.locales;
    perfil = datos.perfil;
  } catch (_) {
    avisar("No se pudieron cargar los datos del editor.", "error");
  }
  // Si la pantalla cambió mientras cargaba, no se sigue
  if (!lista.isConnected) return;

  editor.destacadas = {
    categorias: comoArray(perfil.featured_categories).map(String),
    productos: comoArray(perfil.featured_products).map(String),
    locales: comoArray(perfil.featured_stores).map(String)
  };
  editor.urlLogo = perfil.logo_url || "";
  mostrarLogoEditor();

  const campoNombre = document.getElementById("campo-nombre-marca");
  const campoDescripcion = document.getElementById("campo-descripcion-marca");
  campoNombre.value = perfil.brand_name || estado.usuario.nombre;
  campoDescripcion.value = perfil.brand_description || "";

  const alEscribir = () => {
    habilitarGuardado();
    dibujarEditor();
  };
  campoNombre.addEventListener("input", alEscribir);
  campoDescripcion.addEventListener("input", alEscribir);
  ["buscar-categorias-editor", "buscar-productos-editor", "buscar-locales-editor"].forEach((id) =>
    document.getElementById(id).addEventListener("input", dibujarEditor)
  );

  document.getElementById("subir-logo").addEventListener("change", async (e) => {
    const archivo = e.target.files[0];
    if (!archivo) return;
    const aviso = document.getElementById("estado-subida");
    const miniatura = document.getElementById("logo-editor");
    const logoAnterior = editor.urlLogo;
    // Previsualización inmediata con FileReader mientras la imagen se sube
    miniatura.src = await leerImagen(archivo).catch(() => miniatura.src);
    miniatura.hidden = false;
    miniatura.classList.add("subiendo");
    aviso.textContent = "Subiendo imagen...";

    try {
      editor.urlLogo = await subirImagen(archivo);
    } catch (error) {
      aviso.textContent = "Error al subir: " + error.message;
      editor.urlLogo = logoAnterior;
      mostrarLogoEditor();
      return;
    } finally {
      miniatura.classList.remove("subiendo");
    }
    aviso.textContent = "Imagen subida";
    mostrarLogoEditor();
    alEscribir();
  });

  const botonGuardar = document.getElementById("boton-guardar-publico");
  botonGuardar.disabled = true;
  botonGuardar.addEventListener("click", async () => {
    const nombre = campoNombre.value.trim();
    botonGuardar.disabled = true;
    botonGuardar.textContent = "Guardando...";
    try {
      await guardarPerfilPublico(idUsuario, {
        logo_url: editor.urlLogo,
        brand_name: nombre,
        brand_description: campoDescripcion.value.trim(),
        featured_categories: editor.destacadas.categorias,
        featured_products: editor.destacadas.productos,
        featured_stores: editor.destacadas.locales
      });

      if (nombre) estado.usuario.nombreMarca = nombre;
      await prepararVista();
      avisar("Perfil público actualizado", "exito");
    } catch (err) {
      avisar("Error al guardar: " + err.message, "error");
      botonGuardar.disabled = false;
    } finally {
      botonGuardar.innerHTML = `${icono("guardar")} Guardar y publicar`;
    }
  });

  dibujarEditor();
}

/**
 * Lista de un tipo con los destacados primero, en su orden, y el resto después.
 * @param {Object[]} items Elementos a listar.
 * @param {string[]} destacadas Ids destacados en orden.
 * @param {"categorias"|"productos"|"locales"} tipo Tipo de lista.
 * @returns {string} HTML de la lista.
 */
function listaEditor(elementos, destacadas, tipo) {
  if (!elementos.length) return `<p class="suave chico p-16">No se encontraron resultados.</p>`;
  const elegidos = destacadas.map((id) => elementos.find((i) => String(i.id) === id)).filter(Boolean);
  const resto = elementos.filter((i) => !destacadas.includes(String(i.id)));

  return [...elegidos, ...resto]
    .map((elemento) => {
      const id = String(elemento.id);
      const posicion = destacadas.indexOf(id);
      const marcado = posicion > -1;
      const flechas = marcado
        ? `<div class="acciones">
            <button class="boton-flecha" data-direccion="subir" aria-label="Subir" ${posicion === 0 ? "disabled" : ""}>${icono("arriba")}</button>
            <button class="boton-flecha" data-direccion="bajar" aria-label="Bajar" ${posicion === destacadas.length - 1 ? "disabled" : ""}>${icono("abajo")}</button>
          </div>`
        : "";
      return `
        <div class="editor-elemento ${marcado ? "seleccionado" : ""}" data-tipo="${tipo}" data-id="${escapar(id)}">
          <input type="checkbox" ${marcado ? "checked" : ""} aria-label="Destacar ${escapar(elemento.name)}">
          <span class="nombre">${escapar(elemento.name)}</span>
          ${flechas}
        </div>`;
    })
    .join("");
}

/**
 * Dibuja las listas filtradas por búsqueda y la vista previa del perfil público.
 */
function dibujarEditor() {
  const cajas = {
    categorias: document.getElementById("lista-editor-categorias"),
    productos: document.getElementById("lista-editor-productos"),
    locales: document.getElementById("lista-editor-locales")
  };
  if (!cajas.categorias) return;

  const busquedas = {
    categorias: "buscar-categorias-editor",
    productos: "buscar-productos-editor",
    locales: "buscar-locales-editor"
  };
  Object.entries(cajas).forEach(([tipo, caja]) => {
    const texto = document.getElementById(busquedas[tipo]).value.toLowerCase();
    const elementos = editor[tipo].filter((i) => i.name.toLowerCase().includes(texto));
    caja.innerHTML = listaEditor(elementos, editor.destacadas[tipo], tipo);
  });

  const vistaPrevia = document.getElementById("vista-previa-marca");
  if (!vistaPrevia) return;
  const elegidos = (tipo) =>
    editor.destacadas[tipo].map((id) => editor[tipo].find((x) => String(x.id) === id)).filter(Boolean);
  const marcaPropia = db.marcas.find((b) => String(b.owner_user_id) === String(estado.usuario.id));
  const perfil = datosVistaMarca(
    {
      brand_name: document.getElementById("campo-nombre-marca").value,
      brand_description: document.getElementById("campo-descripcion-marca").value,
      logo_url: editor.urlLogo,
      name: estado.usuario.nombre
    },
    marcaPropia
  );
  vistaPrevia.innerHTML = generarVistaMarcaHTML(
    perfil,
    elegidos("productos"),
    elegidos("locales"),
    elegidos("categorias"),
    true
  );
}

// Clicks en las filas y flechas del editor
app.addEventListener("click", (e) => {
  const fila = e.target.closest(".editor-elemento");
  if (!fila || e.target.matches("input")) return;
  const flecha = e.target.closest(".boton-flecha");
  cambiarDestacado(fila.dataset.tipo, fila.dataset.id, flecha ? flecha.dataset.direccion : "alternar");
});

// Checkboxes del editor
app.addEventListener("change", (e) => {
  if (!e.target.matches(".editor-elemento input")) return;
  const fila = e.target.closest(".editor-elemento");
  cambiarDestacado(fila.dataset.tipo, fila.dataset.id, e.target.checked ? "agregar" : "quitar");
});
