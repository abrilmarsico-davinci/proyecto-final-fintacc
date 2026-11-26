/* =========================================================
   Servicio de imágenes
   Subida de archivos al bucket brand_assets de Supabase Storage.
   ========================================================= */

const BUCKET_IMAGENES = "brand_assets";

/**
 * Sube una imagen y devuelve su URL pública.
 * El nombre del archivo lleva el id de la cuenta para evitar choques entre marcas.
 * @param {File} archivo Imagen elegida en el formulario.
 * @returns {Promise<string>} URL pública de la imagen.
 */
async function subirImagen(archivo) {
  const sb = clienteSupabase();
  const idUsuario = await idUsuarioActual();
  const extension = archivo.name.split(".").pop();
  const nombre = `${idUsuario}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${extension}`;
  datosDe(await sb.storage.from(BUCKET_IMAGENES).upload(nombre, archivo));
  return sb.storage.from(BUCKET_IMAGENES).getPublicUrl(nombre).data.publicUrl;
}
