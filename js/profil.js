const SUPABASE_URL = 'https://ehkytlouakkfmtfatbmi.supabase.co';
const SUPABASE_KEY = 'sb_publishable_A-f-SEGhhW25sAulnHLIbA_OvyjQ9Qa';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const AVATAR_BUCKET = 'avatars';
let currentUserId = null;
let currentProfile = null;

// Initialisation au chargement de la page
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

  // Écouteurs d'événements
  document.getElementById('btnLogout')?.addEventListener('click', logout);
  document.getElementById('btnLogoutMobile')?.addEventListener('click', logout);
  document.getElementById('btnLogoutDanger')?.addEventListener('click', logout);
  document.getElementById('profilForm')?.addEventListener('submit', saveProfile);
  document.getElementById('avatarFile')?.addEventListener('change', previewAvatar);

  await loadProfile(session.user);
  await loadProductCount(currentUserId);
}

async function loadProfile(sessionUser) {
  const { data: profile, error } = await sb
    .from('profiles')
    .select('full_name, phone, city, bio, avatar_url, updated_at')
    .eq('id', currentUserId)
    .maybeSingle();

  if (error) {
    showMsg('Impossible de charger le profil.', 'error');
    return;
  }

  // Profil par défaut si inexistant
  currentProfile = profile || { 
      full_name: sessionUser.email.split('@')[0], 
      bio: '', 
      phone: '', 
      city: '', 
      avatar_url: null, 
      updated_at: sessionUser.created_at 
  };

  // Création du profil en base s'il n'existe pas encore
  if (!profile) {
    await sb.from('profiles').upsert({
      id: currentUserId,
      full_name: currentProfile.full_name,
      phone: null,
      city: null,
      bio: null,
      avatar_url: null
    }, { onConflict: 'id' });
  }

  // Mise à jour de l'affichage HTML
  document.getElementById('profilNomDisplay').textContent = currentProfile.full_name || sessionUser.email;
  document.getElementById('profilEmailDisplay').textContent = sessionUser.email;
  document.getElementById('profilBioDisplay').textContent = currentProfile.bio || 'Aucune bio renseignée.';
  
  // Remplissage des champs de formulaire
  document.getElementById('profilNom').value = currentProfile.full_name || '';
  document.getElementById('profilTel').value = currentProfile.phone || '';
  document.getElementById('profilVille').value = currentProfile.city || '';
  document.getElementById('profilBio').value = currentProfile.bio || '';
  
  const memberDate = currentProfile.updated_at || sessionUser.created_at;
  document.getElementById('profilMembre').textContent = memberDate
    ? `Membre depuis ${formatDate(memberDate)}`
    : 'Membre depuis —';

  renderAvatar(currentProfile.avatar_url);
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

function previewAvatar() {
  const fileInput = document.getElementById('avatarFile');
  const file = fileInput.files?.[0];
  if (!file) return;
  
  const avatarImg = document.getElementById('avatarImg');
  if (avatarImg) {
    avatarImg.src = URL.createObjectURL(file);
    avatarImg.classList.remove('hidden');
    document.getElementById('avatarPlaceholder')?.classList.add('hidden');
  }
}

async function saveProfile(event) {
  event.preventDefault();

  const fullName = document.getElementById('profilNom').value.trim();
  const phone = document.getElementById('profilTel').value.trim();
  const city = document.getElementById('profilVille').value.trim();
  const bio = document.getElementById('profilBio').value.trim();
  const file = document.getElementById('avatarFile').files?.[0];
  const btn = document.getElementById('profilSubmit');

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
      updated_at: new Date().toISOString()
    };

    // Téléversement de l'avatar vers le bucket Supabase Storage si un fichier a été sélectionné
    if (file) {
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
    }

    // Mise à jour de la table 'profiles' dans Supabase
    const { error } = await sb
      .from('profiles')
      .upsert(updates, { onConflict: 'id' });

    if (error) throw error;

    currentProfile = { ...currentProfile, ...updates };

    // Mise à jour visuelle instantanée
    document.getElementById('profilNomDisplay').textContent = currentProfile.full_name;
    document.getElementById('profilBioDisplay').textContent = currentProfile.bio || 'Aucune bio renseignée.';
    renderAvatar(currentProfile.avatar_url);

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