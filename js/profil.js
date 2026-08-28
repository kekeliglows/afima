// ============================================================
// PROFIL UTILISATEUR — LOGIQUE PRINCIPALE
// ============================================================
// Dépendances attendues dans profil.html :
// - supabase.js
// - verification.js
// - Lucide
// ============================================================

// ============================================================
// CLIENT SUPABASE
// ============================================================

const profileSupabaseClient =
  window.supabaseClient ||
  (typeof supabaseClient !== "undefined" ? supabaseClient : null);

// ============================================================
// MODULE VERIFICATION (fallback sécurisé)
// ============================================================

const VerificationAPI =
  window.Verification ||
  (typeof Verification !== "undefined" ? Verification : null) || {
    TYPES: {},
    STATUTS: {
      en_attente: { label: "En attente", css: "verif-en-attente" },
      approuve: { label: "Vérifié", css: "verif-approuve" },
      rejete: { label: "Rejeté", css: "verif-rejete" },
    },
    getMaVerification: async () => null,
    submitVerification: async () => {
      throw new Error("Verification non disponible");
    },
    getDocumentUrl: async () => null,
    isAdmin: async () => false,
    getVerificationsEnAttente: async () => [],
    decideVerification: async () => {},
  };

// ============================================================
// CONFIGURATION
// ============================================================

const AVATAR_BUCKET = "avatars";
const ALLOWED_AVATAR_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];
const MAX_AVATAR_SIZE = 5 * 1024 * 1024;

// ============================================================
// ÉTAT GLOBAL
// ============================================================

let currentUserId = null;
let currentProfile = null;
let editMode = false;
let originalProfileValues = {
  full_name: "",
  phone: "",
  city: "",
  currency: "EUR",
  bio: "",
};

// ============================================================
// INITIALISATION
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  initHamburger();
  initProfile();
});

// ============================================================
// INITIALISER LE PROFIL
// ============================================================

async function initProfile() {
  if (!profileSupabaseClient) {
    console.error("Supabase n'est pas disponible.");
    showMsg("Connexion à la base de données impossible.", "error");
    return;
  }

  try {
    await applyPendingProfileIfAny();

    const { data: { session }, error } =
      await profileSupabaseClient.auth.getSession();
    if (error) throw error;

    if (!session || !session.user) {
      window.location.href = "login.html";
      return;
    }

    currentUserId = session.user.id;

    initProfileEvents();
    initVendeurModal();

    await loadProfile(session.user);
    await loadProductCount(currentUserId);

    setEditMode(false);
    refreshLucideIcons();
  } catch (error) {
    console.error("Erreur d'initialisation du profil :", error);
    showMsg(`Impossible de charger le profil : ${error.message || "erreur inconnue"}`, "error");
  }
}

// ============================================================
// INITIALISER LES ÉVÉNEMENTS DU PROFIL
// ============================================================

function initProfileEvents() {
  document.getElementById("btnLogout")?.addEventListener("click", logout);
  document.getElementById("btnLogoutMobile")?.addEventListener("click", logout);
  document.getElementById("btnLogoutDanger")?.addEventListener("click", logout);

  document.getElementById("btnEditProfile")?.addEventListener("click", () => setEditMode(true));
  document.getElementById("btnCancelEdit")?.addEventListener("click", cancelEdit);
  document.getElementById("profilForm")?.addEventListener("submit", saveProfile);
  document.getElementById("avatarFile")?.addEventListener("change", previewAvatar);
}

// ============================================================
// APPLIQUER LE PROFIL EN ATTENTE (depuis login)
// ============================================================

async function applyPendingProfileIfAny() {
  const pending = localStorage.getItem("afima_pending_profile");
  if (!pending) return;

  try {
    const profileData = JSON.parse(pending);
    const { data: { session }, error } = await profileSupabaseClient.auth.getSession();
    if (error || !session?.user) return;

    const emailName = session.user.email?.split("@")[0] || "Utilisateur";
    const { error: upsertError } = await profileSupabaseClient
      .from("profiles")
      .upsert(
        {
          id: session.user.id,
          full_name: profileData.full_name || emailName,
          phone: profileData.phone || null,
          city: profileData.city || null,
          bio: profileData.bio || null,
          avatar_url: profileData.avatar_url || null,
          currency: profileData.currency || "EUR",
          role: profileData.role || "acheteur",
        },
        { onConflict: "id" }
      );

    if (!upsertError) {
      localStorage.removeItem("afima_pending_profile");
    }
  } catch (error) {
    console.warn("Impossible d'appliquer le profil temporaire :", error);
  }
}

