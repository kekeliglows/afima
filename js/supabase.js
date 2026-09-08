// ── CLIENT SUPABASE GLOBAL ──
// Ce fichier est le seul endroit où l'URL et la clé sont déclarées.
// Tous les autres fichiers JS utilisent window.supabaseClient.

const SUPABASE_URL = 'https://ehkytlouakkfmtfatbmi.supabase.co';
const SUPABASE_KEY = 'sb_publishable_A-f-SEGhhW25sAulnHLIbA_OvyjQ9Qa';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    // Indique à Supabase que la page de login est la tienne
    // (supprime l'avertissement "créer votre propre page de connexion")
    flowType: 'pkce',
    redirectTo: 'https://afima-ruby.vercel.app/front-end/login.html',
    // Persistance de session dans le localStorage (cross-onglets)
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  }
});

window.supabaseClient = supabaseClient;
