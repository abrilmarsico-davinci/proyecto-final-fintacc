/* =========================================================
   Servicio de reviews
   Lectura, publicación y actualización en tiempo real.
   ========================================================= */

const CAMPOS_REVIEW = "id,target,stars,text,author,created_at";

/**
 * Obtiene todas las reviews, de la más nueva a la más vieja.
 * @returns {Promise<Array<{ id: number, target: string, stars: number, text: string, author: string }>>}
 */
async function obtenerReviews() {
  return datosDe(await clienteSupabase().from("reviews").select(CAMPOS_REVIEW).order("id", { ascending: false }));
}

/**
 * Publica una review del usuario autenticado, firmada con el nombre de su perfil.
 * @param {{ objetivo: string, estrellas: number, texto: string }} review Local o producto, puntuación y texto.
 * @returns {Promise<{ id: number, target: string, stars: number, text: string, author: string }>} Review guardada.
 */
async function publicarReview({ objetivo, estrellas, texto }) {
  const sb = clienteSupabase();
  const idUsuario = await idUsuarioActual();
  const perfil = datosDe(await sb.from("profiles").select("name").eq("id", idUsuario).single());
  return datosDe(
    await sb
      .from("reviews")
      .insert({ user_id: idUsuario, author: perfil.name, target: objetivo, stars: estrellas, text: texto })
      .select(CAMPOS_REVIEW)
      .single()
  );
}

/**
 * Escucha las reviews nuevas con Supabase Realtime.
 * @param {(review: Object) => void} alRecibir Se ejecuta con cada fila insertada.
 * @returns {RealtimeChannel} Canal suscripto, para poder cerrarlo.
 */
function suscribirReviews(alRecibir) {
  return clienteSupabase()
    .channel("reviews-publicas")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "reviews" }, ({ new: fila }) => alRecibir(fila))
    .subscribe();
}
