
// ======================
// CONSTANTS
// ======================
const API = "https://moodshare-7dd7.onrender.com/api";

const ADMIN_CREDS = {
    id: "admin123",
    email: "admin@moodshare.com",
    password: "admin12345",
};

// Doit correspondre à la variable d'env ADMIN_SECRET sur Render.
// Change cette valeur après avoir configuré la variable sur Render.
const ADMIN_SECRET = "260110080310";

function adminHeaders() {
    return {
        "Content-Type": "application/json",
        "X-Admin-Secret": ADMIN_SECRET,
    };
}

// In-memory state
let allPosts = [];
let allReports = [];
let allStories = [];

// ======================
// LOGIN
// ======================
document.getElementById("attemptlogin").addEventListener(("click"), () => attemptLogin());
function attemptLogin() {
    const id = document.getElementById("login-id").value.trim();
    const em = document.getElementById("login-email").value.trim();
    const pw = document.getElementById("login-password").value;
    const err = document.getElementById("login-error");

    err.classList.remove("show");

    if (
        id === ADMIN_CREDS.id &&
        em === ADMIN_CREDS.email &&
        pw === ADMIN_CREDS.password
    ) {
        sessionStorage.setItem("ms_admin", "1");
        document.getElementById("login-screen").style.display = "none";
        document.getElementById("admin-screen").classList.add("show");
        loadAll();
    } else {
        err.classList.add("show");
    }
}

// Allow Enter key on login
document.addEventListener("keydown", (e) => {
    if (
        e.key === "Enter" &&
        document.getElementById("login-screen").style.display !== "none"
    ) {
        attemptLogin();
    }
});

function doLogout() {
    sessionStorage.removeItem("ms_admin");
    document.getElementById("admin-screen").classList.remove("show");
    document.getElementById("login-screen").style.display = "";
}

// ======================
// NAVIGATION
// ======================
function showPage(name) {
    document
        .querySelectorAll(".page")
        .forEach((p) => p.classList.remove("active"));
    document
        .querySelectorAll(".nav-item")
        .forEach((n) => n.classList.remove("active"));
    document.getElementById("page-" + name).classList.add("active");
    document
        .querySelector(`[data-page="${name}"]`)
        ?.classList.add("active");

    if (name === "posts") renderPosts();
    if (name === "reports") renderReports();
    if (name === "stories") renderStories();
    if (name === "create") bindCreatePreview();
}

// ======================
// DATA LOADING
// ======================
async function loadAll() {
    const sp = document.getElementById("refresh-spinner");
    if (sp) sp.style.display = "inline";

    try {
        const [pRes, sRes] = await Promise.all([
            fetch(`${API}/posts`),
            fetch(`${API}/stories`),
        ]);

        allPosts = await pRes.json();
        allStories = await sRes.json();

        // Reports: endpoint admin sécurisé
        try {
            const rRes = await fetch(`${API}/admin/reports`, {
                headers: adminHeaders(),
                credentials: "include",
            });
            if (rRes.ok) allReports = await rRes.json();
        } catch (_) {
            /* SSE fallback */
        }
    } catch (err) {
        toast("Erreur de connexion à l'API", "error");
    }

    if (sp) sp.style.display = "none";
    updateStats();
    renderDashRecent();
    renderPosts();
    renderReports();
    renderStories();
}

// ======================
// STATS
// ======================
function updateStats() {
    document.getElementById("stat-posts").textContent = allPosts.length;
    document.getElementById("stat-stories").textContent = allStories.length;
    document.getElementById("stat-reports").textContent = allReports.length;
    document.getElementById("stat-ephemeral").textContent = allPosts.filter(
        (p) => p.ephemeral,
    ).length;

    const badge = document.getElementById("reports-badge");
    if (allReports.length > 0) {
        badge.textContent = allReports.length;
        badge.style.display = "inline-block";
    } else {
        badge.style.display = "none";
    }
}

// ======================
// DASHBOARD RECENT
// ======================
function renderDashRecent() {
    const el = document.getElementById("dash-recent");
    const recent = [...allPosts].slice(0, 5);

    if (!recent.length) {
        el.innerHTML = emptyState("Aucun post");
        return;
    }

    el.innerHTML = `
      <table id="post-table">
        <thead><tr>
          <th>Post</th>
          <th>Likes</th>
          <th>Commentaires</th>
          <th>Date</th>
          <th>Type</th>
        </tr></thead>
        <tbody>
          ${recent.map((p) => postRow(p, true)).join("")}
        </tbody>
      </table>`;
    const postTable = document.getElementById('post-table');
    postTable.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showCardMenu(e.pageX, e.pageY);
    });
}

