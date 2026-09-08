// supabaseClient est exposé par js/supabase.js (window.supabaseClient)

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}


function fmt(n) { return Currency.formatPrice(n); }

// ── Mapping complet des statuts (aligné sur la DB et le CDC) ──
const STATUTS = {
  // Statuts actuels (court terme)
  en_attente_paiement:  { label: 'En attente de paiement', icon: 'clock',          css: 'statut-attente'      },
  confirmee:             { label: 'Confirmée',              icon: 'check-circle',   css: 'statut-confirmee'    },
  // Statuts de livraison (CDC Phase 1)
  en_preparation:        { label: 'En préparation',         icon: 'package',        css: 'statut-preparation'  },
  expediee:              { label: 'Expédiée',               icon: 'send',           css: 'statut-expediee'     },
  en_transit:            { label: 'En transit',             icon: 'truck',          css: 'statut-en-cours'     },
  livree:                { label: 'Livrée',                 icon: 'package-check',  css: 'statut-livree'       },
  confirmee_acheteur:    { label: 'Réception confirmée',    icon: 'badge-check',    css: 'statut-confirmee'    },
  completed:             { label: 'Terminée',               icon: 'circle-check',   css: 'statut-confirmee'    },
  annulee:               { label: 'Annulée',                icon: 'x-circle',       css: 'statut-annulee'      },
  // Alias legacy (au cas où la DB utilise encore ces valeurs)
  en_cours:              { label: 'En cours',               icon: 'truck',          css: 'statut-en-cours'     },
};
const STATUT_INCONNU = { label: 'Statut inconnu', icon: 'help-circle', css: 'statut-inconnu' };

// Commandes pour lesquelles il est pertinent de proposer un avis
const STATUTS_AVIS_AUTORISE = new Set(['confirmee','en_preparation','expediee','en_transit','livree','confirmee_acheteur','completed','en_cours']);
// Commandes pour lesquelles on peut signaler un problème
const STATUTS_LITIGE_AUTORISE = new Set(['en_transit','livree','confirmee_acheteur','en_cours']);
// Commandes pour lesquelles l'acheteur peut confirmer la réception
const STATUTS_CONFIRMATION_AUTORISE = new Set(['livree']);

async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }

  const logout = async () => { await supabaseClient.auth.signOut(); window.location.href = '../index.html'; };
  document.getElementById('btnLogout')?.addEventListener('click', logout);
  document.getElementById('btnLogoutMobile')?.addEventListener('click', logout);

  if (window.Notifications?.initNotifBell) {
    window.Notifications.initNotifBell({ supabaseClient, userId: session.user.id });
  }

  const total = await Cart.getCartCount({ supabaseClient, userId: session.user.id });
  const badge = document.getElementById('cartBadge');
  if (badge && total > 0) { badge.textContent = total; badge.classList.remove('hidden'); }

  await loadCommandes(session.user.id);
}

async function loadCommandes(userId) {
  const list = document.getElementById('commandes-list');
  const { data: { session } } = await supabaseClient.auth.getSession();

  const { data, error } = await supabaseClient
    .from('commandes')
    .select('*, commande_items(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  document.getElementById('cmdSkeleton')?.remove();

  if (error) {
    list.innerHTML = `<p style="color:#dc2626;font-weight:600;padding:20px">Erreur : ${escapeHtml(error.message)}</p>`;
    return;
  }

  if (!data || data.length === 0) {
    list.innerHTML = `
      <div class="commandes-empty">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        </svg>
        <p>Vous n'avez pas encore de commandes.</p>
        <a href="catalogue.html" class="btn btn-primary">Parcourir le catalogue</a>
      </div>`;
    lucide.createIcons();
    return;
  }

  list.innerHTML = data.map(cmd => {
    const statut = STATUTS[cmd.statut] || STATUT_INCONNU;
    const date   = new Date(cmd.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    const items  = cmd.commande_items || [];
    const avisAutorise    = STATUTS_AVIS_AUTORISE.has(cmd.statut);
    const litigeAutorise  = STATUTS_LITIGE_AUTORISE.has(cmd.statut);
    const peutConfirmer   = STATUTS_CONFIRMATION_AUTORISE.has(cmd.statut);

    const itemsHtml = items.map(item => {
      const titreSafe = escapeHtml(item.titre);
      return `
      <div class="commande-item">
        <img class="commande-item-img"
             src="${escapeHtml(item.image_url || 'https://placehold.co/56x56/f3f4f6/9ca3af?text=?')}"
             alt="${titreSafe}" loading="lazy">
        <div class="commande-item-info">
          <p class="commande-item-titre">${titreSafe}</p>
          <p class="commande-item-detail">Qté : ${item.quantite} × ${fmt(item.prix_unitaire)}</p>
        </div>
        ${avisAutorise ? `<button class="btn-review" type="button" onclick="window.location.href='produit.html?id=${encodeURIComponent(item.produit_id)}&review=1'">Laisser un avis</button>` : ''}
        ${litigeAutorise ? `<button class="btn-litige" type="button" onclick="window.location.href='litige.html?commande_item_id=${encodeURIComponent(item.id)}'">Signaler un problème</button>` : ''}
        <span class="commande-item-prix">${fmt(item.prix_unitaire * item.quantite)}</span>
      </div>`;
    }).join('');

    const adresseHtml = cmd.adresse_livraison ? `
      <div class="commande-adresse">
        <i data-lucide="map-pin"></i>
        <span>${escapeHtml([cmd.adresse_livraison.nom_destinataire, cmd.adresse_livraison.rue, cmd.adresse_livraison.quartier, cmd.adresse_livraison.ville, cmd.adresse_livraison.pays].filter(Boolean).join(', '))}</span>
      </div>` : '';

    return `
      <div class="commande-card">
        <div class="commande-header">
          <span class="commande-id">#${escapeHtml(cmd.id.slice(0, 8).toUpperCase())}</span>
          <span class="commande-date">
            <i data-lucide="calendar"></i> ${date}
          </span>
          <span class="commande-statut ${statut.css}">
            <i data-lucide="${statut.icon}"></i> ${statut.label}
          </span>
        </div>
        <div class="commande-items">${itemsHtml}</div>
        ${adresseHtml}
        <div class="commande-footer">
          <span class="commande-total-label">Total commande</span>
          <span class="commande-total-val">${fmt(cmd.total)}</span>
          ${peutConfirmer ? `<button class="btn-confirmer-livraison" type="button" data-id="${escapeHtml(cmd.id)}"><i data-lucide="package-check"></i> Confirmer la réception</button>` : ''}
        </div>
      </div>`;
  }).join('');

  lucide.createIcons();

  // ── Confirmation de réception ──
  list.querySelectorAll('.btn-confirmer-livraison').forEach(btn => {
    btn.addEventListener('click', async () => {
      const commandeId = btn.dataset.id;
      if (!confirm('Confirmez-vous la bonne réception de cette commande ? Les fonds seront libérés au vendeur.')) return;
      btn.disabled = true;
      btn.textContent = 'Confirmation…';
      const { error } = await supabaseClient.rpc('release_escrow', { p_commande_id: commandeId });
      if (error) {
        alert('Erreur : ' + error.message);
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="package-check"></i> Confirmer la réception';
        lucide.createIcons();
      } else {
        await loadCommandes(session.user.id);
      }
    });
  });
}

init();