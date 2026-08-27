const SUPABASE_URL = 'https://ehkytlouakkfmtfatbmi.supabase.co';
const SUPABASE_KEY = 'sb_publishable_A-f-SEGhhW25sAulnHLIbA_OvyjQ9Qa';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const AVATAR_BUCKET = 'avatars';
const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5 Mo

let currentUserId = null;
let currentProfile = null;

document.addEventListener('DOMContentLoaded', () => {
    initHamburger();
    initProfile();
});

async function initProfile() {
 

  const { data: { session } } = await sb.auth.getSession();
    if (!session) {
      window.location.href = 'login.html';
      return;
    }

    currentUserId = session.user.id;

    document.getElementById('btnLogout')?.addEventListener('click', logout);
    document.getElementById('btnLogoutMobile')?.addEventListener('click', logout);
    document.getElementById('btnLogoutDanger')?.addEventListener('click', logout);
    document.getElementById('profilForm')?.addEventListener('submit', saveProfile);
    document.getElementById('avatarFile')?.addEventListener('change', previewAvatar);

    await loadProfile(session.user);
    await loadProductCount(currentUserId);
  initVendeurModal();
}

async function loadProfile(sessionUser) {
  const { data: profile, error } = await sb
    .from('profiles')
    .select('full_name, phone, city, bio, avatar_url, updated_at, role, currency')
    .eq('id', currentUserId)
    .maybeSingle();

  if (error) {
    showMsg('Impossible de charger le profil.', 'error');
    return;
  }

  currentProfile = profile || {
      full_name: sessionUser.email.split('@')[0],
      bio: '',
      phone: '',
      city: '',
      avatar_url: null,
      updated_at: sessionUser.created_at,
      role: 'acheteur',
      currency: 'EUR'
  };

  if (!profile) {
    await sb.from('profiles').upsert({
      id: currentUserId,
      full_name: currentProfile.full_name,
      phone: null,
      city: null,
      bio: null,
      avatar_url: null,
      currency: 'EUR'
    }, { onConflict: 'id' });
  }

  const displayName = currentProfile.full_name || sessionUser.email.split('@')[0];
  document.getElementById('profilNomDisplay').textContent = displayName;
  startGreetingRefresh('profilNomDisplay', displayName);

  document.getElementById('profilEmailDisplay').textContent = sessionUser.email;
  document.getElementById('profilBioDisplay').textContent = currentProfile.bio || 'Aucune bio renseignée.';

  document.getElementById('profilNom').value = currentProfile.full_name || '';
  document.getElementById('profilTel').value = currentProfile.phone || '';
  document.getElementById('profilVille').value = currentProfile.city || '';
  document.getElementById('profilBio').value = currentProfile.bio || '';
  document.getElementById('profilCurrency').value = currentProfile.currency || 'EUR';

  const memberDate = currentProfile.updated_at || sessionUser.created_at;
  document.getElementById('profilMembre').textContent = memberDate
    ? `Membre depuis ${formatDate(memberDate)}`
    : 'Membre depuis —';

  renderAvatar(currentProfile.avatar_url);
  updateRoleUI(currentProfile.role);
}

function updateRoleUI(role) {
  const roleSection = document.getElementById('roleSection');
  const roleBadge = document.getElementById('profilRoleBadge');
  const btnDevenirVendeur = document.getElementById('btnDevenirVendeur');

  roleSection.classList.remove('hidden');
  roleBadge.textContent = role === 'vendeur' ? 'Vendeur' : 'Acheteur';
  roleBadge.className = 'profil-role-badge ' + (role === 'vendeur' ? 'vendeur' : 'acheteur');

  if (role === 'vendeur') {
    btnDevenirVendeur.classList.add('hidden');
  } else {
    btnDevenirVendeur.classList.remove('hidden');
  }
}

async function loadProductCount(userId) {
  const { count, error } = await sb
    .from('produits')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  const total = error || count === null ? 0 : count;
  const countElement = document.getElementById('profilNbProduits');
  if (countElement) {
    countElement.textContent = `${total} produit(s)`;
  }
}

function renderAvatar(url) {
  const avatarImg = document.getElementById('avatarImg');
  const avatarPlaceholder = document.getElementById('avatarPlaceholder');

  if (url && avatarImg) {
    avatarImg.src = url;
    avatarImg.classList.remove('hidden');
    avatarPlaceholder?.classList.add('hidden');
  } else if (avatarPlaceholder) {
    avatarImg?.classList.add('hidden');
    avatarPlaceholder.classList.remove('hidden');
  }
}

function validateAvatarFile(file) {
  if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
    return 'Format non supporté. Utilisez une image JPG, PNG, WEBP ou GIF.';
  }
  if (file.size > MAX_AVATAR_SIZE) {
    return 'Image trop lourde (5 Mo maximum).';
  }
  return null;
}

function previewAvatar() {
  const fileInput = document.getElementById('avatarFile');
  const file = fileInput.files?.[0];
  if (!file) return;

  const errorMsg = validateAvatarFile(file);
  if (errorMsg) {
    showMsg(errorMsg, 'error');
    fileInput.value = '';
    return;
  }

  const avatarImg = document.getElementById('avatarImg');
  if (avatarImg) {
    avatarImg.src = URL.createObjectURL(file);
    avatarImg.classList.remove('hidden');
    document.getElementById('avatarPlaceholder')?.classList.add('hidden');
  }
}