const menu = document.getElementById('cardMenu');
let currentCardIndex = null;

function showCardMenu(x, y, index) {
    currentCardIndex = index;
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.style.display = 'flex';
}

// fermer menu si clic ailleurs
document.addEventListener('click', () => menu.style.display = 'none');

// ======================
// POSTS TABLE
// ======================
function renderPosts() {
    const el = document.getElementById("posts-table");
    const q = (
        document.getElementById("post-search")?.value || ""
    ).toLowerCase();
    const posts = allPosts.filter(
        (p) =>
            !q || p.text?.toLowerCase().includes(q) || p.emoji?.includes(q),
    );

    const ct = document.getElementById("posts-count");
    if (ct)
        ct.textContent = `${posts.length} post${posts.length !== 1 ? "s" : ""}`;

    if (!posts.length) {
        el.innerHTML = emptyState("Aucun post trouvé");
        return;
    }

    el.innerHTML = `
      <table>
        <thead><tr>
          <th>Post</th>
          <th>Likes</th>
          <th>Cmts</th>
          <th>Date</th>
          <th>Type</th>
          <th>Actions</th>
        </tr></thead>
        <tbody>
          ${posts.map((p) => postRow(p, false)).join("")}
        </tbody>
      </table>`;
}

function filterPosts() {
    renderPosts();
}

function postRow(p, minimal) {
    const date = p.createdAt
        ? new Date(p.createdAt).toLocaleDateString("fr-FR")
        : "—";
    const type = p.ephemeral
        ? `<span class="chip chip-ephemeral">⏳ éphémère</span>`
        : `<span class="chip chip-normal">normal</span>`;

    const text = p.text || "";
    const actions = minimal
        ? ""
        : `
      <td>
        <div class="actions-row">
          <button class="btn btn-ghost btn-sm" onclick="openEdit('${p.id}')">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="openDelete('${p.id}')">🗑️</button>
        </div>
      </td>`;

    return `
      <tr>
        <td>
          <div class="post-preview">
            <div class="post-color-dot" style="background:${p.color || "#ccc"}"></div>
            <span class="post-emoji-badge">${p.emoji || ""}</span>
            <span class="post-text-preview" title="${text}">${text || '<em style="color:var(--muted)">Sans texte</em>'}</span>
          </div>
        </td>
        <td><span class="like-badge">❤️ ${p.likes || 0}</span></td>
        <td><span class="date-muted">${(p.comments || []).length}</span></td>
        <td><span class="date-muted">${date}</span></td>
        <td>${type}</td>
        ${actions}
      </tr>`;
}

