const params = new URLSearchParams(window.location.search);
const serverId = params.get("serverId");
const isDraft = params.get("draft") === "1";
const previewCanvasW = Number(params.get("canvasW") || 0);
const previewCanvasH = Number(params.get("canvasH") || 0);
function getDraftKey(serverId) {
  return serverId ? `bc_builder_state_${serverId}` : "bc_builder_state_v1";
}
const GRID = {
  columns: 120,
  rows: 160,
  width: 1360,
  gap: 1,
  padding: 16
};
const canvas = document.getElementById("canvas");
const note = document.getElementById("note");
const previewPageTabs = document.getElementById("previewPageTabs");
const previewStage = document.querySelector(".preview-stage");

let activePreviewPageId = "home";

if (previewStage && previewCanvasW > 0) {
  previewStage.style.width = `${previewCanvasW}px`;
  previewStage.style.maxWidth = "calc(100vw - 60px)";
}

if (canvas && previewCanvasH > 0) {
  canvas.style.minHeight = `${previewCanvasH}px`;
}
const closeBtn = document.getElementById("closeBtn");
if (closeBtn) closeBtn.addEventListener("click", () => window.close());
let liveState = null;


async function loadDraftFromFirestore(serverId) {
  if (!window.bcDb) return null;

  const firestore = await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js");
  const { doc, getDoc } = firestore;

  const draftRef = doc(window.bcDb, "servers", serverId, "drafts", "main");
  const snap = await getDoc(draftRef);

  if (!snap.exists()) return null;

  return snap.data();
}
function gridToPx(x, y, w, h) {
  const rect = canvas.getBoundingClientRect();

  const cols = GRID.columns;
  const rows = GRID.rows;
  const padding = GRID.padding;
  const gap = GRID.gap;

  const usableWidth = rect.width - padding * 2 - gap * (cols - 1);
  const usableHeight = rect.height - padding * 2 - gap * (rows - 1);

  const colW = Math.max(1, usableWidth / cols);
  const rowH = Math.max(1, usableHeight / rows);

  return {
    left: padding + x * (colW + gap),
    top: padding + y * (rowH + gap),
    width: w * colW + gap * (w - 1),
    height: h * rowH + gap * (h - 1)
  };
}
function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizePreviewPages(stateToUse = {}) {
  const rawPages = Array.isArray(stateToUse.pages) ? stateToUse.pages : [];

  if (rawPages.length) {
    return rawPages.map((page, index) => ({
      id: String(page.id || (index === 0 ? "home" : `page_${index + 1}`)),
      title: String(page.title || (index === 0 ? "Home" : `Page ${index + 1}`)),
      blocks: Array.isArray(page.blocks) ? page.blocks : [],
      decorations: Array.isArray(page.decorations) ? page.decorations : [],
      canvasBackgroundUrl: String(page.canvasBackgroundUrl || stateToUse?.meta?.canvasBackgroundUrl || "").trim(),
      shellBackgroundUrl: String(page.shellBackgroundUrl || stateToUse?.meta?.shellBackgroundUrl || "").trim(),
      pageBackgroundUrl: String(page.pageBackgroundUrl || stateToUse?.meta?.pageBackgroundUrl || "").trim()
    }));
  }

  return [
    {
      id: "home",
      title: "Home",
      blocks: Array.isArray(stateToUse.blocks) ? stateToUse.blocks : [],
      decorations: Array.isArray(stateToUse.decorations) ? stateToUse.decorations : []
    }
  ];
}

function renderPreviewPageTabs(stateToUse, pages) {
  if (!previewPageTabs) return;

  if (!Array.isArray(pages) || pages.length <= 1) {
    previewPageTabs.innerHTML = "";
    previewPageTabs.style.display = "none";
    return;
  }

  previewPageTabs.style.display = "";

  previewPageTabs.innerHTML = pages
    .map((page) => {
      const isActive = page.id === activePreviewPageId;

      return `
        <button
          class="preview-page-tab ${isActive ? "active" : ""}"
          type="button"
          data-preview-page-id="${escapeHtml(page.id)}"
        >
          ${escapeHtml(page.title || "Page")}
        </button>
      `;
    })
    .join("");

  previewPageTabs.querySelectorAll("[data-preview-page-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const nextPageId = btn.getAttribute("data-preview-page-id");

      if (!nextPageId || nextPageId === activePreviewPageId) {
        return;
      }

      activePreviewPageId = nextPageId;
      render();
    });
  });
}
function safeParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
function clearBackgroundStyles(el) {
  if (!el) return;
  el.style.backgroundImage = "";
  el.style.backgroundSize = "";
  el.style.backgroundPosition = "";
  el.style.backgroundRepeat = "";
  el.style.backgroundColor = "";
}

function applyBackgroundStyles(el, bg, overlay = "rgba(255,255,255,0.18)") {
  if (!el || !bg) return;
  el.style.backgroundImage = `linear-gradient(${overlay}, ${overlay}), url('${bg}')`;
  el.style.backgroundSize = "cover";
  el.style.backgroundPosition = "center";
  el.style.backgroundRepeat = "no-repeat";
  el.style.backgroundColor = "#dfe4ee";
}