// ============================================================
// CHARGER LE PROFIL
// ============================================================

async function loadProfile(sessionUser) {
  const { data: profile, error } = await profileSupabaseClient
    .from("profiles")
    .select("full_name, phone, city, bio, avatar_url, updated_at, role, currency")
    .eq("id", currentUserId)
    .maybeSingle();

  if (error) {
    console.error("Erreur de chargement du profil :", error);
    showMsg("Impossible de charger le profil.", "error");
    return;
  }

  const emailName = sessionUser.email?.split("@")[0] || "Utilisateur";
  currentProfile = profile || {
    full_name: emailName,
    phone: "",
    city: "",
    bio: "",
    avatar_url: null,
    updated_at: sessionUser.created_at || null,
    role: "acheteur",
    currency: "EUR",
  };

  if (!profile) {
    const { error: createError } = await profileSupabaseClient
      .from("profiles")
      .upsert(
        {
          id: currentUserId,
          full_name: currentProfile.full_name,
          phone: null,
          city: null,
          bio: null,
          avatar_url: null,
          currency: "EUR",
          role: "acheteur",
        },
        { onConflict: "id" }
      );
    if (createError) {
      console.error("Erreur de création du profil :", createError);
      showMsg("Impossible de créer votre profil.", "error");
      return;
    }
  }

  saveOriginalProfileValues();
  renderProfile(sessionUser);
  await updateRoleUI(currentProfile.role);
  await updateAdminUI();
}

// ============================================================
// SECTION ADMINISTRATION
// ============================================================

async function updateAdminUI() {
  const adminSection = document.getElementById("adminSection");
  if (!adminSection) return;

  try {
    const admin = await VerificationAPI.isAdmin({
      supabaseClient: profileSupabaseClient,
      userId: currentUserId,
    });
    adminSection.classList.toggle("hidden", !admin);
  } catch (error) {
    console.warn("Impossible de vérifier le statut admin :", error);
    adminSection.classList.add("hidden");
  }
}

// ============================================================
// SAUVEGARDER LES VALEURS ORIGINALES (pour le bouton Annuler)
// ============================================================

function saveOriginalProfileValues() {
  originalProfileValues = {
    full_name: currentProfile?.full_name || "",
    phone: currentProfile?.phone || "",
    city: currentProfile?.city || "",
    currency: currentProfile?.currency || "EUR",
    bio: currentProfile?.bio || "",
  };
}

// ============================================================
// AFFICHER LE PROFIL
// ============================================================

function renderProfile(sessionUser) {
  const displayName = currentProfile?.full_name || sessionUser.email?.split("@")[0] || "Utilisateur";
  setElementText("profilNomDisplay", displayName);
  setElementText("profilEmailDisplay", sessionUser.email || "");
  setElementText("profilBioDisplay", currentProfile?.bio || "Aucune bio renseignée.");

  setElementValue("profilNom", currentProfile?.full_name || "");
  setElementValue("profilTel", currentProfile?.phone || "");
  setElementValue("profilVille", currentProfile?.city || "");
  setElementValue("profilCurrency", currentProfile?.currency || "EUR");
  setElementValue("profilBio", currentProfile?.bio || "");

  const memberDate = currentProfile?.updated_at || sessionUser.created_at;
  setElementText("profilMembre", memberDate ? `Membre depuis ${formatDate(memberDate)}` : "Membre depuis —");
  renderAvatar(currentProfile?.avatar_url);
}

// ============================================================
// MODE ÉDITION
// ============================================================

function setEditMode(enabled) {
  editMode = enabled;
  const fieldIds = ["profilNom", "profilTel", "profilVille", "profilCurrency", "profilBio"];

  fieldIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.disabled = !enabled;
  });

  const avatarFile = document.getElementById("avatarFile");
  if (avatarFile) avatarFile.disabled = !enabled;

  const btnEdit = document.getElementById("btnEditProfile");
  if (btnEdit) btnEdit.classList.toggle("hidden", enabled);

  const actions = document.getElementById("profilFormActions");
  if (actions) actions.classList.toggle("hidden", !enabled);

  const title = document.getElementById("profilEditTitle");
  if (title) title.textContent = enabled ? "Modifier mon profil" : "Mon profil";

  const description = document.getElementById("profilEditDescription");
  if (description)
    description.textContent = enabled
      ? "Modifiez vos informations personnelles."
      : "Consultez vos informations personnelles.";

  const avatarEdit = document.querySelector(".avatar-edit-btn");
  if (avatarEdit) avatarEdit.classList.toggle("hidden", !enabled);
}

