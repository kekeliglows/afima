

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}


async function renderListe() {
  const litiges = await Litiges.getLitigesOuverts({ supabaseClient });
  const list = document.getElementById('admin-litiges-list');

  if (litiges.length === 0) {
    list.innerHTML = `
      <div class="commandes-empty">
        <p>Aucun litige en attente de traitement.</p>
      </div>`;
    lucide.createIcons();
    return;
  }

  list.innerHTML = litiges.map(l => {
    const statut = Litiges.STATUTS[l.statut] || { label: l.statut, css: 'litige-inconnu' };
    const date = new Date(l.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    const produit = l.commande_items || {};

    return `
      <a class="commande-card litige-card" href="litige.html?id=${encodeURIComponent(l.id)}">
        <div class="commande-item">
          <img class="commande-item-img"
               src="${escapeHtml(produit.image_url || 'https://placehold.co/56x56/f3f4f6/9ca3af?text=?')}"
               alt="${escapeHtml(produit.titre || '')}" loading="lazy">
          <div class="commande-item-info">
            <p class="commande-item-titre">${escapeHtml(l.motif)}</p>
            <p class="commande-item-detail">${escapeHtml(produit.titre || '')} · ouvert le ${date}</p>
          </div>
          <span class="litige-statut ${statut.css}">${escapeHtml(statut.label)}</span>
        </div>
      </a>`;
  }).join('');

  lucide.createIcons();
}

async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }

  const admin = await Litiges.isAdmin({ supabaseClient, userId: session.user.id });
  if (!admin) {
    document.getElementById('admin-litiges-list').innerHTML = `
      <div class="commandes-empty">
        <p>Accès réservé à l'équipe afima.</p>
        <a href="../index.html" class="btn btn-primary">Retour à l'accueil</a>
      </div>`;
    lucide.createIcons();
    return;
  }

  const logout = async () => { await supabaseClient.auth.signOut(); window.location.href = '../index.html'; };
  document.getElementById('btnLogout')?.addEventListener('click', logout);
  document.getElementById('btnLogoutMobile')?.addEventListener('click', logout);

  await renderListe();
}

init();