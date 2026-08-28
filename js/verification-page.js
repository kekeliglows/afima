

let currentUserId = null;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_SIZE = 8 * 1024 * 1024; // 8 Mo

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── HAMBURGER ──
const navToggle  = document.getElementById('navToggle');
const mobileMenu = document.getElementById('mobileMenu');
navToggle?.addEventListener('click', () => {
  const open = mobileMenu.classList.toggle('hidden') === false;
  navToggle.querySelector('.icon-menu')?.classList.toggle('hidden', open);
  navToggle.querySelector('.icon-close')?.classList.toggle('hidden', !open);
  navToggle.setAttribute('aria-expanded', String(open));
});
document.addEventListener('click', e => {
  if (mobileMenu && !mobileMenu.classList.contains('hidden') &&
      !navToggle.contains(e.target) && !mobileMenu.contains(e.target)) {
    mobileMenu.classList.add('hidden');
    navToggle.querySelector('.icon-menu')?.classList.remove('hidden');
    navToggle.querySelector('.icon-close')?.classList.add('hidden');
    navToggle.setAttribute('aria-expanded', 'false');
  }
});

function renderFormulaire(container, { rejetMotif } = {}) {
  container.innerHTML = `
    <h1 class="commandes-title"><i data-lucide="shield-check"></i> Vérification d'identité</h1>
    <p class="litige-preuves-vide" style="margin-bottom:16px;">
      Un document d'identité valide est nécessaire pour obtenir le badge "vendeur vérifié".
      Vos documents sont stockés de façon sécurisée et ne sont visibles que par vous et l'équipe afima.
    </p>

    ${rejetMotif ? `
      <div class="litige-decision" style="margin-bottom:20px;">
        <strong>Votre précédente demande a été rejetée :</strong>
        <p>${escapeHtml(rejetMotif)}</p>
      </div>` : ''}

    <form id="verifForm" class="litige-form">
      <label for="verifType">Type de document</label>
      <select id="verifType" required>
        <option value="">Choisissez un type de document</option>
        <option value="carte_identite">Carte d'identité</option>
        <option value="passeport">Passeport</option>
        <option value="permis_conduire">Permis de conduire</option>
      </select>

      <label for="verifFile" id="verifFileLabel">Photo ou scan du document (JPEG, PNG ou PDF, 8 Mo max)</label>
      <input type="file" id="verifFile" accept="image/jpeg,image/png,image/webp,application/pdf" required>

      <div id="verifVersoWrapper" class="hidden">
        <label for="verifFileVerso">Verso du document</label>
        <input type="file" id="verifFileVerso" accept="image/jpeg,image/png,image/webp,application/pdf">
      </div>

      <p id="verifMsg" class="litige-msg hidden"></p>

      <button type="submit" class="btn btn-primary" id="btnVerifSubmit">Envoyer pour vérification</button>
    </form>`;
  lucide.createIcons();

  const TYPES_RECTO_VERSO = new Set(['carte_identite', 'permis_conduire']);
  const typeSelect = document.getElementById('verifType');
  const versoWrapper = document.getElementById('verifVersoWrapper');
  const fileLabel = document.getElementById('verifFileLabel');
  const fileVersoInput = document.getElementById('verifFileVerso');

  typeSelect.addEventListener('change', () => {
    const besoinVerso = TYPES_RECTO_VERSO.has(typeSelect.value);
    versoWrapper.classList.toggle('hidden', !besoinVerso);
    fileVersoInput.required = besoinVerso;
    fileLabel.textContent = besoinVerso
      ? 'Recto du document (JPEG, PNG ou PDF, 8 Mo max)'
      : 'Photo ou scan du document (JPEG, PNG ou PDF, 8 Mo max)';
  });

  document.getElementById('verifForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnVerifSubmit');
    const msgEl = document.getElementById('verifMsg');
    const file = document.getElementById('verifFile').files[0];
    const fileVerso = document.getElementById('verifFileVerso').files[0] || null;
    const typeDocument = document.getElementById('verifType').value;
    const besoinVerso = TYPES_RECTO_VERSO.has(typeDocument);

    const fichiersAValider = fileVerso ? [file, fileVerso] : [file];
    for (const f of fichiersAValider) {
      if (f && !ALLOWED_TYPES.includes(f.type)) {
        msgEl.textContent = 'Format non supporté. Utilisez une image JPEG/PNG ou un PDF.';
        msgEl.className = 'litige-msg litige-msg-error';
        msgEl.classList.remove('hidden');
        return;
      }
      if (f && f.size > MAX_SIZE) {
        msgEl.textContent = 'Un des fichiers dépasse 8 Mo.';
        msgEl.className = 'litige-msg litige-msg-error';
        msgEl.classList.remove('hidden');
        return;
      }
    }
    if (besoinVerso && !fileVerso) {
      msgEl.textContent = 'Le verso est requis pour ce type de document.';
      msgEl.className = 'litige-msg litige-msg-error';
      msgEl.classList.remove('hidden');
      return;
    }

    btn.disabled = true;
    try {
      await Verification.submitVerification({ supabaseClient, userId: currentUserId, typeDocument, file, fileVerso });
      await render();
    } catch (err) {
      msgEl.textContent = 'Erreur : ' + (err.message || 'envoi impossible.');
      msgEl.className = 'litige-msg litige-msg-error';
      msgEl.classList.remove('hidden');
      btn.disabled = false;
    }
  });
}

function renderStatut(container, verif) {
  const statut = Verification.STATUTS[verif.statut] || { label: verif.statut, css: '' };
  const date = new Date(verif.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  container.innerHTML = `
    <h1 class="commandes-title"><i data-lucide="shield-check"></i> Vérification d'identité</h1>
    <div class="commande-card litige-detail-card">
      <p><span class="litige-statut ${statut.css}">${escapeHtml(statut.label)}</span></p>
      <p class="litige-description">
        Document envoyé : ${escapeHtml(Verification.TYPES[verif.type_document] || verif.type_document)}<br>
        Envoyé le ${date}.
        ${verif.statut === 'en_attente' ? 'Notre équipe examine votre dossier, cela peut prendre quelques jours.' : ''}
      </p>
    </div>`;
  lucide.createIcons();
}

async function render() {
  const content = document.getElementById('verif-content');
  const verif = await Verification.getMaVerification({ supabaseClient, userId: currentUserId });

  if (!verif || verif.statut === 'rejete') {
    renderFormulaire(content, { rejetMotif: verif?.statut === 'rejete' ? verif.motif_rejet : null });
  } else {
    renderStatut(content, verif);
  }
}

async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }
  currentUserId = session.user.id;

  const { data: profile } = await supabaseClient
    .from('profiles')
    .select('role')
    .eq('id', currentUserId)
    .maybeSingle();

  if (!profile || profile.role !== 'vendeur') {
    document.getElementById('verif-content').innerHTML =
      '<div class="commandes-empty"><p>La vérification d\'identité est réservée aux comptes vendeur. Devenez vendeur depuis votre profil pour y accéder.</p><a href="profil.html" class="btn btn-primary">Aller à mon profil</a></div>';
    return;
  }

  const logout = async () => { await supabaseClient.auth.signOut(); window.location.href = '../index.html'; };
  document.getElementById('btnLogout')?.addEventListener('click', logout);
  document.getElementById('btnLogoutMobile')?.addEventListener('click', logout);

  const total = await Cart.getCartCount({ supabaseClient, userId: currentUserId });
  const badge = document.getElementById('cartBadge');
  if (badge && total > 0) { badge.textContent = total; badge.classList.remove('hidden'); }

  await render();
}

init();