// ============================================================
// ANNULER LA MODIFICATION
// ============================================================

function cancelEdit() {
  setElementValue("profilNom", originalProfileValues.full_name);
  setElementValue("profilTel", originalProfileValues.phone);
  setElementValue("profilVille", originalProfileValues.city);
  setElementValue("profilCurrency", originalProfileValues.currency);
  setElementValue("profilBio", originalProfileValues.bio);

  const avatarFile = document.getElementById("avatarFile");
  if (avatarFile) avatarFile.value = "";

  renderAvatar(currentProfile?.avatar_url);
  setEditMode(false);
  hideMsg();
}

// ============================================================
// SAUVEGARDER LE PROFIL
// ============================================================

async function saveProfile(event) {
  event.preventDefault();
  if (!editMode) return;

  if (!profileSupabaseClient || !currentUserId) {
    showMsg("Session utilisateur invalide.", "error");
    return;
  }

  const fullName = getElementValue("profilNom");
  const phone = getElementValue("profilTel");
  const city = getElementValue("profilVille");
  const currency = document.getElementById("profilCurrency")?.value || "EUR";
  const bio = getElementValue("profilBio");
  const file = document.getElementById("avatarFile")?.files?.[0] || null;

  if (file) {
    const avatarError = validateAvatarFile(file);
    if (avatarError) {
      showMsg(avatarError, "error");
      return;
    }
  }

  const submitButton = document.getElementById("profilSubmit");
  if (!submitButton) return;

  const originalButtonHTML = submitButton.innerHTML;
  submitButton.disabled = true;
  submitButton.innerHTML = `<span>Enregistrement...</span>`;

  try {
    const updates = {
      id: currentUserId,
      full_name: fullName || currentProfile?.full_name || "",
      phone: phone || null,
      city: city || null,
      currency,
      bio: bio || null,
      updated_at: new Date().toISOString(),
    };

    // Gestion de l'avatar
    if (file) {
      const oldAvatarPath = getStoragePathFromUrl(currentProfile?.avatar_url);
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const filePath = `${currentUserId}/avatar-${Date.now()}.${extension}`;

      const { error: uploadError } = await profileSupabaseClient.storage
        .from(AVATAR_BUCKET)
        .upload(filePath, file, { upsert: false, contentType: file.type, cacheControl: "3600" });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = profileSupabaseClient.storage
        .from(AVATAR_BUCKET)
        .getPublicUrl(filePath);
      if (!publicUrlData?.publicUrl) {
        throw new Error("Impossible de récupérer l'URL de l'avatar.");
      }
      updates.avatar_url = publicUrlData.publicUrl;

      if (oldAvatarPath && oldAvatarPath !== filePath) {
        await profileSupabaseClient.storage
          .from(AVATAR_BUCKET)
          .remove([oldAvatarPath])
          .catch((err) => console.warn("Ancien avatar non supprimé :", err));
      }
    }

    const { data: savedProfile, error } = await profileSupabaseClient
      .from("profiles")
      .upsert(updates, { onConflict: "id" })
      .select()
      .single();

    if (error) throw error;

    currentProfile = { ...(currentProfile || {}), ...(savedProfile || updates) };
    saveOriginalProfileValues();
    renderProfile({ email: document.getElementById("profilEmailDisplay")?.textContent || "" });
    setEditMode(false);

    const avatarInput = document.getElementById("avatarFile");
    if (avatarInput) avatarInput.value = "";

    localStorage.setItem("afima_currency", currentProfile.currency || "EUR");
    await updateRoleUI(currentProfile.role);
    showMsg("Profil mis à jour avec succès.", "success");
  } catch (error) {
    console.error("Erreur lors de la sauvegarde :", error);
    showMsg(`Erreur : ${error.message || "erreur inconnue"}`, "error");
  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML = originalButtonHTML;
    refreshLucideIcons();
  }
}

// ============================================================
// RÔLE UTILISATEUR
// ============================================================

async function updateRoleUI(role) {
  const roleSection = document.getElementById("roleSection");
  const roleBadge = document.getElementById("profilRoleBadge");
  const btnSeller = document.getElementById("btnDevenirVendeur");
  const verificationStatus = document.getElementById("verificationStatus");

  if (roleSection) roleSection.classList.remove("hidden");

  if (roleBadge) {
    const isSeller = role === "vendeur";
    roleBadge.textContent = isSeller ? "Vendeur" : "Acheteur";
    roleBadge.className = `profil-role-badge ${isSeller ? "vendeur" : "acheteur"}`;
  }

  if (role === "vendeur") {
    if (btnSeller) btnSeller.classList.add("hidden");
    if (verificationStatus) await renderVerificationStatus(verificationStatus);
  } else {
    if (btnSeller) btnSeller.classList.remove("hidden");
    if (verificationStatus) verificationStatus.classList.add("hidden");
  }
}

