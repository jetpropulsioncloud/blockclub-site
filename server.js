import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { doc, getDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const GRID = {  
  columns: 12,
  width: 1120,
  rowHeight: 56,
  gap: 12,
  padding: 14
};

const params = new URLSearchParams(window.location.search);
const serverId = params.get("serverId") || params.get("id");
const previewMode = params.get("preview") === "1";

const els = {
  serverPage: document.getElementById("serverPage"),  
  notFound: document.getElementById("notFound"),
  coverWrap: document.getElementById("coverWrap"),
  spName: document.getElementById("spName"),
  spIp: document.getElementById("spIp"),
  copyIpBtn: document.getElementById("copyIpBtn"),
  spStatusPill: document.getElementById("spStatusPill"),
  spModePill: document.getElementById("spModePill"),
  spViewsPill: document.getElementById("spViewsPill"),
  spPlayersPill: document.getElementById("spPlayersPill"),
  spUpvotesPill: document.getElementById("spUpvotesPill"),
  spTags: document.getElementById("spTags"),
  spDesc: document.getElementById("spDesc"),
  pageCanvas: document.getElementById("pageCanvas")
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function sanitizeHtml(dirty) {
  const t = document.createElement("template");
  t.innerHTML = String(dirty || "");

  const blocked = new Set(["script", "style", "iframe", "object", "embed", "link", "meta"]);
  const walker = document.createTreeWalker(t.content, NodeFilter.SHOW_ELEMENT, null);

  const toRemove = [];
  while (walker.nextNode()) {
    const el = walker.currentNode;

    if (blocked.has(el.tagName.toLowerCase())) {
      toRemove.push(el);
      continue;
    }

    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const val = (attr.value || "").trim();

      if (name.startsWith("on")) el.removeAttribute(attr.name);
      if ((name === "href" || name === "src") && val.toLowerCase().startsWith("javascript:")) {
        el.removeAttribute(attr.name);
      }
    }
  }

  for (const el of toRemove) el.remove();
  return t.innerHTML;
}

function gridToPx(x, y, w, h) {
  const cellW = (GRID.width - GRID.padding * 2 - GRID.gap * (GRID.columns - 1)) / GRID.columns;

  const px = GRID.padding + x * (cellW + GRID.gap);
  const py = GRID.padding + y * (GRID.rowHeight + GRID.gap);
  const pw = cellW * w + GRID.gap * (w - 1);
  const ph = GRID.rowHeight * h + GRID.gap * (h - 1);

  return { px, py, pw, ph };
}

function canvasHeightFromBlocks(blocks, decorations) {
  let maxBottom = 12;

  for (const b of blocks || []) {
    const bottom = (b.y || 0) + (b.h || 1);
    if (bottom > maxBottom) maxBottom = bottom;
  }

  for (const d of decorations || []) {
    const bottom = (d.y || 0) + (d.h || 1);
    if (bottom > maxBottom) maxBottom = bottom;
  }

  return GRID.padding * 2 + maxBottom * (GRID.rowHeight + GRID.gap) + 40;
}

function makeBlockShell() {
  const el = document.createElement("div");
  el.className = "pv-block";

  const body = document.createElement("div");
  body.className = "pv-body";

  el.appendChild(body);
  return { el, body };
}

function renderBlock(b) {
  const { el, body } = makeBlockShell();
  const { px, py, pw, ph } = gridToPx(b.x || 0, b.y || 0, b.w || 1, b.h || 1);

  el.style.left = `${px}px`;
  el.style.top = `${py}px`;
  el.style.width = `${pw}px`;
  el.style.height = `${ph}px`;
  el.style.transform = `rotate(${b.rot || 0}deg)`;

  if (b.type === "text") {
    const box = document.createElement("div");
    box.className = "pv-text";
    box.innerHTML = sanitizeHtml(b.html || "");
    if (b.fontFamily) box.style.fontFamily = b.fontFamily;
    body.appendChild(box);
  }

  if (b.type === "image" || b.type === "banner") {
    const img = document.createElement("div");
    img.className = "pv-image";
    img.style.backgroundImage = `url("${escapeHtml(b.imageUrl || "")}")`;
    body.appendChild(img);
  }

  if (b.type === "vote") {
    const a = document.createElement("a");
    a.className = "pv-vote";
    a.href = String(b.voteUrl || "#");
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = String(b.label || "Vote here");
    body.appendChild(a);
  }

  return el;
}

function renderDecoration(d) {
  const el = document.createElement("div");
  el.className = "pv-deco";
  el.textContent = d.emoji || d.value || "✨";

  const { px, py, pw, ph } = gridToPx(d.x || 0, d.y || 0, d.w || 1, d.h || 1);

  el.style.left = `${px}px`;
  el.style.top = `${py}px`;
  el.style.width = `${pw}px`;
  el.style.height = `${ph}px`;
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";
  el.style.fontSize = `${Math.max(24, Math.min(pw, ph) * 0.75)}px`;
  el.style.transform = `rotate(${d.rot || 0}deg)`;

  return el;
}

function showNotFound(message = "That server could not be found.") {
  if (els.serverPage) els.serverPage.style.display = "none";
  if (els.notFound) {
    els.notFound.hidden = false;
    const p = els.notFound.querySelector("p");
    if (p) p.textContent = message;
  }
}

function showServerPage() {
  if (els.serverPage) els.serverPage.style.display = "";
  if (els.notFound) els.notFound.hidden = true;
}

function wireCopyIp(ip) {
  if (!els.copyIpBtn) return;

  const btn = els.copyIpBtn;
  btn.replaceWith(btn.cloneNode(true));
  els.copyIpBtn = document.getElementById("copyIpBtn");

  els.copyIpBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(ip || "");
      const prev = els.copyIpBtn.textContent;
      els.copyIpBtn.textContent = "Copied";
      setTimeout(() => {
        els.copyIpBtn.textContent = prev;
      }, 900);
    } catch (err) {
      alert("Copy failed. IP: " + (ip || ""));
    }
  });
}

