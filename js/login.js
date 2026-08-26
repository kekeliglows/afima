document.addEventListener('DOMContentLoaded', () => {
  const SUPABASE_URL = 'https://ehkytlouakkfmtfatbmi.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_A-f-SEGhhW25sAulnHLIbA_OvyjQ9Qa';
  const PRODUCTION_URL = 'https://afima-ruby.vercel.app';
  const EMAIL_CONFIRMATION_URL = `${PRODUCTION_URL}/front-end/signup.html?confirmed=1`;
  const RESEND_COOLDOWN_MS = 30 * 1000;
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
    tabLogin?.classList.toggle('active', toLogin);
    tabSignup?.classList.toggle('active', !toLogin);
    indicator?.classList.toggle('right', !toLogin);

    loginForm?.classList.toggle('active', toLogin);
    signupForm?.classList.toggle('active', !toLogin);

    if (subtitle) {
      subtitle.textContent = toLogin
        ? 'Connectez-vous pour continuer sur afima.'
        : 'Créez votre compte gratuitement.';
    }

    if (!toLogin) setLoginVerification(false);
    hideMessage();
  }

  tabLogin?.addEventListener('click',  () => switchTab(true));
  tabSignup?.addEventListener('click', () => switchTab(false));

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
  const authBox = document.querySelector('.auth-box');
  const confirmationPanel = document.getElementById('confirmationPanel');
  const confirmationEmail = document.getElementById('confirmationEmail');
  const loginVerification = document.getElementById('loginVerification');
  const resendButton = document.getElementById('btnResend');
  const loginResendButton = document.getElementById('btnLoginResend');
  const resendCooldown = document.getElementById('resendCooldown');
  let resendEmail = '';
  let resendTimer;

  function friendlyAuthError(error) {
    const message = (error?.message || '').toLowerCase();
    if (message.includes('already registered') || message.includes('already been registered') || message.includes('user already')) {
      return 'Cette adresse e-mail est déjà utilisée. Connectez-vous ou utilisez une autre adresse.';
    }
    if (message.includes('invalid email') || message.includes('email address')) return 'Veuillez saisir une adresse e-mail valide.';
    if (message.includes('password') && (message.includes('weak') || message.includes('short') || message.includes('characters'))) {
      return 'Mot de passe invalide : utilisez au moins 6 caractères, dont un mot de passe suffisamment complexe.';
    }
    if (message.includes('network') || message.includes('fetch')) return 'La connexion au service est impossible. Vérifiez votre réseau puis réessayez.';
    if (message.includes('rate limit')) return 'Trop de demandes. Patientez quelques instants avant de réessayer.';
    if (message.includes('expired') || message.includes('invalid') && message.includes('token')) return 'Ce lien de confirmation est invalide ou a expiré. Demandez un nouvel e-mail.';
    return 'Une erreur est survenue. Veuillez réessayer dans quelques instants.';
  }

  function showMessage(text, isError = true) {
    messageBox.innerHTML = `<i data-lucide="${isError ? 'alert-circle' : 'check-circle'}"></i> ${escapeHtml(text)}`;
    messageBox.className = `message-box ${isError ? 'error' : 'success'}`;
    lucide.createIcons();
  }

  function hideMessage() {
    messageBox.className = 'message-box hidden';
  }

  function setLoginVerification(visible) {
    loginVerification?.classList.toggle('hidden', !visible);
  }

  function getResendCooldownKey(email) {
    return `afima_confirmation_resend_after_${email.toLowerCase()}`;
  }

  function startResendCooldown(until = Date.now() + RESEND_COOLDOWN_MS) {
    if (resendEmail) localStorage.setItem(getResendCooldownKey(resendEmail), String(until));
    [resendButton, loginResendButton].forEach(button => { if (button) button.disabled = true; });
    clearInterval(resendTimer);
    const update = () => {
      const remaining = Math.ceil((until - Date.now()) / 1000);
      if (resendCooldown) resendCooldown.textContent = `Vous pourrez renvoyer l'e-mail dans ${remaining}s.`;
      if (remaining <= 0) {
        clearInterval(resendTimer);
        [resendButton, loginResendButton].forEach(button => { if (button) button.disabled = false; });
        if (resendCooldown) resendCooldown.textContent = '';
        if (resendEmail) localStorage.removeItem(getResendCooldownKey(resendEmail));
      }
    };
    update();
    resendTimer = setInterval(update, 1000);
  }

  async function resendConfirmation() {
    if (!resendEmail) return;
    [resendButton, loginResendButton].forEach(button => { if (button) button.disabled = true; });
    let result;
    try {
      result = await client.auth.resend({
        type: 'signup',
        email: resendEmail,
        options: { emailRedirectTo: EMAIL_CONFIRMATION_URL }
      });
    } catch (error) {
      showMessage(friendlyAuthError(error));
      [resendButton, loginResendButton].forEach(button => { if (button) button.disabled = false; });
      return;
    }
    const { error } = result;
    if (error) {
      showMessage(error.message.toLowerCase().includes('confirmed')
        ? 'Cette adresse e-mail est déjà confirmée. Vous pouvez vous connecter.'
        : friendlyAuthError(error));
      [resendButton, loginResendButton].forEach(button => { if (button) button.disabled = false; });
      return;
    }
    showMessage('Un nouvel e-mail de confirmation vient d’être envoyé.', false);
    startResendCooldown();
  }

  function showConfirmationScreen(email) {
    resendEmail = email;
    confirmationEmail.textContent = email;
    confirmationPanel.classList.remove('hidden');
    authBox.classList.add('confirmation-mode');
    hideMessage();
    const resendAfter = Number(localStorage.getItem(getResendCooldownKey(email)));
    if (resendAfter > Date.now()) startResendCooldown(resendAfter);
    else startResendCooldown();
    lucide.createIcons();
  }

  resendButton?.addEventListener('click', resendConfirmation);
  loginResendButton?.addEventListener('click', resendConfirmation);
  document.getElementById('btnEditEmail')?.addEventListener('click', () => {
    authBox.classList.remove('confirmation-mode');
    confirmationPanel.classList.add('hidden');
    switchTab(false);
    document.getElementById('signupEmail').focus();
  });

  // ── CONNEXION ──
  loginForm?.addEventListener('submit', async e => {
    e.preventDefault();
    hideMessage();
    const btn = document.getElementById('btnLogin');
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader-2" class="spin"></i><span>Connexion...</span>';
    lucide.createIcons();

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!email || !document.getElementById('loginEmail').validity.valid) {
      showMessage('Veuillez saisir une adresse e-mail valide.');
      btn.disabled = false;
      btn.innerHTML = '<span>Se connecter</span><i data-lucide="arrow-right"></i>';
      lucide.createIcons();
      return;
    }

    let result;
    try {
      result = await client.auth.signInWithPassword({ email, password });
    } catch (error) {
      showMessage(friendlyAuthError(error));
      btn.disabled = false;
      btn.innerHTML = '<span>Se connecter</span><i data-lucide="arrow-right"></i>';
      lucide.createIcons();
      return;
    }
    const { error } = result;

    if (error) {
      const notConfirmed = error.code === 'email_not_confirmed' || error.message.toLowerCase().includes('email not confirmed');
      showMessage(notConfirmed
        ? 'Votre adresse e-mail n\'est pas encore confirmée.'
        : friendlyAuthError(error));
      setLoginVerification(notConfirmed);
      if (notConfirmed) {
        resendEmail = email;
        const resendAfter = Number(localStorage.getItem(getResendCooldownKey(email)));
        if (resendAfter > Date.now()) startResendCooldown(resendAfter);
      }
      btn.disabled = false;
      btn.innerHTML = '<span>Se connecter</span><i data-lucide="arrow-right"></i>';
      lucide.createIcons();
    } else {
      setLoginVerification(false);
      // Si un rôle "vendeur" avait été choisi lors d'une inscription
      // précédente mais n'avait pas pu être sauvegardé (email pas encore
      // confirmé à ce moment-là), on l'applique maintenant.
      await applyPendingProfileIfAny(client);

      showMessage('Connexion réussie ! Redirection...', false);
      setTimeout(() => window.location.href = 'catalogue.html', 900);
    }
  });

  // ── INSCRIPTION ──
  signupForm?.addEventListener('submit', async e => {
    e.preventDefault();
    hideMessage();

    const role = document.querySelector('input[name="userRole"]:checked').value;
    const isVendeur = role === 'vendeur';
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const passwordConfirmation = document.getElementById('signupPasswordConfirm').value;
    const acceptedTerms = document.getElementById('signupTerms').checked;

    if (!email || !document.getElementById('signupEmail').validity.valid) {
      showMessage('Veuillez saisir une adresse e-mail valide.');
      return;
    }

    if (password !== passwordConfirmation) {
      showMessage('Les deux mots de passe ne correspondent pas.');
      document.getElementById('signupPasswordConfirm').focus();
      return;
    }

    if (!acceptedTerms) {
      showMessage('Vous devez accepter les Conditions d’utilisation et la Politique de confidentialité pour créer votre compte.');
      document.getElementById('signupTerms').focus();
      return;
    }

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

    let result;
    try {
      result = await client.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: EMAIL_CONFIRMATION_URL }
      });
    } catch (error) {
      showMessage(friendlyAuthError(error));
      btn.disabled = false;
      btn.innerHTML = '<span>Créer mon compte</span><i data-lucide="arrow-right"></i>';
      lucide.createIcons();
      return;
    }
    const { data, error } = result;

    if (error) {
      showMessage(friendlyAuthError(error));
      btn.disabled = false;
      btn.innerHTML = '<span>Créer mon compte</span><i data-lucide="arrow-right"></i>';
      lucide.createIcons();
      return;
    }

    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      showMessage('Cette adresse e-mail est déjà utilisée. Connectez-vous ou utilisez une autre adresse.');
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

    if (data.session) {
      showMessage('Compte créé ! Redirection...', false);
      setTimeout(() => window.location.href = 'catalogue.html', 900);
    } else {
      showConfirmationScreen(email);
    }

    btn.disabled = false;
    btn.innerHTML = '<span>Créer mon compte</span><i data-lucide="arrow-right"></i>';
    lucide.createIcons();
  });

  (async () => {
    const { data: { session } } = await client.auth.getSession();
    const params = new URLSearchParams(window.location.search);
    if (session && params.get('confirmed') === '1') {
      await applyPendingProfileIfAny(client);
      showMessage('Votre adresse e-mail est confirmée ! Redirection...', false);
      setTimeout(() => window.location.href = 'dashboard.html', 1200);
    }
  })().catch(error => console.warn('Retour de confirmation indisponible :', error));

  // ══ BOUTON SE CONNECTER AVEC GOOGLE ══
  const btnGoogle = document.getElementById('btn-google');

  if (btnGoogle) {
    btnGoogle.addEventListener('click', async () => {
      try {
        btnGoogle.disabled = true;

        const { error } = await client.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: window.location.origin + '/front-end/profil.html'
          }
        });

        if (error) throw error;
    } catch (err) {
      console.error('Erreur connexion Google :', err.message);
        showMessage('La connexion avec Google a échoué. Vérifiez votre connexion puis réessayez.');
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