function getPreviewShellTarget() {
  return (
    document.querySelector(".preview-stage") ||
    canvas?.parentElement ||
    null
  );
}

function applyPreviewBackgrounds(stateToUse, activePage = null) {
  const shell = getPreviewShellTarget();
  const page = document.body;

  clearBackgroundStyles(canvas);
  if (shell && shell !== canvas) clearBackgroundStyles(shell);
  clearBackgroundStyles(page);

  const canvasBg = String(activePage?.canvasBackgroundUrl || stateToUse?.meta?.canvasBackgroundUrl || "").trim();
  const shellBg = String(activePage?.shellBackgroundUrl || stateToUse?.meta?.shellBackgroundUrl || "").trim();
  const pageBg = String(activePage?.pageBackgroundUrl || stateToUse?.meta?.pageBackgroundUrl || "").trim();

  if (canvasBg) {
    applyBackgroundStyles(canvas, canvasBg);
  }

  if (shellBg && shell !== canvas) {
    applyBackgroundStyles(shell, shellBg);
  }

  if (pageBg) {
    applyBackgroundStyles(page, pageBg, "rgba(255,255,255,0.08)");
  }
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
      const val = String(attr.value || "").trim().toLowerCase();

      if (name.startsWith("on")) el.removeAttribute(attr.name);

      if ((name === "href" || name === "src") && val.startsWith("javascript:")) {
        el.removeAttribute(attr.name);
      }
    }
  }

  for (const el of toRemove) el.remove();

  return t.innerHTML;
}
async function render() {
  canvas.innerHTML = "";

  let stateToUse = liveState;

  if (!stateToUse && isDraft && serverId) {
    stateToUse = await loadDraftFromFirestore(serverId);
  }

  if (
    !stateToUse ||
    (
      !Array.isArray(stateToUse.pages) &&
      !Array.isArray(stateToUse.blocks) &&
      !Array.isArray(stateToUse.decorations)
    )
  ) {
    note.textContent = "No saved layout found. Go to the editor and click Preview.";
    return;
  }

  applyPreviewBackgrounds(stateToUse);

  const pages = normalizePreviewPages(stateToUse);

  if (!pages.some((page) => page.id === activePreviewPageId)) {
    activePreviewPageId = stateToUse.activePageId || pages[0]?.id || "home";
  }

  const activePage =
    pages.find((page) => page.id === activePreviewPageId) ||
    pages[0] ||
    {
      blocks: [],
      decorations: []
    };

  const blocks = Array.isArray(activePage.blocks) ? activePage.blocks : [];
  const decos = Array.isArray(activePage.decorations) ? activePage.decorations : [];
  applyPreviewBackgrounds(stateToUse, activePage);
  renderPreviewPageTabs(stateToUse, pages);

  note.textContent = `Live preview: ${activePage.title || "Page"} • ${blocks.length} block(s), ${decos.length} decoration(s).`;

  for (const b of blocks) {
    const { left, top, width, height } = gridToPx(b.x || 0, b.y || 0, b.w || 1, b.h || 2);

    const el = document.createElement("div");
    el.className = "pv-block";
    el.style.transformOrigin = "center";
    el.style.transform = `rotate(${b.rot || 0}deg)`;
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.style.width = `${width}px`;
    el.style.height = `${height}px`;

    const body = document.createElement("div");
    body.className = "pv-body";

    if (b.type === "text") {
      const t = document.createElement("div");
      t.className = "pv-text";
      t.style.fontFamily = b.fontFamily || "inherit";
      t.style.textAlign = b.align || "left";
      t.innerHTML = sanitizeHtml(b.html || "");
      body.appendChild(t);
    }

    if (b.type === "image" || b.type === "banner") {
      const img = document.createElement("div");
      img.className = "pv-image";
      const src = String(b.imageUrl || b.dataUrl || "").trim();
      if (src) img.style.backgroundImage = `url('${src}')`;
      body.appendChild(img);
    }

    if (b.type === "vote") {
      const a = document.createElement("a");
      a.className = "pv-vote";
      a.href = (b.voteUrl || "").trim() || "#";
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = b.label || "Vote here";
      body.appendChild(a);
    }

    el.appendChild(body);
    canvas.appendChild(el);
  }

  const rect = canvas.getBoundingClientRect();

  for (const d of decos) {
    if (d.type !== "emoji") continue;

    const el = document.createElement("div");
    el.className = "pv-deco";
    el.textContent = d.value || "✨";

    const x = (d.x || 0) * rect.width;
    const y = (d.y || 0) * rect.height;

    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.fontSize = `${d.size || 54}px`;
    el.style.opacity = `${d.opacity ?? 1}`;
    el.style.transform = `rotate(${d.rot || 0}deg)`;

    canvas.appendChild(el);
  }
}

window.addEventListener("resize", () => render());
window.addEventListener("message", (event) => {
  if (event.origin !== window.location.origin) return;
  if (!event.data || event.data.type !== "BC_PREVIEW_STATE") return;

  liveState = event.data.state;
  render();
});

window.addEventListener("load", () => render());
