const SUPABASE_URL = 'https://ehkytlouakkfmtfatbmi.supabase.co';
const SUPABASE_KEY = 'sb_publishable_A-f-SEGhhW25sAulnHLIbA_OvyjQ9Qa';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ── REVEAL AU SCROLL ──
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); revealObserver.unobserve(e.target); } });
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

// ── COMPTEUR DE STATS ANIMÉ ──
const counterObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    const el     = e.target;
    const target = parseInt(el.dataset.target);
    const suffix = target === 98 || target === 24 ? (target === 98 ? '%' : 'h') : '+';
    let current  = 0;
    const step   = Math.ceil(target / 55);
    const timer  = setInterval(() => {
      current = Math.min(current + step, target);
      el.textContent = current.toLocaleString('fr-FR') + suffix;
      if (current >= target) clearInterval(timer);
    }, 22);
    counterObserver.unobserve(el);
  });
}, { threshold: 0.5 });
document.querySelectorAll('.stat-num').forEach(el => counterObserver.observe(el));

// ── MENU MOBILE HAMBURGER (toutes les pages) ──
const navToggle  = document.getElementById('navToggle');
const mobileMenu = document.getElementById('mobileMenu');
const iconMenu   = navToggle?.querySelector('.icon-menu');
const iconClose  = navToggle?.querySelector('.icon-close');

navToggle?.addEventListener('click', () => {
  const isOpen = !mobileMenu.classList.contains('hidden');
  mobileMenu.classList.toggle('hidden', isOpen);
  iconMenu?.classList.toggle('hidden', !isOpen);
  iconClose?.classList.toggle('hidden', isOpen);
  navToggle.setAttribute('aria-expanded', String(!isOpen));
});

document.addEventListener('click', (e) => {
  if (mobileMenu && !mobileMenu.classList.contains('hidden')) {
    if (!navToggle.contains(e.target) && !mobileMenu.contains(e.target)) {
      mobileMenu.classList.add('hidden');
      iconMenu?.classList.remove('hidden');
      iconClose?.classList.add('hidden');
      navToggle?.setAttribute('aria-expanded', 'false');
    }
  }
});

// ── PAGE D'ACCUEIL : bouton Get Started ──
const btnGetStarted = document.querySelector('.get_started');
if (btnGetStarted) {
  btnGetStarted.addEventListener('click', async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    const pageLink = (page) => window.location.pathname === '/' || window.location.pathname.endsWith('/index.html') ? `front-end/${page}` : page;
    window.location.href = session ? pageLink('catalogue.html') : pageLink('login.html');
  });
}

// ── PAGE AJOUTER PRODUIT ──
const form = document.getElementById('produitForm');
if (form) {
  const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const MAX_IMAGE_SIZE = 8 * 1024 * 1024; // 8 Mo

  // Protection de route
  supabaseClient.auth.getSession().then(({ data: { session } }) => {
    if (!session) window.location.href = 'login.html';
  });

  const logout = async () => {
    await supabaseClient.auth.signOut();
    window.location.href = '../index.html';
  };
  document.getElementById('btnLogout')?.addEventListener('click', logout);
  document.getElementById('btnLogoutMobile')?.addEventListener('click', logout);

  const photoFile = document.getElementById('photoFile');
  const photoUrl  = document.getElementById('photoUrlInput');
  const preview   = document.getElementById('imagePreview');
  const placeholder = document.getElementById('previewPlaceholder');

  function showPreview(src) {
    if (src) {
      preview.src = src;
      preview.classList.remove('hidden');
      placeholder?.classList.add('hidden');
    } else {
      preview.classList.add('hidden');
      placeholder?.classList.remove('hidden');
    }
  }

  function sanitizeFileName(name) {
    return name
      .normalize('NFKD').replace(/[\u0300-\u036f]/g, '') // enlève les accents
      .replace(/[^a-zA-Z0-9._-]/g, '_')                    // remplace le reste
      .slice(-100);                                        // évite les noms trop longs
  }

  function isLikelyImageUrl(url) {
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) return false;
      return /\.(jpe?g|png|gif|webp|avif)(\?.*)?$/i.test(parsed.pathname);
    } catch {
      return false;
    }
  }

  photoFile?.addEventListener('change', () => {
    const file = photoFile.files[0];
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      alert('Format non supporté. Utilisez une image JPG, PNG, WEBP ou GIF.');
      photoFile.value = '';
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      alert('Image trop lourde (8 Mo maximum).');
      photoFile.value = '';
      return;
    }

    photoUrl.value = '';
    showPreview(URL.createObjectURL(file));
  });

  photoUrl?.addEventListener('input', () => {
    const url = photoUrl.value.trim();
    if (url) { photoFile.value = ''; showPreview(url); }
    else showPreview(null);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const titre       = document.getElementById('titre').value.trim();
    const description  = document.getElementById('description').value.trim();
    const prixInput    = document.getElementById('prix').value;
    const stockInput   = document.getElementById('stock').value;
    const file         = photoFile.files[0];
    const directUrl    = photoUrl.value.trim();

    // ── Validation manuelle (le formulaire a "novalidate") ──
    if (!titre || titre.length > 150) {
      alert('Le titre est obligatoire (150 caractères maximum).');
      return;
    }
    if (!description || description.length > 2000) {
      alert('La description est obligatoire (2000 caractères maximum).');
      return;
    }

    const prix = Number(prixInput);
    if (!Number.isFinite(prix) || !Number.isInteger(prix) || prix < 0) {
      alert('Le prix doit être un nombre entier positif (pas de centimes).');
      return;
    }

    const stock = parseInt(stockInput, 10);
    if (!Number.isInteger(stock) || stock < 1) {
      alert('La quantité doit être un nombre entier d\'au moins 1.');
      return;
    }

    if (!file && !directUrl) {
      alert("Veuillez choisir une photo ou coller l'URL d'une image.");
      return;
    }
    if (directUrl && !isLikelyImageUrl(directUrl)) {
      alert("L'URL fournie ne semble pas pointer vers une image (jpg, png, webp, gif).");
      return;
    }

    const btn        = document.getElementById('submitBtn');
    const submitText = document.getElementById('submitText');
    btn.disabled = true;
    submitText.textContent = 'Publication en cours...';

    try {
      let finalImageUrl = directUrl;

      if (file) {
        const fileName = `${Date.now()}_${sanitizeFileName(file.name)}`;
        const { error: storageError } = await supabaseClient.storage
          .from('photos-produits').upload(fileName, file);
        if (storageError) throw storageError;

        const { data: urlData } = supabaseClient.storage
          .from('photos-produits').getPublicUrl(fileName);
        finalImageUrl = urlData.publicUrl;
      }

      const { data: { session: currentSession } } = await supabaseClient.auth.getSession();

      const { error: dbError } = await supabaseClient.from('produits').insert([{
        user_id:     currentSession.user.id,
        titre,
        description,
        prix,
        stock,
        image_url:   finalImageUrl
      }]);

      if (dbError) throw dbError;

      submitText.textContent = 'Publié !';
      setTimeout(() => window.location.href = 'catalogue.html', 800);

    } catch (err) {
      alert('Erreur : ' + err.message);
      btn.disabled = false;
      submitText.textContent = 'Publier le produit';
    }
  });
}