// ============================================================
// STATUT DE VÉRIFICATION
// ============================================================

async function renderVerificationStatus(container) {
  if (!container) return;

  try {
    const verification = await VerificationAPI.getMaVerification({
      supabaseClient: profileSupabaseClient,
      userId: currentUserId,
    });

    container.classList.remove("hidden");

    if (!verification) {
      container.innerHTML = `<a class="verif-link" href="verification.html">Vérifier mon identité</a>`;
      return;
    }

    const status = VerificationAPI.STATUTS?.[verification.statut] || {
      label: verification.statut || "Statut inconnu",
      css: "",
    };
    const safeLabel = escapeHtml(status.label);
    const safeCss = escapeHtml(status.css || "");

    if (verification.statut === "rejete") {
      container.innerHTML = `
        <span class="verif-badge ${safeCss}">${safeLabel}</span>
        <a class="verif-link" href="verification.html">Voir le motif et resoumettre</a>
      `;
    } else {
      container.innerHTML = `
        <a class="verif-link" href="verification.html">
          <span class="verif-badge ${safeCss}">${safeLabel}</span>
        </a>
      `;
    }
  } catch (error) {
    console.warn("Erreur de récupération du statut de vérification :", error);
    container.classList.remove("hidden");
    container.innerHTML = `<a class="verif-link" href="verification.html">Vérifier mon identité</a>`;
  }
}

// ============================================================
// NOMBRE DE PRODUITS
// ============================================================

async function loadProductCount(userId) {
  if (!userId) return;

  const { count, error } = await profileSupabaseClient
    .from("produits")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) console.error("Erreur comptage produits :", error);
  const total = error || count === null ? 0 : count;
  setElementText("profilNbProduits", `${total} produit(s)`);
}

// ============================================================
// AVATAR
// ============================================================

function renderAvatar(url) {
  const img = document.getElementById("avatarImg");
  const placeholder = document.getElementById("avatarPlaceholder");
  if (!img && !placeholder) return;

  if (url && img) {
    img.src = url;
    img.classList.remove("hidden");
    if (placeholder) placeholder.classList.add("hidden");
  } else {
    if (img) img.classList.add("hidden");
    if (placeholder) placeholder.classList.remove("hidden");
  }
}

function previewAvatar() {
  if (!editMode) return;

  const input = document.getElementById("avatarFile");
  const file = input?.files?.[0];
  if (!file) return;

  const error = validateAvatarFile(file);
  if (error) {
    showMsg(error, "error");
    input.value = "";
    return;
  }

  const img = document.getElementById("avatarImg");
  const placeholder = document.getElementById("avatarPlaceholder");
  if (!img) return;

  if (img.dataset.objectUrl) URL.revokeObjectURL(img.dataset.objectUrl);
  const objectUrl = URL.createObjectURL(file);
  img.dataset.objectUrl = objectUrl;
  img.src = objectUrl;
  img.classList.remove("hidden");
  if (placeholder) placeholder.classList.add("hidden");
}

function validateAvatarFile(file) {
  if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
    return "Format non supporté. Utilisez une image JPG, PNG, WEBP ou GIF.";
  }
  if (file.size > MAX_AVATAR_SIZE) {
    return "Image trop lourde (5 Mo maximum).";
  }
  return null;
}

function getStoragePathFromUrl(url) {
  if (!url) return null;
  try {
    const marker = `/${AVATAR_BUCKET}/`;
    const index = url.indexOf(marker);
    if (index === -1) return null;
    const path = url.slice(index + marker.length);
    return path.split("?")[0];
  } catch (error) {
    console.warn("Impossible d'extraire le chemin Storage :", error);
    return null;
  }
}

// ============================================================
// MODAL DEVENIR VENDEUR
// ============================================================

function initVendeurModal() {
  const modal = document.getElementById("vendeurModal");
  const openButton = document.getElementById("btnDevenirVendeur");
  const closeButton = document.getElementById("closeVendeurModal");
  const form = document.getElementById("vendeurForm");

  if (!modal || !form) return;

  openButton?.addEventListener("click", openVendeurModal);
  closeButton?.addEventListener("click", closeVendeurModal);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeVendeurModal();
  });
  form.addEventListener("submit", submitVendeurForm);
}

