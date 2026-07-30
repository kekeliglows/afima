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

// Fermer le menu si on clique en dehors
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
    window.location.href = session ? 'catalogue.html' : 'login.html';
  });
}

// ── PAGE AJOUTER PRODUIT ──
const form = document.getElementById('produitForm');
if (form) {
  // Protection de route
  supabaseClient.auth.getSession().then(({ data: { session } }) => {
    if (!session) window.location.href = 'login.html';
  });

  // Déconnexion desktop + mobile
  const logout = async () => {
    await supabaseClient.auth.signOut();
    window.location.href = 'index.html';
  };
  document.getElementById('btnLogout')?.addEventListener('click', logout);
  document.getElementById('btnLogoutMobile')?.addEventListener('click', logout);

  // Preview image
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

  photoFile?.addEventListener('change', () => {
    const file = photoFile.files[0];
    if (file) { photoUrl.value = ''; showPreview(URL.createObjectURL(file)); }
  });

  photoUrl?.addEventListener('input', () => {
    const url = photoUrl.value.trim();
    if (url) { photoFile.value = ''; showPreview(url); }
    else showPreview(null);
  });

  // Soumission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const file      = photoFile.files[0];
    const directUrl = photoUrl.value.trim();

    if (!file && !directUrl) {
      alert("Veuillez choisir une photo ou coller l'URL d'une image.");
      return;
    }

    const btn        = document.getElementById('submitBtn');
    const submitText = document.getElementById('submitText');
    btn.disabled = true;
    submitText.textContent = 'Publication en cours...';

    try {
      let finalImageUrl = directUrl;

      if (file) {
        const fileName = Date.now() + '_' + file.name;
        const { error: storageError } = await supabaseClient.storage
          .from('photos-produits').upload(fileName, file);
        if (storageError) throw storageError;

        const { data: urlData } = supabaseClient.storage
          .from('photos-produits').getPublicUrl(fileName);
        finalImageUrl = urlData.publicUrl;
      }

      const { error: dbError } = await supabaseClient.from('produits').insert([{
        titre:       document.getElementById('titre').value,
        description: document.getElementById('description').value,
        prix:        parseFloat(document.getElementById('prix').value),
        stock:       parseInt(document.getElementById('stock').value),
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
