// ── VÉRIFICATION D'IDENTITÉ VENDEUR (KYC) ──
// Même convention que Cart/Wishlist/Litiges : { supabaseClient, ... } explicite.

const VERIF_TYPES = {
  carte_identite: 'Carte d\'identité',
  passeport: 'Passeport',
  permis_conduire: 'Permis de conduire'
};

const VERIF_STATUTS = {
  en_attente: { label: 'En attente de vérification', css: 'verif-en-attente' },
  approuve:   { label: 'Vérifié',                     css: 'verif-approuve'  },
  rejete:     { label: 'Rejeté',                      css: 'verif-rejete'    }
};

// Dernière demande de vérification du vendeur connecté (ou null si aucune).
async function getMaVerification({ supabaseClient, userId }) {
  if (!userId || !supabaseClient) return null;

  const { data, error } = await supabaseClient
    .from('verifications_vendeur')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return null;
  return data;
}

async function submitVerification({ supabaseClient, userId, typeDocument, file, fileVerso }) {
  const path = `${userId}/${Date.now()}_recto_${file.name}`;

  const { error: uploadError } = await supabaseClient
    .storage.from('verifications')
    .upload(path, file);
  if (uploadError) throw uploadError;

  let pathVerso = null;
  if (fileVerso) {
    pathVerso = `${userId}/${Date.now()}_verso_${fileVerso.name}`;
    const { error: uploadVersoError } = await supabaseClient
      .storage.from('verifications')
      .upload(pathVerso, fileVerso);
    if (uploadVersoError) throw uploadVersoError;
  }

  const { error: insertError } = await supabaseClient
    .from('verifications_vendeur')
    .insert([{
      user_id: userId,
      type_document: typeDocument,
      document_path: path,
      document_path_verso: pathVerso
    }]);
  if (insertError) throw insertError;
}

async function getDocumentUrl({ supabaseClient, filePath }) {
  const { data, error } = await supabaseClient
    .storage.from('verifications')
    .createSignedUrl(filePath, 3600);
  if (error) throw error;
  return data.signedUrl;
}

// ── Admin uniquement (RLS refuse silencieusement sinon) ──
async function isAdmin({ supabaseClient, userId }) {
  if (!userId || !supabaseClient) return false;
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return false;
  return data.role === 'admin';
}

async function getVerificationsEnAttente({ supabaseClient }) {
  const { data, error } = await supabaseClient
    .from('verifications_vendeur')
    .select('*, profiles(full_name)')
    .eq('statut', 'en_attente')
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return data;
}

async function decideVerification({ supabaseClient, verificationId, approuve, motifRejet }) {
  const { error } = await supabaseClient.rpc('decide_verification', {
    p_verification_id: verificationId,
    p_approuve: approuve,
    p_motif_rejet: motifRejet || null
  });
  if (error) throw error;
}

window.Verification = {
  TYPES: VERIF_TYPES,
  STATUTS: VERIF_STATUTS,
  getMaVerification,
  submitVerification,
  getDocumentUrl,
  isAdmin,
  getVerificationsEnAttente,
  decideVerification
};