function renderBanner(serverData) {
  if (!els.coverWrap) return;

  const bannerUrl = String(serverData.bannerUrl || serverData.coverUrl || "").trim();
  if (!bannerUrl) {
    els.coverWrap.innerHTML = "";
    return;
  }

  els.coverWrap.innerHTML = `
    <img
      src="${escapeHtml(bannerUrl)}"
      alt="${escapeHtml(serverData.name || "Server banner")}"
      class="server-cover-img"
    />
  `;
}

function renderTags(tags) {
  if (!els.spTags) return;
  const safeTags = Array.isArray(tags) ? tags : [];

  if (!safeTags.length) {
    els.spTags.innerHTML = "";
    return;
  }

  els.spTags.innerHTML = safeTags
    .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
    .join("");
}

function renderPublishedPage(pageData) {
  if (!els.pageCanvas) return;

  const blocks = Array.isArray(pageData.blocks) ? pageData.blocks : [];
  const decorations = Array.isArray(pageData.decorations) ? pageData.decorations : [];

  els.pageCanvas.innerHTML = "";
  els.pageCanvas.style.minHeight = `${canvasHeightFromBlocks(blocks, decorations)}px`;

  for (const b of blocks) {
    els.pageCanvas.appendChild(renderBlock(b));
  }

  for (const d of decorations) {
    els.pageCanvas.appendChild(renderDecoration(d));
  }
}

function renderServer(serverData, pageData) {
  const name = serverData.name || "Untitled Server";
  const ip = serverData.ip || "No IP listed";
  const status = serverData.status || (serverData.isPublished ? "published" : "draft");
  const mode = serverData.mode || "smp";
  const views = Number(serverData.views || 0);
  const upvotes = Number(serverData.upvotes || 0);
  const players =
    typeof serverData.players === "number" ? `${serverData.players} players` : "—";

  document.title = `${name} | BlockClub`;

  if (els.spName) els.spName.textContent = name;
  if (els.spIp) els.spIp.textContent = ip;
  if (els.spStatusPill) els.spStatusPill.textContent = status;
  if (els.spModePill) els.spModePill.textContent = mode;
  if (els.spViewsPill) els.spViewsPill.textContent = `${views.toLocaleString()} views`;
  if (els.spPlayersPill) els.spPlayersPill.textContent = players;
  if (els.spUpvotesPill) els.spUpvotesPill.textContent = `${upvotes.toLocaleString()} upvotes`;
  if (els.spDesc) els.spDesc.textContent = serverData.description || "No description yet.";

  renderBanner(serverData);
  renderTags(serverData.tags);
  renderPublishedPage(pageData);
  wireCopyIp(serverData.ip || "");
}

async function loadServerPage(currentUser) {
  if (!serverId) {
    showNotFound("Missing serverId in the URL.");
    return;
  }

  const serverRef = doc(db, "servers", serverId);
  const pageRef = doc(db, "servers", serverId, "pages", "main");

  const [serverSnap, pageSnap] = await Promise.all([
    getDoc(serverRef),
    getDoc(pageRef)
  ]);

  if (!serverSnap.exists()) {
    showNotFound("That server page does not exist.");
    return;
  }

    const serverData = serverSnap.data() || {};
    const isPublished = !!serverData.isPublished;
    const isOwner = !!currentUser && serverData.ownerUid === currentUser.uid;

    if (!isPublished && !(previewMode && isOwner)) {
      showNotFound("This server page is not published.");
      return;
    }

    const pageData = pageSnap.exists()
      ? pageSnap.data() || {}
      : { blocks: [], decorations: [] };

    if (isPublished && !previewMode) {
      try {
        await updateDoc(serverRef, {
          views: increment(1)
        });
        serverData.views = Number(serverData.views || 0) + 1;
      } catch (err) {
        console.error("Failed to increment views:", err);
      }
    }

    showServerPage();
    renderServer(serverData, pageData);
}

onAuthStateChanged(auth, (user) => {
  loadServerPage(user).catch((err) => {
    console.error(err);
    showNotFound(err.message || "Unknown error while loading the page.");
  });
});