// Extrait le chemin interne au bucket à partir de l'URL publique,
// pour pouvoir supprimer l'ancien fichier lors d'un remplacement.
function getStoragePathFromUrl(url) {
  if (!url) return null;
  const marker = `/${AVATAR_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
}

async function saveProfile(event) {
  event.preventDefault();

  const fullName = document.getElementById('profilNom').value.trim();
  const phone = document.getElementById('profilTel').value.trim();
  const city = document.getElementById('profilVille').value.trim();
  const bio = document.getElementById('profilBio').value.trim();
  const currency = document.getElementById('profilCurrency').value;
  const file = document.getElementById('avatarFile').files?.[0];
  const btn = document.getElementById('profilSubmit');

  if (file) {
    const errorMsg = validateAvatarFile(file);
    if (errorMsg) { showMsg(errorMsg, 'error'); return; }
  }

  btn.disabled = true;
  const originalBtnText = btn.innerHTML;
  btn.textContent = "Enregistrement...";

  try {
    const updates = {
      id: currentUserId,
      full_name: fullName || currentProfile.full_name || '',
      phone: phone || null,
      city: city || null,
      bio: bio || null,
      currency: currency,
      updated_at: new Date().toISOString()
    };

    if (file) {
      const oldPath = getStoragePathFromUrl(currentProfile.avatar_url);

      const fileExt = file.name.split('.').pop();
      const filePath = `${currentUserId}/avatar-${Date.now()}.${fileExt}`;

      const { error: storageError } = await sb.storage
        .from(AVATAR_BUCKET)
        .upload(filePath, file, { upsert: true });

      if (storageError) throw storageError;

      const { data: urlData } = sb.storage
        .from(AVATAR_BUCKET)
        .getPublicUrl(filePath);

      updates.avatar_url = urlData.publicUrl;

      // Nettoyage de l'ancien avatar (best effort, on n'échoue pas
      // l'enregistrement du profil si ça rate)
      if (oldPath) {
        sb.storage.from(AVATAR_BUCKET).remove([oldPath])
          .catch(err => console.warn('Impossible de supprimer l\'ancien avatar :', err.message));
      }
    }

    const { error } = await sb
      .from('profiles')
      .upsert(updates, { onConflict: 'id' });

    if (error) throw error;

    currentProfile = { ...currentProfile, ...updates };

    document.getElementById('profilNomDisplay').textContent = currentProfile.full_name;
    document.getElementById('profilBioDisplay').textContent = currentProfile.bio || 'Aucune bio renseignée.';
    renderAvatar(currentProfile.avatar_url);

    localStorage.setItem('afima_currency', updates.currency);

    showMsg('Profil mis à jour avec succès.', 'success');
  } catch (err) {
    showMsg(`Erreur lors de la mise à jour : ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalBtnText;
  }
}

function logout() {
  sb.auth.signOut().then(() => {
    window.location.href = '../index.html';
  });
}

function showMsg(text, type) {
  const box = document.getElementById('profilMessage');
  if (!box) return;
  box.textContent = text;
  box.className = `profil-msg ${type}`;
  setTimeout(() => {
    box.className = 'profil-msg hidden';
  }, 4500);
}

function formatDate(value) {
  const date = new Date(value);
  return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

function initHamburger() {
  const toggle = document.getElementById('navToggle');
  const menu = document.getElementById('mobileMenu');

  toggle?.addEventListener('click', () => {
    const open = menu.classList.toggle('hidden') === false;
    toggle.querySelector('.icon-menu')?.classList.toggle('hidden', open);
    toggle.querySelector('.icon-close')?.classList.toggle('hidden', !open);
    toggle.setAttribute('aria-expanded', String(open));
  });

  document.addEventListener('click', e => {
    if (menu && !menu.classList.contains('hidden') && !toggle.contains(e.target) && !menu.contains(e.target)) {
      menu.classList.add('hidden');
      toggle.querySelector('.icon-menu')?.classList.remove('hidden');
      toggle.querySelector('.icon-close')?.classList.add('hidden');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });
}

// ── MODAL DEVENIR VENDEUR ──
function initVendeurModal() {
  const modal = document.getElementById('vendeurModal');
  const btnOpen = document.getElementById('btnDevenirVendeur');
  const btnClose = document.getElementById('closeVendeurModal');
  const form = document.getElementById('vendeurForm');

  btnOpen?.addEventListener('click', () => {
    modal.classList.remove('hidden');
    document.getElementById('vendeurNom').value = document.getElementById('profilNom').value || '';
    document.getElementById('vendeurTel').value = document.getElementById('profilTel').value || '';
    document.getElementById('vendeurVille').value = document.getElementById('profilVille').value || '';
  });

  btnClose?.addEventListener('click', () => modal.classList.add('hidden'));
  modal?.addEventListener('click', e => { if (e.target === modal) modal.classList.add('hidden'); });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;

    const updates = {
      id: currentUserId,
      role: 'vendeur',
      full_name: document.getElementById('vendeurNom').value.trim(),
      phone: document.getElementById('vendeurTel').value.trim(),
      city: document.getElementById('vendeurVille').value.trim() || null,
      updated_at: new Date().toISOString()
    };

    if (!updates.full_name || !updates.phone) {
      showMsg('Nom et téléphone sont obligatoires pour devenir vendeur.', 'error');
      btn.disabled = false;
      return;
    }

    const { error } = await sb.from('profiles').upsert(updates, { onConflict: 'id' });

    if (error) {
      showMsg('Erreur : ' + error.message, 'error');
      btn.disabled = false;
      return;
    }

    currentProfile = { ...currentProfile, ...updates };
    document.getElementById('profilNom').value = updates.full_name;
    document.getElementById('profilTel').value = updates.phone || '';
    document.getElementById('profilVille').value = updates.city || '';
    document.getElementById('profilNomDisplay').textContent = updates.full_name;

    modal.classList.add('hidden');
    updateRoleUI('vendeur');
    showMsg('Félicitations ! Vous êtes maintenant vendeur.', 'success');
    lucide.createIcons();
  });
}
