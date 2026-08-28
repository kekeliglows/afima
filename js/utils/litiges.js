// ── LITIGES (centre de résolution) ──
// Ce fichier expose des fonctions pour gérer les litiges.
// Le client Supabase est reçu explicitement en paramètre,
// comme pour Cart et Wishlist.

// ── STATUTS DES LITIGES ──
const LITIGE_STATUTS = {
  ouvert: {
    label: 'Ouvert',
    css: 'litige-ouvert'
  },
  en_cours: {
    label: 'En cours d\'examen',
    css: 'litige-en-cours'
  },
  resolu_acheteur: {
    label: 'Résolu en faveur de l\'acheteur',
    css: 'litige-resolu'
  },
  resolu_vendeur: {
    label: 'Résolu en faveur du vendeur',
    css: 'litige-resolu'
  },
  rejete: {
    label: 'Rejeté',
    css: 'litige-rejete'
  }
};

// ── CRÉATION D'UN LITIGE ──
// La fonction RPC côté Supabase vérifie les permissions.
async function createLitige({
  supabaseClient,
  commandeItemId,
  motif,
  description
}) {
  if (!supabaseClient) throw new Error('Client Supabase introuvable.');
  if (!commandeItemId) throw new Error('Commande introuvable.');
  if (!motif) throw new Error('Veuillez sélectionner un motif.');

  const { data, error } = await supabaseClient.rpc('create_litige', {
    p_commande_item_id: commandeItemId,
    p_motif: motif,
    p_description: description || null
  });

  if (error) throw error;
  return data;
}

// ── LISTE DES LITIGES D'UN UTILISATEUR ──
// Retourne les litiges où l'utilisateur est acheteur ou vendeur.
async function getMesLitiges({ supabaseClient, userId }) {
  if (!supabaseClient) throw new Error('Client Supabase introuvable.');
  if (!userId) return [];

  const { data, error } = await supabaseClient
    .from('litiges')
    .select(`
      id,
      motif,
      statut,
      created_at,
      acheteur_id,
      vendeur_id,
      commande_items (titre, image_url)
    `)
    .or(`acheteur_id.eq.${userId},vendeur_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// ── DÉTAIL D'UN LITIGE AVEC SES PREUVES ──
async function getLitige({ supabaseClient, litigeId }) {
  if (!supabaseClient) throw new Error('Client Supabase introuvable.');
  if (!litigeId) throw new Error('Identifiant du litige manquant.');

  // Récupérer le litige avec les infos du produit
  const { data: litige, error } = await supabaseClient
    .from('litiges')
    .select(`
      *,
      commande_items (titre, image_url, prix_unitaire, quantite),
      acheteur:profiles!litiges_acheteur_id_fkey (full_name, phone),
      vendeur:profiles!litiges_vendeur_id_fkey (full_name, phone)
    `)
    .eq('id', litigeId)
    .single();

  if (error) throw error;

  // Récupérer les preuves
  const { data: preuves, error: preuvesError } = await supabaseClient
    .from('litige_preuves')
    .select('id, uploaded_by, file_path, file_type, created_at')
    .eq('litige_id', litigeId)
    .order('created_at', { ascending: true });

  if (preuvesError) throw preuvesError;

  return { ...litige, preuves: preuves || [] };
}

// ── AJOUT D'UNE PREUVE (fichier) ──
async function uploadPreuve({
  supabaseClient,
  litigeId,
  userId,
  file
}) {
  if (!supabaseClient) throw new Error('Client Supabase introuvable.');
  if (!litigeId || !userId || !file) {
    throw new Error('Informations nécessaires manquantes.');
  }

  // Nettoyer le nom du fichier
  const fileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${litigeId}/${userId}/${Date.now()}_${fileName}`;

  // Upload vers le bucket "litiges"
  const { error: uploadError } = await supabaseClient
    .storage
    .from('litiges')
    .upload(path, file);

  if (uploadError) throw uploadError;

  // Déterminer le type (image ou vidéo)
  const fileType = file.type.startsWith('video/') ? 'video' : 'image';

  // Enregistrer la preuve en base
  const { error: insertError } = await supabaseClient
    .from('litige_preuves')
    .insert([{
      litige_id: litigeId,
      uploaded_by: userId,
      file_path: path,
      file_type: fileType
    }]);

  if (insertError) {
    // Nettoyer le fichier orphelin
    await supabaseClient.storage.from('litiges').remove([path]);
    throw insertError;
  }
}

// ── RÉCUPÉRER L'URL TEMPORAIRE D'UNE PREUVE ──
async function getPreuveUrl({ supabaseClient, filePath }) {
  if (!supabaseClient) throw new Error('Client Supabase introuvable.');
  if (!filePath) throw new Error('Chemin du fichier manquant.');

  const { data, error } = await supabaseClient
    .storage
    .from('litiges')
    .createSignedUrl(filePath, 3600);

  if (error) throw error;
  return data?.signedUrl;
}

// ── VÉRIFICATION SI ADMIN ──
async function isAdmin({ supabaseClient, userId }) {
  if (!supabaseClient || !userId) return false;

  const { data, error } = await supabaseClient
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) return false;
  return data.role === 'admin';
}

// ── LISTE DES LITIGES OUVERTS (pour admin) ──
async function getLitigesOuverts({ supabaseClient }) {
  if (!supabaseClient) throw new Error('Client Supabase introuvable.');

  const { data, error } = await supabaseClient
    .from('litiges')
    .select(`
      id,
      motif,
      statut,
      created_at,
      acheteur_id,
      vendeur_id,
      commande_items (titre, image_url)
    `)
    .in('statut', ['ouvert', 'en_cours'])
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

// ── RÉSOUDRE UN LITIGE (admin) ──
async function resolveLitige({
  supabaseClient,
  litigeId,
  statut,
  decision,
  resolvedBy
}) {
  if (!supabaseClient) throw new Error('Client Supabase introuvable.');
  if (!litigeId || !statut || !resolvedBy) {
    throw new Error('Informations de résolution incomplètes.');
  }

  const statutsAutorises = ['resolu_acheteur', 'resolu_vendeur', 'rejete'];
  if (!statutsAutorises.includes(statut)) {
    throw new Error('Statut de résolution invalide.');
  }

  const { error } = await supabaseClient
    .from('litiges')
    .update({
      statut,
      decision: decision || null,
      resolved_by: resolvedBy,
      resolved_at: new Date().toISOString()
    })
    .eq('id', litigeId);

  if (error) throw error;
}

// ── API PUBLIQUE ──
window.Litiges = {
  STATUTS: LITIGE_STATUTS,
  createLitige,
  getMesLitiges,
  getLitige,
  uploadPreuve,
  getPreuveUrl,
  isAdmin,
  getLitigesOuverts,
  resolveLitige
};