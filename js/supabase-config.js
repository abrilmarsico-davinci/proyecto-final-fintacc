// Pegá aquí la URL del proyecto y su publishable key (o la clave legacy anon).
// Nunca coloques aquí una service_role/secret key.
const FINTACC_SUPABASE_URL = "https://wigyzyerxbpynjqiboct.supabase.co";
const FINTACC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_BBSU6Wu5kq93wRDwZRLgOQ_ALoWSGTr";

window.fintaccSupabase = null;
if (FINTACC_SUPABASE_URL && FINTACC_SUPABASE_PUBLISHABLE_KEY && window.supabase?.createClient) {
  window.fintaccSupabase = window.supabase.createClient(
    FINTACC_SUPABASE_URL,
    FINTACC_SUPABASE_PUBLISHABLE_KEY
  );
}