function openVendeurModal() {
  const modal = document.getElementById("vendeurModal");
  if (!modal) return;

  setElementValue("vendeurNom", getElementValue("profilNom"));
  setElementValue("vendeurTel", getElementValue("profilTel"));
  setElementValue("vendeurVille", getElementValue("profilVille"));

  modal.classList.remove("hidden");
  refreshLucideIcons();
}

function closeVendeurModal() {
  document.getElementById("vendeurModal")?.classList.add("hidden");
}

async function submitVendeurForm(event) {
  event.preventDefault();

  if (!profileSupabaseClient || !currentUserId) {
    showMsg("Session utilisateur invalide.", "error");
    return;
  }

  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  if (!button) return;

  const originalHTML = button.innerHTML;
  button.disabled = true;
  button.innerHTML = `<span>Enregistrement...</span>`;

  try {
    const fullName = getElementValue("vendeurNom");
    const phone = getElementValue("vendeurTel");
    const city = getElementValue("vendeurVille");

    if (!fullName || !phone) {
      showMsg("Nom et téléphone sont obligatoires pour devenir vendeur.", "error");
      return;
    }

    const updates = {
      id: currentUserId,
      role: "vendeur",
      full_name: fullName,
      phone: phone,
      city: city || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await profileSupabaseClient
      .from("profiles")
      .upsert(updates, { onConflict: "id" })
      .select()
      .single();

    if (error) throw error;

    currentProfile = { ...(currentProfile || {}), ...(data || updates) };
    saveOriginalProfileValues();

    setElementValue("profilNom", currentProfile.full_name);
    setElementValue("profilTel", currentProfile.phone);
    setElementValue("profilVille", currentProfile.city || "");
    setElementText("profilNomDisplay", currentProfile.full_name);

    await updateRoleUI("vendeur");
    closeVendeurModal();
    showMsg("Félicitations ! Vous êtes maintenant vendeur.", "success");
    refreshLucideIcons();
  } catch (error) {
    console.error("Erreur passage vendeur :", error);
    showMsg(`Erreur : ${error.message || "erreur inconnue"}`, "error");
  } finally {
    button.disabled = false;
    button.innerHTML = originalHTML;
  }
}

// ============================================================
// HAMBURGER
// ============================================================

function initHamburger() {
  const toggle = document.getElementById("navToggle");
  const menu = document.getElementById("mobileMenu");
  if (!toggle || !menu) return;

  toggle.addEventListener("click", () => {
    const opened = menu.classList.toggle("hidden") === false;
    toggle.querySelector(".icon-menu")?.classList.toggle("hidden", opened);
    toggle.querySelector(".icon-close")?.classList.toggle("hidden", !opened);
    toggle.setAttribute("aria-expanded", String(opened));
    refreshLucideIcons();
  });

  document.addEventListener("click", (event) => {
    if (menu.classList.contains("hidden")) return;
    if (toggle.contains(event.target) || menu.contains(event.target)) return;
    menu.classList.add("hidden");
    toggle.querySelector(".icon-menu")?.classList.remove("hidden");
    toggle.querySelector(".icon-close")?.classList.add("hidden");
    toggle.setAttribute("aria-expanded", "false");
  });
}

// ============================================================
// DÉCONNEXION
// ============================================================

async function logout() {
  try {
    if (!profileSupabaseClient) throw new Error("Supabase indisponible.");
    const { error } = await profileSupabaseClient.auth.signOut();
    if (error) throw error;
  } catch (error) {
    console.error("Erreur de déconnexion :", error);
  } finally {
    window.location.href = "../index.html";
  }
}

// ============================================================
// MESSAGE
// ============================================================

function showMsg(text, type) {
  const box = document.getElementById("profilMessage");
  if (!box) {
    console[type === "error" ? "error" : "log"](text);
    return;
  }
  box.textContent = text;
  box.className = `profil-msg ${type}`;
  clearTimeout(showMsg.timeout);
  showMsg.timeout = setTimeout(() => {
    box.className = "profil-msg hidden";
  }, 4500);
}

function hideMsg() {
  const box = document.getElementById("profilMessage");
  if (box) box.className = "profil-msg hidden";
}

// ============================================================
// FORMAT DATE
// ============================================================

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

// ============================================================
// UTILITAIRES DOM
// ============================================================

function getElementValue(id) {
  const el = document.getElementById(id);
  return el?.value?.trim() || "";
}

function setElementValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value ?? "";
}

function setElementText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value ?? "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ============================================================
// LUCIDE
// ============================================================

function refreshLucideIcons() {
  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }
}