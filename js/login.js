document.addEventListener('DOMContentLoaded', () => {
  const SUPABASE_URL = 'https://ehkytlouakkfmtfatbmi.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_A-f-SEGhhW25sAulnHLIbA_OvyjQ9Qa';
  const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ── COMPTEUR DE STATS ANIMÉ ──
  document.querySelectorAll('.stat-num').forEach(el => {
    const target = parseInt(el.dataset.target);
    const suffix = target === 98 ? '%' : '+';
    let current  = 0;
    const step   = Math.ceil(target / 60);
    const timer  = setInterval(() => {
      current = Math.min(current + step, target);
      el.textContent = current.toLocaleString('fr-FR') + suffix;
      if (current >= target) clearInterval(timer);
    }, 24);
  });

  // ── ONGLETS AVEC INDICATEUR GLISSANT ──
  const tabLogin    = document.getElementById('tab-login');
  const tabSignup   = document.getElementById('tab-signup');
  const loginForm   = document.getElementById('loginForm');
  const signupForm  = document.getElementById('signupForm');
  const indicator   = document.getElementById('tabIndicator');
  const subtitle    = document.getElementById('auth-subtitle');

  function switchTab(toLogin) {
    tabLogin.classList.toggle('active', toLogin);
    tabSignup.classList.toggle('active', !toLogin);
    indicator.classList.toggle('right', !toLogin);

    loginForm.classList.toggle('active', toLogin);
    signupForm.classList.toggle('active', !toLogin);

    subtitle.textContent = toLogin
      ? 'Connectez-vous pour continuer sur afima.'
      : 'Créez votre compte gratuitement.';

    hideMessage();
  }

  tabLogin.addEventListener('click',  () => switchTab(true));
  tabSignup.addEventListener('click', () => switchTab(false));

  // ── SHOW / HIDE PASSWORD ──
  document.querySelectorAll('.toggle-pw').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      const isHidden = input.type === 'password';
      input.type = isHidden ? 'text' : 'password';
      btn.querySelector('svg').setAttribute('data-lucide', isHidden ? 'eye-off' : 'eye');
      lucide.createIcons();
    });
  });

  // ── FORCE DU MOT DE PASSE ──
  const pwInput = document.getElementById('signupPassword');
  const pwBar   = document.getElementById('pwBar');
  const pwLabel = document.getElementById('pwLabel');

  const levels = [
    { min: 0,  max: 2,  color: '#ef4444', label: 'Trop faible',  width: '25%'  },
    { min: 3,  max: 4,  color: '#f97316', label: 'Faible',       width: '50%'  },
    { min: 5,  max: 6,  color: '#eab308', label: 'Moyen',        width: '75%'  },
    { min: 7,  max: 99, color: '#22c55e', label: 'Fort',         width: '100%' },
  ];

  function computePasswordScore(v) {
    let score = 0;
    if (v.length >= 8)              score++;
    if (v.length >= 12)             score++;
    if (/[A-Z]/.test(v))            score++;
    if (/[a-z]/.test(v))            score++;
    if (/[0-9]/.test(v))            score++;
    if (/[^A-Za-z0-9]/.test(v))     score++;
    if (v.length >= 6)              score++;
    return score;
  }

  pwInput?.addEventListener('input', () => {
    const v = pwInput.value;
    const score = computePasswordScore(v);
    const lvl = levels.find(l => score >= l.min && score <= l.max) || levels[0];
    pwBar.style.width    = v.length ? lvl.width : '0%';
    pwBar.style.background = lvl.color;
    pwLabel.textContent  = v.length ? lvl.label : '';
    pwLabel.style.color  = lvl.color;
  });

  // ── SÉLECTEUR DE RÔLE (ACHETEUR/VENDEUR) ──
  const vendeurFields = document.getElementById('vendeurFields');
  const roleInputs = document.querySelectorAll('input[name="userRole"]');

  roleInputs.forEach(input => {
    input.addEventListener('change', () => {
      const isVendeur = document.querySelector('input[name="userRole"]:checked').value === 'vendeur';
      vendeurFields.classList.toggle('hidden', !isVendeur);
      lucide.createIcons();
    });
  });

  // ── MESSAGES ──
  const messageBox = document.getElementById('auth-message');

  function showMessage(text, isError = true) {
    messageBox.innerHTML = `<i data-lucide="${isError ? 'alert-circle' : 'check-circle'}"></i> ${escapeHtml(text)}`;
    messageBox.className = `message-box ${isError ? 'error' : 'success'}`;
    lucide.createIcons();
  }

  function hideMessage() {
    messageBox.className = 'message-box hidden';
  }

  // ── CONNEXION ──
  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    hideMessage();
    const btn = document.getElementById('btnLogin');
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader-2" class="spin"></i><span>Connexion...</span>';
    lucide.createIcons();

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    const { error } = await client.auth.signInWithPassword({ email, password });

    if (error) {
      showMessage(error.message);
      btn.disabled = false;
      btn.innerHTML = '<span>Se connecter</span><i data-lucide="arrow-right"></i>';
      lucide.createIcons();
    } else {
      // Si un rôle "vendeur" avait été choisi lors d'une inscription
      // précédente mais n'avait pas pu être sauvegardé (email pas encore
      // confirmé à ce moment-là), on l'applique maintenant.
      await applyPendingProfileIfAny(client);

      showMessage('Connexion réussie ! Redirection...', false);
      setTimeout(() => window.location.href = 'catalogue.html', 900);
    }
  });

  // ── INSCRIPTION ──
  signupForm.addEventListener('submit', async e => {
    e.preventDefault();
    hideMessage();

    const role = document.querySelector('input[name="userRole"]:checked').value;
    const isVendeur = role === 'vendeur';
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;

    if (computePasswordScore(password) < 3) {
      showMessage('Mot de passe trop faible : utilisez au moins 8 caractères avec majuscules, chiffres ou symboles.');
      return;
    }

    if (isVendeur) {
      const nom = document.getElementById('signupNom').value.trim();
      const tel = document.getElementById('signupTel').value.trim();
      if (!nom) { showMessage('Veuillez entrer votre nom.'); return; }
      if (!tel) { showMessage('Veuillez entrer votre téléphone.'); return; }
    }

    const btn = document.getElementById('btnSignup');
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader-2" class="spin"></i><span>Création...</span>';
    lucide.createIcons();

    const { data, error } = await client.auth.signUp({ email, password });

    if (error) {
      showMessage(error.message);
      btn.disabled = false;
      btn.innerHTML = '<span>Créer mon compte</span><i data-lucide="arrow-right"></i>';
      lucide.createIcons();
      return;
    }

    if (data.user) {
      const profileData = {
        id: data.user.id,
        role: role,
        full_name: isVendeur ? document.getElementById('signupNom').value.trim() : null,
        phone: isVendeur ? document.getElementById('signupTel').value.trim() : null,
        city: isVendeur ? document.getElementById('signupVille').value.trim() : null,
        currency: document.getElementById('signupCurrency').value
      };

      const { error: profileError } = await client.from('profiles').upsert(profileData, { onConflict: 'id' });

      if (profileError) {
        // Pas de session active (confirmation email requise) → la policy
        // RLS bloque l'écriture. On garde les infos en local pour les
        // appliquer automatiquement à la première connexion réussie.
        console.warn('Profil pas encore enregistrable (confirmation email en attente) :', profileError.message);
        localStorage.setItem('afima_pending_profile', JSON.stringify(profileData));
      }
    }

    showMessage('Compte créé ! Vérifiez votre boîte mail.', false);
    signupForm.reset();
    pwBar.style.width = '0%';
    pwLabel.textContent = '';
    vendeurFields.classList.add('hidden');
    document.querySelector('input[name="userRole"][value="acheteur"]').checked = true;

    btn.disabled = false;
    btn.innerHTML = '<span>Créer mon compte</span><i data-lucide="arrow-right"></i>';
    lucide.createIcons();
  });

  // ══ BOUTON SE CONNECTER AVEC GOOGLE ══
  const btnGoogle = document.getElementById('btn-google');

  if (btnGoogle) {
    btnGoogle.addEventListener('click', async () => {
      try {
        btnGoogle.disabled = true;

        const { error } = await client.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: window.location.origin + '/html/profil.html'
          }
        });

        if (error) throw error;
      } catch (err) {
        console.error('Erreur connexion Google :', err.message);
        showMessage('Erreur Google : ' + err.message);
        btnGoogle.disabled = false;
      }
    });
  }
});

// Applique un profil "vendeur" en attente, sauvegardé localement lors
// d'une inscription dont l'écriture avait été bloquée par la RLS
// (session pas encore active à ce moment-là).
async function applyPendingProfileIfAny(client) {
  const raw = localStorage.getItem('afima_pending_profile');
  if (!raw) return;

  try {
    const pending = JSON.parse(raw);
    const { data: { session } } = await client.auth.getSession();
    if (!session || session.user.id !== pending.id) {
      localStorage.removeItem('afima_pending_profile');
      return;
    }
    const { error } = await client.from('profiles').upsert(pending, { onConflict: 'id' });
    if (!error) localStorage.removeItem('afima_pending_profile');
  } catch {
    localStorage.removeItem('afima_pending_profile');
  }
}