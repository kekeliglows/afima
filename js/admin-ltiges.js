// ── ADMIN : GESTION DES LITIGES ──
// Utilise les globales : supabaseClient, Litiges

let currentUserId = null;
let allLitiges = [];

// ── HAMBURGER ──
const navToggle = document.getElementById("navToggle");
const mobileMenu = document.getElementById("mobileMenu");
navToggle?.addEventListener("click", () => {
  const open = mobileMenu.classList.toggle("hidden") === false;
  navToggle.querySelector(".icon-menu")?.classList.toggle("hidden", open);
  navToggle.querySelector(".icon-close")?.classList.toggle("hidden", !open);
  navToggle.setAttribute("aria-expanded", String(open));
});
document.addEventListener("click", (e) => {
  if (
    mobileMenu &&
    !mobileMenu.classList.contains("hidden") &&
    !navToggle.contains(e.target) &&
    !mobileMenu.contains(e.target)
  ) {
    mobileMenu.classList.add("hidden");
    navToggle.querySelector(".icon-menu")?.classList.remove("hidden");
    navToggle.querySelector(".icon-close")?.classList.add("hidden");
    navToggle.setAttribute("aria-expanded", "false");
  }
});

// ── CHARGER LES LITIGES À TRAITER ──
async function loadLitiges() {
  const container = document.getElementById("admin-litiges-list");
  container.innerHTML = '<div class="cmd-skeleton"><div class="skeleton-cmd"></div></div>';

  try {
    const { data, error } = await supabaseClient
      .from("litiges")
      .select(`
        *,
        commande_items (titre, prix_unitaire, quantite, image_url),
        commandes (total, created_at),
        acheteur:profiles!litiges_acheteur_id_fkey (full_name, phone),
        vendeur:profiles!litiges_vendeur_id_fkey (full_name, phone)
      `)
      .in("statut", ["ouvert", "en_attente"])
      .order("created_at", { ascending: false });

    if (error) throw error;

    allLitiges = data || [];
    renderLitiges(allLitiges);
  } catch (err) {
    container.innerHTML = `
      <div class="commandes-empty">
        <p>Erreur : ${escapeHtml(err.message)}</p>
      </div>
    `;
  }
}

// ── RENDRE LES LITIGES ──
function renderLitiges(litiges) {
  const container = document.getElementById("admin-litiges-list");

  if (litiges.length === 0) {
    container.innerHTML = `
      <div class="commandes-empty">
        <p>Aucun litige en attente de traitement.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = litiges.map(l => `
    <div class="commande-card litige-card" data-id="${l.id}">
      <div class="commande-card-header">
        <div>
          <span class="commande-id">Litige #${l.id.slice(0, 8)}</span>
          <span class="commande-statut litige-statut ${Litiges.STATUTS[l.statut]?.css || ""}">
            ${Litiges.STATUTS[l.statut]?.label || l.statut}
          </span>
        </div>
        <span class="commande-date">${new Date(l.created_at).toLocaleDateString("fr-FR")}</span>
      </div>

      <div class="commande-card-body">
        <p><strong>Motif :</strong> ${escapeHtml(l.motif)}</p>
        <p><strong>Description :</strong> ${escapeHtml(l.description || "Aucune")}</p>
        <p><strong>Acheteur :</strong> ${escapeHtml(l.acheteur?.full_name || "Inconnu")}</p>
        <p><strong>Vendeur :</strong> ${escapeHtml(l.vendeur?.full_name || "Inconnu")}</p>
        <p><strong>Produit :</strong> ${escapeHtml(l.commande_items?.titre || "N/A")}</p>
        <p><strong>Montant :</strong> ${l.commandes?.total ? `${l.commandes.total.toLocaleString()} FCFA` : "N/A"}</p>
      </div>

      <div class="litige-actions">
        <button class="btn btn-primary btn-sm" onclick="deciderLitige('${l.id}', 'clos', 'acheteur')">
          <i data-lucide="check"></i> Donner raison à l'acheteur
        </button>
        <button class="btn btn-primary btn-sm" onclick="deciderLitige('${l.id}', 'clos', 'vendeur')">
          <i data-lucide="check"></i> Donner raison au vendeur
        </button>
        <button class="btn btn-outline btn-sm" onclick="voirPreuves('${l.id}')">
          <i data-lucide="file-text"></i> Voir les preuves
        </button>
      </div>
    </div>
  `).join("");

  lucide.createIcons();
}

// ── DÉCIDER DU LITIGE ──
window.deciderLitige = async function(litigeId, statut, gagnant) {
  if (!confirm(`Confirmer la décision : donner raison au ${gagnant} ?`)) return;

  try {
    const { error } = await supabaseClient
      .from("litiges")
      .update({
        statut: statut,
        decision: gagnant,
        resolved_by: currentUserId,
        resolved_at: new Date().toISOString()
      })
      .eq("id", litigeId);

    if (error) throw error;

    alert("Décision enregistrée avec succès.");
    loadLitiges();
  } catch (err) {
    alert("Erreur : " + err.message);
  }
};

// ── VOIR LES PREUVES ──
window.voirPreuves = async function(litigeId) {
  const preuves = await Litiges.getPreuvesLitige({ supabaseClient, litigeId });
  if (preuves.length === 0) {
    alert("Aucune preuve pour ce litige.");
    return;
  }

  const html = preuves.map(p => `
    <div class="preuve-item">
      <a href="${p.file_path}" target="_blank">
        <i data-lucide="file"></i> Preuve du ${new Date(p.created_at).toLocaleString("fr-FR")}
      </a>
    </div>
  `).join("");

  // Créer un modal simple
  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal-content">
      <h3>Preuves du litige</h3>
      ${html}
      <button class="btn btn-primary" onclick="this.closest('.modal-overlay').remove()">Fermer</button>
    </div>
  `;
  document.body.appendChild(modal);
  lucide.createIcons();
};

// ── ESCAPE HTML ──
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── INIT ──
async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = "login.html";
    return;
  }
  currentUserId = session.user.id;

  // Vérifier que l'utilisateur est admin
  const { data: profile } = await supabaseClient
    .from("profiles")
    .select("role")
    .eq("id", currentUserId)
    .maybeSingle();

  if (!profile || profile.role !== "admin") {
    document.getElementById("admin-litiges-list").innerHTML = `
      <div class="commandes-empty">
        <p>Accès réservé aux administrateurs.</p>
        <a href="dashboard.html" class="btn btn-primary">Retour au dashboard</a>
      </div>
    `;
    return;
  }

  // Logout
  document.getElementById("btnLogout")?.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    window.location.href = "../index.html";
  });
  document.getElementById("btnLogoutMobile")?.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    window.location.href = "../index.html";
  });

  await loadLitiges();
}

// ── LANCEMENT ──
init();