// ======================
// REPORTS
// ======================
function renderReports() {
    const el = document.getElementById("reports-list");

    if (!allReports.length) {
        el.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">✅</div>
          <p>Aucun signalement pour le moment. Tout est calme !</p>
        </div>`;
        return;
    }

    el.innerHTML = allReports
        .map((r) => {
            const post = allPosts.find((p) => p.id == r.postId);
            const postText = post
                ? post.text || "[sans texte]"
                : "Post introuvable";
            const date = r.createdAt
                ? new Date(r.createdAt).toLocaleString("fr-FR")
                : "—";

            return `
        <div class="report-card" id="report-${r.id}">
          <div class="report-meta">
            <strong>🚨 Signalement #${r.id}</strong>
            <span>·</span>
            <span>par <strong>${r.reporter?.username || "inconnu"}</strong></span>
            <span>·</span>
            <span>${date}</span>
            ${r.commentId ? `<span class="chip chip-reported">commentaire</span>` : `<span class="chip chip-reported">post</span>`}
          </div>
          <div class="report-reason">
            <strong>Raison :</strong> ${r.reason || "Aucune raison fournie."}
          </div>
          <div style="font-size:12px;color:var(--muted);margin-bottom:12px;">
            Post concerné : <em>"${postText.slice(0, 80)}${postText.length > 80 ? "…" : ""}"</em>
          </div>
          <div class="report-actions">
            <button class="btn btn-danger btn-sm" onclick="forceDeleteFromReport('${r.postId}', '${r.id}')">🗑️ Supprimer le post</button>
            <button class="btn btn-ghost btn-sm" onclick="dismissReport('${r.id}')">✅ Ignorer</button>
          </div>
        </div>`;
        })
        .join("");
}

async function dismissReport(rid) {
    try {
        await fetch(`${API}/admin/reports/${rid}`, {
            method: "DELETE",
            headers: adminHeaders(),
            credentials: "include",
        });
    } catch (_) {
        /* si réseau down, on retire quand même localement */
    }

    allReports = allReports.filter((r) => r.id != rid);
    updateStats();
    renderReports();
    toast("Signalement supprimé ✅", "info");
}

async function forceDeleteFromReport(postId, reportId) {
    await deletePost(postId);
    dismissReport(reportId);
}

// ======================
// STORIES
// ======================
function renderStories() {
    const el = document.getElementById("stories-table");
    if (!allStories.length) {
        el.innerHTML = emptyState("Aucune story active");
        return;
    }
    el.innerHTML = `
      <div class="table-wrapper">
        <table>
          <thead><tr>
            <th>Story</th>
            <th>Créée le</th>
            <th>Expire le</th>
          </tr></thead>
          <tbody>
            ${allStories
            .map((s) => {
                const created = s.createdAt
                    ? new Date(s.createdAt).toLocaleString("fr-FR")
                    : "—";
                const expires = s.expiresAt
                    ? new Date(s.expiresAt).toLocaleString("fr-FR")
                    : "Permanente";
                return `<tr>
                <td>
                  <div class="post-preview">
                    <div class="post-color-dot" style="background:${s.color || "#ccc"}"></div>
                    <span class="post-emoji-badge">${s.emoji || ""}</span>
                    <span class="post-text-preview">${s.text || ""}</span>
                  </div>
                </td>
                <td><span class="date-muted">${created}</span></td>
                <td><span class="date-muted ${s.expiresAt ? "warn" : ""}">${expires}</span></td>
              </tr>`;
            })
            .join("")}
          </tbody>
        </table>
      </div>`;
}

// ======================
// EDIT POST
// ======================
function openEdit(id) {
    const post = allPosts.find((p) => p.id == id);
    if (!post) return toast("Post introuvable", "error");

    document.getElementById("edit-post-id").value = id;
    document.getElementById("edit-text").value = post.text || "";
    document.getElementById("edit-emoji").value = post.emoji || "";
    document.getElementById("edit-color").value =
        post.color && post.color.startsWith("#") ? post.color : "#ffffff";
    document.getElementById("edit-textcolor").value =
        post.textColor && post.textColor.startsWith("#")
            ? post.textColor
            : "#000000";
    openModal("edit-modal");
}

async function saveEdit() {
    const id = document.getElementById("edit-post-id").value;
    const text = document.getElementById("edit-text").value.trim();
    const emoji = document.getElementById("edit-emoji").value.trim();
    const color = document.getElementById("edit-color").value;
    const textColor = document.getElementById("edit-textcolor").value;

    try {
        const res = await fetch(`${API}/admin/posts/${id}`, {
            method: "PUT",
            headers: adminHeaders(),
            credentials: "include",
            body: JSON.stringify({ text, emoji, color, textColor }),
        });

        if (res.ok) {
            const updated = await res.json();
            const idx = allPosts.findIndex((p) => p.id == id);
            if (idx !== -1) allPosts[idx] = { ...allPosts[idx], ...updated };
            toast("Post modifié avec succès ✏️", "success");
            closeModal("edit-modal");
            renderPosts();
            renderDashRecent();
        } else {
            const err = await res.json().catch(() => ({}));
            toast(`Erreur : ${err.error || res.status}`, "error");
        }
    } catch (err) {
        toast("Erreur réseau lors de la modification", "error");
    }
}

// ======================
// DELETE POST
// ======================
function openDelete(id) {
    document.getElementById("delete-post-id").value = id;
    openModal("delete-modal");
}

async function confirmDelete() {
    const id = document.getElementById("delete-post-id").value;
    await deletePost(id);
    closeModal("delete-modal");
}

async function deletePost(id) {
    try {
        const res = await fetch(`${API}/admin/posts/${id}`, {
            method: "DELETE",
            headers: adminHeaders(),
            credentials: "include",
        });

        if (res.ok) {
            allPosts = allPosts.filter((p) => p.id != id);
            toast("Post supprimé définitivement 🗑️", "success");
        } else {
            const err = await res.json().catch(() => ({}));
            toast(`Erreur suppression : ${err.error || res.status}`, "error");
            return; // ne pas retirer localement si le serveur a refusé
        }
    } catch (_) {
        toast("Erreur réseau — suppression impossible", "error");
        return;
    }

    updateStats();
    renderPosts();
    renderDashRecent();
}

// ======================
// CREATE POST
// ======================
function bindCreatePreview() {
    const text = document.getElementById("create-text");
    const emoji = document.getElementById("create-emoji");
    const color = document.getElementById("create-color");
    const tc = document.getElementById("create-textcolor");

    const update = () => {
        const bubble = document.getElementById("create-preview");
        bubble.style.background = color.value;
        bubble.style.color = tc.value;
        document.getElementById("prev-emoji").textContent =
            emoji.value || "😊";
        document.getElementById("prev-text").textContent =
            text.value || "Texte du post…";
    };

    text.addEventListener("input", update);
    emoji.addEventListener("input", update);
    color.addEventListener("input", update);
    tc.addEventListener("input", update);
    update();
}

async function adminCreatePost() {
    const text = document.getElementById("create-text").value.trim();
    const emoji = document.getElementById("create-emoji").value.trim();
    const color = document.getElementById("create-color").value;
    const textColor = document.getElementById("create-textcolor").value;

    if (!text && !emoji)
        return toast("Le post ne peut pas être vide", "error");

    // Body strict — on n'envoie que les champs remplis pour eviter
    // que le serveur rejette a cause d'un emoji vide ou undefined
    const body = {
        color,
        textColor,
        ephemeral: false,
        likes: 0,
        comments: [],
    };
    if (text) body.text = text;
    if (emoji) body.emoji = emoji;

    try {
        const res = await fetch(`${API}/posts`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(body),
        });

        if (res.ok) {
            const newPost = await res.json();
            allPosts.unshift(newPost);
            toast("Post publié ! ✅", "success");
            document.getElementById("create-text").value = "";
            document.getElementById("create-emoji").value = "";
            showPage("posts");
            updateStats();
            renderDashRecent();
        } else {
            const errData = await res.json().catch(() => ({}));
            toast(
                "Erreur publication : " + (errData.error || res.status),
                "error",
            );
        }
    } catch (err) {
        toast("Erreur réseau : " + err.message, "error");
    }
}

// ======================
// MODAL HELPERS
// ======================
function openModal(id) {
    document.getElementById(id).classList.add("show");
}
function closeModal(id) {
    document.getElementById(id).classList.remove("show");
}

document.querySelectorAll(".modal-overlay").forEach((o) => {
    o.addEventListener("click", (e) => {
        if (e.target === o) o.classList.remove("show");
    });
});

// ======================
// TOAST
// ======================
function toast(msg, type = "info") {
    const c = document.getElementById("toast-container");
    const t = document.createElement("div");
    t.className = `toast ${type}`;
    t.innerHTML = `<div class="toast-dot"></div><span>${msg}</span>`;
    c.appendChild(t);
    setTimeout(() => {
        t.style.opacity = "0";
        t.style.transform = "translateX(20px)";
        t.style.transition = "all .3s";
        setTimeout(() => t.remove(), 300);
    }, 3500);
}

// ======================
// EMPTY STATE
// ======================
function emptyState(msg) {
    return `<div class="empty-state"><div class="empty-state-icon">📭</div><p>${msg}</p></div>`;
}

// ======================
// SSE: listen for reports in real time
// ======================
const es = new EventSource(`${API}/stream`);
es.addEventListener("report", (e) => {
    try {
        const report = JSON.parse(e.data);
        if (!allReports.find((r) => r.id === report.id)) {
            allReports.unshift(report);
            updateStats();
            renderReports();
            toast("🚨 Nouveau signalement reçu !", "error");
        }
    } catch (_) { }
});

// ======================
// SESSION RESTORE
// ======================
if (sessionStorage.getItem("ms_admin") === "1") {
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("admin-screen").classList.add("show");
    loadAll();
}

// ======================
// PINNED POSTS (ANNONCES)
// ======================
let allPinned = [];

async function loadPinned() {
    try {
        const res = await fetch(`${API}/admin/posts/pinned`, {
            headers: adminHeaders(),
            credentials: "include",
        });
        if (res.ok) allPinned = await res.json();
    } catch (_) { }
    renderPinned();
}

function renderPinned() {
    const el = document.getElementById("pinned-list");
    if (!el) return;
    if (!allPinned.length) {
        el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📭</div><p>Aucune annonce épinglée. Crée ta première annonce !</p></div>`;
        return;
    }
    el.innerHTML = allPinned
        .map(
            (p) => `
      <div style="background:var(--surface);border:1px solid var(--border);border-left:3px solid var(--warn);border-radius:12px;padding:18px 20px;margin-bottom:12px;animation:fadeUp .2s ease both;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:14px;height:14px;border-radius:4px;background:${p.color || "#f59e0b"};flex-shrink:0;"></div>
            <span style="font-size:20px;">${p.emoji || "📢"}</span>
            <div>
              <div style="font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--warn);margin-bottom:2px;">${p.pinnedLabel || "Annonce"}</div>
              <div style="font-size:13px;font-weight:600;max-width:380px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.text || ""}</div>
            </div>
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-shrink:0;">
            <span style="font-size:11px;color:var(--muted);">${p.createdAt ? new Date(p.createdAt).toLocaleDateString("fr-FR") : "—"}</span>
            <button class="btn btn-danger btn-sm" onclick="deletePinnedPost('${p.id}')">🗑️ Retirer</button>
          </div>
        </div>
      </div>`,
        )
        .join("");
}

