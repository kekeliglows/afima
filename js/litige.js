let currentUserId = null;

function escapeHtml(str) {
  if (str === null || str === undefined) return '';

  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showMsg(text, type) {
  const el = document.getElementById('litigeMsg');

  if (!el) return;

  el.textContent = text;
  el.className = `litige-msg ${
    type === 'error' ? 'litige-msg-error' : 'litige-msg-success'
  }`;
  el.classList.remove('hidden');
}

// ── HAMBURGER ──
const navToggle = document.getElementById('navToggle');
const mobileMenu = document.getElementById('mobileMenu');

navToggle?.addEventListener('click', () => {
  if (!mobileMenu) return;

  const open = !mobileMenu.classList.contains('hidden');

  mobileMenu.classList.toggle('hidden');

  navToggle.querySelector('.icon-menu')?.classList.toggle('hidden', !open);
  navToggle.querySelector('.icon-close')?.classList.toggle('hidden', open);
  navToggle.setAttribute('aria-expanded', String(!open));
});

document.addEventListener('click', (e) => {
  if (
    mobileMenu &&
    navToggle &&
    !mobileMenu.classList.contains('hidden') &&
    !navToggle.contains(e.target) &&
    !mobileMenu.contains(e.target)
  ) {
    mobileMenu.classList.add('hidden');
    navToggle.querySelector('.icon-menu')?.classList.remove('hidden');
    navToggle.querySelector('.icon-close')?.classList.add('hidden');
    navToggle.setAttribute('aria-expanded', 'false');
  }
});

// ── MODE CRÉATION ──
function renderFormulaire(commandeItemId) {
  const content = document.getElementById('litige-content');

  if (!content) {
    console.error('Élément #litige-content introuvable.');
    return;
  }

  content.innerHTML = `
    <h1 class="commandes-title">
      <i data-lucide="shield-alert"></i>
      Signaler un problème
    </h1>

    <form id="litigeForm" class="litige-form">
      <label for="litigeMotif">Motif</label>

      <select id="litigeMotif" required>
        <option value="">Choisissez un motif</option>
        <option value="Produit non reçu">Produit non reçu</option>
        <option value="Produit non conforme à la description">
          Produit non conforme à la description
        </option>
        <option value="Produit endommagé">Produit endommagé</option>
        <option value="Retard de livraison important">
          Retard de livraison important
        </option>
        <option value="Autre">Autre</option>
      </select>

      <label for="litigeDescription">Décrivez le problème</label>

      <textarea
        id="litigeDescription"
        rows="5"
        placeholder="Expliquez ce qui s'est passé, en détail."
        required
      ></textarea>

      <p id="litigeMsg" class="litige-msg hidden"></p>

      <button
        type="submit"
        class="btn btn-primary"
        id="btnLitigeSubmit"
      >
        Envoyer le signalement
      </button>
    </form>
  `;

  lucide.createIcons();

  document.getElementById('litigeForm')?.addEventListener(
    'submit',
    async (e) => {
      e.preventDefault();

      const btn = document.getElementById('btnLitigeSubmit');

      if (btn) btn.disabled = true;

      try {
        const motif = document.getElementById('litigeMotif')?.value;
        const description = document
          .getElementById('litigeDescription')
          ?.value.trim();

        const litigeId = await Litiges.createLitige({
          supabaseClient,
          commandeItemId,
          motif,
          description
        });

        window.location.href =
          `litige.html?id=${encodeURIComponent(litigeId)}`;

      } catch (err) {
        showMsg(
          `Erreur : ${err.message || 'Impossible d\'envoyer le signalement.'}`,
          'error'
        );

        if (btn) btn.disabled = false;
      }
    }
  );
}

// ── MODE CONSULTATION ──
async function renderDetail(litigeId) {
  const content = document.getElementById('litige-content');

  if (!content) {
    console.error('Élément #litige-content introuvable.');
    return;
  }

  let litige;

  try {
    litige = await Litiges.getLitige({
      supabaseClient,
      litigeId
    });
  } catch (err) {
    content.innerHTML = `
      <div class="commandes-empty">
        <p>Litige introuvable, ou vous n'avez pas accès à celui-ci.</p>
      </div>
    `;
    return;
  }

  const statut = Litiges.STATUTS[litige.statut] || {
    label: litige.statut,
    css: 'litige-inconnu'
  };

  const produit = litige.commande_items || {};
  const estAcheteur = litige.acheteur_id === currentUserId;

  const peutAjouterPreuve =
    ['ouvert', 'en_cours'].includes(litige.statut) &&
    (
      litige.acheteur_id === currentUserId ||
      litige.vendeur_id === currentUserId
    );

  const date = new Date(litige.created_at).toLocaleDateString(
    'fr-FR',
    {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }
  );

  content.innerHTML = `
    <h1 class="commandes-title">
      <i data-lucide="shield-alert"></i>
      ${escapeHtml(litige.motif)}
    </h1>

    <div class="commande-card litige-detail-card">
      <div class="commande-item">
        <img
          class="commande-item-img"
          src="${escapeHtml(
            produit.image_url ||
            'https://placehold.co/56x56/f3f4f6/9ca3af?text=?'
          )}"
          alt="${escapeHtml(produit.titre || '')}"
          loading="lazy"
        >

        <div class="commande-item-info">
          <p class="commande-item-titre">
            ${escapeHtml(produit.titre || '')}
          </p>

          <p class="commande-item-detail">
            Ouvert le ${date} ·
            ${estAcheteur
              ? 'Vous êtes l\'acheteur'
              : 'Vous êtes le vendeur'}
          </p>
        </div>

        <span class="litige-statut ${statut.css}">
          ${escapeHtml(statut.label)}
        </span>
      </div>

      <p class="litige-description">
        ${escapeHtml(
          litige.description || 'Aucune description fournie.'
        )}
      </p>

      ${
        litige.decision
          ? `
            <div class="litige-decision">
              <strong>Décision d'afima :</strong>
              <p>${escapeHtml(litige.decision)}</p>
            </div>
          `
          : ''
      }
    </div>

    <section class="litige-preuves-section">
      <h2>Preuves</h2>

      <div
        id="litigePreuvesList"
        class="litige-preuves-list"
      >
        ${
          !litige.preuves || litige.preuves.length === 0
            ? `
              <p class="litige-preuves-vide">
                Aucune preuve envoyée pour l'instant.
              </p>
            `
            : ''
        }
      </div>

      ${
        peutAjouterPreuve
          ? `
            <div class="litige-preuve-upload">
              <label
                for="litigePreuveFile"
                class="btn btn-outline"
              >
                <i data-lucide="upload"></i>
                Ajouter une photo ou une vidéo
              </label>

              <input
                type="file"
                id="litigePreuveFile"
                accept="image/*,video/*"
                class="hidden"
              >

              <p
                id="litigePreuveMsg"
                class="litige-msg hidden"
              ></p>
            </div>
          `
          : ''
      }
    </section>
  `;

  lucide.createIcons();

  await renderPreuves(litige.preuves || []);

  const fileInput = document.getElementById('litigePreuveFile');

  fileInput?.addEventListener('change', async () => {
    const file = fileInput.files?.[0];

    if (!file) return;

    const msgEl = document.getElementById('litigePreuveMsg');

    try {
      await Litiges.uploadPreuve({
        supabaseClient,
        litigeId,
        userId: currentUserId,
        file
      });

      await renderDetail(litigeId);

    } catch (err) {
      if (!msgEl) return;

      msgEl.textContent =
        `Erreur : ${err.message || 'Envoi impossible.'}`;

      msgEl.className = 'litige-msg litige-msg-error';
      msgEl.classList.remove('hidden');
    }
  });
}

// ── AFFICHAGE DES PREUVES ──
async function renderPreuves(preuves) {
  if (!preuves || preuves.length === 0) return;

  const container = document.getElementById('litigePreuvesList');

  if (!container) return;

  const items = await Promise.all(
    preuves.map(async (p) => {
      try {
        const url = await Litiges.getPreuveUrl({
          supabaseClient,
          filePath: p.file_path
        });

        if (p.file_type === 'video') {
          return `
            <video
              class="litige-preuve-media"
              src="${url}"
              controls
            ></video>
          `;
        }

        return `
          <a href="${url}" target="_blank" rel="noopener">
            <img
              class="litige-preuve-media"
              src="${url}"
              alt="Preuve"
            >
          </a>
        `;

      } catch {
        return '';
      }
    })
  );

  container.innerHTML = items.filter(Boolean).join('');
}

// ── INITIALISATION ──
async function init() {
  if (typeof supabaseClient === 'undefined') {
    console.error(
      'supabaseClient est introuvable. Vérifie que supabase.js est chargé avant litige.js.'
    );
    return;
  }

  if (typeof Litiges === 'undefined') {
    console.error(
      'Litiges est introuvable. Vérifie que js/utils/litiges.js est chargé avant litige.js.'
    );
    return;
  }

  const {
    data: { session }
  } = await supabaseClient.auth.getSession();

  if (!session) {
    window.location.href = 'login.html';
    return;
  }

  currentUserId = session.user.id;

  const logout = async () => {
    await supabaseClient.auth.signOut();
    window.location.href = '../index.html';
  };

  document.getElementById('btnLogout')
    ?.addEventListener('click', logout);

  document.getElementById('btnLogoutMobile')
    ?.addEventListener('click', logout);

  if (typeof Cart !== 'undefined') {
    try {
      const total = await Cart.getCartCount({
        supabaseClient,
        userId: currentUserId
      });

      const badge = document.getElementById('cartBadge');

      if (badge && total > 0) {
        badge.textContent = total;
        badge.classList.remove('hidden');
      }
    } catch (err) {
      console.error('Erreur lors du chargement du panier :', err);
    }
  }

  const params = new URLSearchParams(window.location.search);
  const litigeId = params.get('id');
  const commandeItemId = params.get('commande_item_id');

  if (litigeId) {
    await renderDetail(litigeId);
  } else if (commandeItemId) {
    renderFormulaire(commandeItemId);
  } else {
    const content = document.getElementById('litige-content');

    if (content) {
      content.innerHTML = `
        <div class="commandes-empty">
          <p>Aucun litige ou commande spécifié.</p>
        </div>
      `;
    }
  }
}

init();