function openPinnedModal() {
    document.getElementById("pinned-text").value = "";
    document.getElementById("pinned-emoji").value = "";
    document.getElementById("pinned-color").value = "#f59e0b";
    document.getElementById("pinned-textcolor").value = "#000000";
    document.getElementById("pinned-label").value = "📢 Annonce";
    updatePinnedPreview();
    openModal("pinned-modal");
    [
        "pinned-text",
        "pinned-emoji",
        "pinned-color",
        "pinned-textcolor",
        "pinned-label",
    ].forEach((id) => {
        const el = document.getElementById(id);
        el.oninput = el.onchange = updatePinnedPreview;
    });
}

function updatePinnedPreview() {
    const preview = document.getElementById("pinned-preview");
    const color = document.getElementById("pinned-color").value;
    const tc = document.getElementById("pinned-textcolor").value;
    preview.style.background = color;
    preview.style.color = tc;
    document.getElementById("pinned-prev-label").textContent =
        document.getElementById("pinned-label").value;
    document.getElementById("pinned-prev-emoji").textContent =
        document.getElementById("pinned-emoji").value || "📢";
    document.getElementById("pinned-prev-text").textContent =
        document.getElementById("pinned-text").value || "Texte de l'annonce…";
}

async function createPinnedPost() {
    const text = document.getElementById("pinned-text").value.trim();
    const emoji = document.getElementById("pinned-emoji").value.trim();
    const color = document.getElementById("pinned-color").value;
    const textColor = document.getElementById("pinned-textcolor").value;
    const pinnedLabel = document.getElementById("pinned-label").value;
    if (!text && !emoji)
        return toast("L'annonce ne peut pas être vide", "error");
    try {
        const res = await fetch(`${API}/admin/posts/pinned`, {
            method: "POST",
            headers: adminHeaders(),
            credentials: "include",
            body: JSON.stringify({
                text,
                emoji,
                color,
                textColor,
                pinnedLabel,
            }),
        });
        if (res.ok) {
            const p = await res.json();
            allPinned.unshift(p);
            allPosts.unshift(p);
            closeModal("pinned-modal");
            renderPinned();
            updateStats();
            toast("📌 Annonce épinglée !", "success");
        } else {
            const err = await res.json().catch(() => ({}));
            toast("Erreur : " + (err.error || res.status), "error");
        }
    } catch (e) {
        toast("Erreur réseau : " + e.message, "error");
    }
}

async function deletePinnedPost(id) {
    try {
        const res = await fetch(`${API}/admin/posts/pinned/${id}`, {
            method: "DELETE",
            headers: adminHeaders(),
            credentials: "include",
        });
        if (res.ok) {
            allPinned = allPinned.filter((p) => p.id !== id);
            allPosts = allPosts.filter((p) => p.id !== id);
            renderPinned();
            updateStats();
            toast("Annonce retirée 🗑️", "info");
        } else {
            const err = await res.json().catch(() => ({}));
            toast("Erreur : " + (err.error || res.status), "error");
        }
    } catch (e) {
        toast("Erreur réseau", "error");
    }
}

// Patch showPage to handle pinned page
const _origShowPage = showPage;
showPage = function (name) {
    _origShowPage(name);
    if (name === "pinned") loadPinned();
};
