let fb = null;
async function loadFirebase() {
  if (fb) return fb;

  const firestore = await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js");
  const storage = await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js");
  fb = { firestore, storage };
  return fb;
}
const GRID = {
  columns: 12,
  width: 1360,
  rowHeight: 64,
  gap: 12,
  padding: 16
};
console.log("BUILDER VERSION CHECK - newest file loaded");
const LS_KEY = "bc_builder_state_v1";
const LAST_SERVER_ID_KEY = "bc_last_server_id";
const serverDescriptionInput = document.getElementById("serverDescriptionInput");
const stageServerName = document.getElementById("stageServerName");
const stageServerIp = document.getElementById("stageServerIp");
const stageServerDescription = document.getElementById("stageServerDescription");
const stageTagList = document.getElementById("stageTagList");
const canvas = document.getElementById("canvas");
const blocksLayer = document.getElementById("blocksLayer");
const decoLayer = document.getElementById("decoLayer");
const themeSelect = document.getElementById("themeSelect");
const customThemeControls = document.getElementById("customThemeControls");
const homeBtn = document.getElementById("homeBtn");
const addTextBtn = document.getElementById("addText");
const addImageBtn = document.getElementById("addImage");
const fontSelect = document.getElementById("fontSelect");
const previewBtn = document.getElementById("previewBtn");
const publishBtn = document.getElementById("publishBtn");
const tagDropdownBtn = document.getElementById("tagDropdownBtn");
const tagDropdownMenu = document.getElementById("tagDropdownMenu");
const addCanvasBackgroundBtn = document.getElementById("addCanvasBackgroundBtn");
const removeCanvasBackgroundBtn = document.getElementById("removeCanvasBackgroundBtn");
const canvasBackgroundInput = document.getElementById("canvasBackgroundInput");

const addShellBackgroundBtn = document.getElementById("addShellBackgroundBtn");
const removeShellBackgroundBtn = document.getElementById("removeShellBackgroundBtn");
const shellBackgroundInput = document.getElementById("shellBackgroundInput");

const addPageBackgroundBtn = document.getElementById("addPageBackgroundBtn");
const removePageBackgroundBtn = document.getElementById("removePageBackgroundBtn");
const pageBackgroundInput = document.getElementById("pageBackgroundInput");
const AVAILABLE_TAGS = [
  "Survival",
  "Economy",
  "PvP",
  "McMMO",
  "Ranks",
  "PvE",
  "Community",
  "SMP",
  "Discord",
  "Crates",
  "Vote Rewards",
  "Land Claim",
  "Custom Enchants",
  "Shops",
  "Vanilla",
  "Grief Prevention",
  "Auction House",
  "Vote",
  "Towny",
  "Skyblock",
  "Votifier",
  "Anti-Grief",
  "Creative",
  "Factions",
  "Dynmap"
];
const MAX_SELECTED_TAGS = 5;
const toggleDecoBtn = document.getElementById("toggleDeco");
const addEmojiBtn = document.getElementById("addEmoji");
const emojiInput = document.getElementById("emojiInput");

const exportBtn = document.getElementById("exportBtn");
const resetBtn = document.getElementById("resetBtn");

const exportDialog = document.getElementById("exportDialog");
const exportArea = document.getElementById("exportArea");
const closeExport = document.getElementById("closeExport");
const copyExport = document.getElementById("copyExport");
const MAX_TEXT_BLOCKS = 5;
const MAX_IMAGE_BLOCKS = 5;
const MAX_DECOS = 10;
const params = new URLSearchParams(window.location.search);
const serverIdFromUrl = params.get("serverId");
const voteEnabledInput = document.getElementById("voteEnabledInput");
const voteHostInput = document.getElementById("voteHostInput");
const votePortInput = document.getElementById("votePortInput");
const voteTokenInput = document.getElementById("voteTokenInput");
const saveVotingBtn = document.getElementById("saveVotingBtn");
const generateVoteTokenBtn = document.getElementById("generateVoteTokenBtn");
const copyVoteConfigBtn = document.getElementById("copyVoteConfigBtn");
const voteConfigPreview = document.getElementById("voteConfigPreview");
const testVoteBtn = document.getElementById("testVoteBtn");
const testVoteMsg = document.getElementById("testVoteMsg");


function getDraftKey(serverId) {
  return serverId ? `bc_builder_state_${serverId}` : LS_KEY;
}
function getActiveServerId() {
  const liveParams = new URLSearchParams(window.location.search);
  return liveParams.get("serverId") || localStorage.getItem(LAST_SERVER_ID_KEY);
}
function replaceUrlServerId(serverId) {
  if (!serverId) return;
  const url = new URL(window.location.href);
  url.searchParams.set("serverId", serverId);
  window.history.replaceState({}, "", url.toString());
}
async function waitForAuthUser(timeoutMs = 8000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const auth = window.bcAuth;

    if (auth) {
      if (auth.currentUser) return auth.currentUser;
      await new Promise((resolve) => setTimeout(resolve, 120));
      if (auth.currentUser) return auth.currentUser;
    }

    await new Promise((resolve) => setTimeout(resolve, 120));
  }

  const user = window.bcAuth?.currentUser || null;
  if (!user || user.isAnonymous) return null;
  return user;
}

async function waitForFirebaseReady(timeoutMs = 8000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    if (window.bcDb && window.bcAuth && window.bcStorage) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 120));
  }

  return false;
}
async function loadVotingConfig(serverId) {
  const { firestore } = await loadFirebase();
  const { doc, getDoc } = firestore;

  const db = window.bcDb;

  const configRef = doc(db, "servers", serverId, "private", "config");
  const snap = await getDoc(configRef);

  if (!snap.exists()) {
    voteEnabledInput.checked = false;
    voteHostInput.value = "";
    votePortInput.value = "8192";
    voteTokenInput.value = "";
    buildVoteConfigSnippet();
    return;
  }

  const data = snap.data() || {};

  voteEnabledInput.checked = !!data.votingEnabled;
  voteHostInput.value = data.votifierHost || "";
  votePortInput.value = data.votifierPort || "";
  voteTokenInput.value = data.votifierToken || "";
  buildVoteConfigSnippet();
}
async function saveVotingConfig(serverId) {
  const ownership = await assertServerOwnership(serverId);

  const { firestore } = await loadFirebase();
  const { doc, setDoc } = firestore;

  const db = window.bcDb;
  if (!db) {
    throw new Error("Firebase database is not ready.");
  }

  const enabled = !!voteEnabledInput?.checked;
  const host = String(voteHostInput?.value || "").trim();
  const port = Number(votePortInput?.value || 8192);
  const token = String(voteTokenInput?.value || "").trim();

  const configRef = doc(db, "servers", serverId, "private", "config");

  await setDoc(configRef, {
    votingEnabled: enabled,
    votifierHost: host,
    votifierPort: port,
    votifierToken: token,
    votifierServiceName: "blockclub",
    voteCooldownHours: 24,
    ownerUid: ownership.user.uid
  }, { merge: true });

  const serverRef = doc(db, "servers", serverId);

  await setDoc(serverRef, {
    votingEnabled: enabled
  }, { merge: true });
  buildVoteConfigSnippet();
}
themeSelect?.addEventListener("change", () => {
  state.meta.theme = normalizeTheme(themeSelect.value || "emerald");
  applyTheme(state.meta.theme);
  syncCustomThemeControls();
  applyCanvasBackground();
  saveState();
});
saveVotingBtn?.addEventListener("click", async () => {
  const serverId = getActiveServerId();

  if (!serverId) {
    alert("Publish your server first before configuring voting.");
    return;
  }

  try {
    await saveVotingConfig(serverId);
    alert("Voting settings saved.");
  } catch (err) {
    console.error("Save voting failed:", err);
    alert(err?.message || "Failed to save voting settings.");
  }
});

function generateSecureToken(length = 48) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);

  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("").slice(0, length);
}
votePortInput?.addEventListener("input", buildVoteConfigSnippet);
voteTokenInput?.addEventListener("input", buildVoteConfigSnippet);

function buildVoteConfigSnippet() {
  const port = String(votePortInput?.value || "8192").trim() || "8192";
  const token = String(voteTokenInput?.value || "").trim();

  if (!voteConfigPreview) return;

  if (!token) {
    voteConfigPreview.value = "Generate a token to see the config snippet.";
    return;
  }

  voteConfigPreview.value =
`host = "0.0.0.0"
port = ${port}
disable-v1-protocol = false

[tokens]
blockclub = "${token}"

[forwarding]
method = "none"`;
}
function clearStateObject() {
  state.meta = {
    description: "",
    tags: [],
    theme: "emerald",
    canvasBackgroundUrl: "",
    canvasBackgroundStoragePath: "",
    shellBackgroundUrl: "",
    shellBackgroundStoragePath: "",
    pageBackgroundUrl: "",
    pageBackgroundStoragePath: ""
  };
  state.blocks = [];
  state.decorations = [];
  state.selectedDecoId = null;
  state.selectedBlockId = null;
}
generateVoteTokenBtn?.addEventListener("click", () => {
  const token = generateSecureToken(48);
  voteTokenInput.value = token;
  buildVoteConfigSnippet();
});

copyVoteConfigBtn?.addEventListener("click", async () => {
  const text = String(voteConfigPreview?.value || "").trim();

  if (!text || text === "Generate a token to see the config snippet.") {
    alert("Generate a token first.");
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    copyVoteConfigBtn.textContent = "Copied!";
    setTimeout(() => {
      copyVoteConfigBtn.textContent = "Copy NuVotifier Config";
    }, 900);
  } catch (err) {
    console.error("Failed to copy config snippet:", err);
    alert("Failed to copy config snippet.");
  }
});

let decoMode = false;
let history = [];
let previewWindow = null;

function openOrFocusPreview(url) {
  if (previewWindow && !previewWindow.closed) {
    previewWindow.location.href = url;
    previewWindow.focus();
    return previewWindow;
  }

  previewWindow = window.open(url, "bc_preview");
  return previewWindow;
}

function sendPreviewState() {
  if (!previewWindow || previewWindow.closed) return;

  previewWindow.postMessage(
    {
      type: "BC_PREVIEW_STATE",
      state: JSON.parse(JSON.stringify(state))
    },
    window.location.origin
  );
}

const state = {
  meta: {
    description: "",
    tags: [],
    theme: "emerald",
    canvasBackgroundUrl: "",
    canvasBackgroundStoragePath: "",
    shellBackgroundUrl: "",
    shellBackgroundStoragePath: "",
    pageBackgroundUrl: "",
    pageBackgroundStoragePath: ""
  },
  blocks: [],
  decorations: [],
  selectedDecoId: null,
  selectedBlockId: null
};

function uid(prefix) {
  return `${prefix}_${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}

function getGrid() {
  const rect = canvas.getBoundingClientRect();
  const cols = GRID.columns;
  const usableWidth = GRID.width - GRID.padding * 2 - GRID.gap * (GRID.columns - 1);
  const colW = usableWidth / cols;
  const rowH = GRID.rowHeight;
  return { rect, cols, colW, rowH };
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function pxToGrid(xPx, yPx) {
  const { cols, colW, rowH } = getGrid();
  const gx = Math.round((xPx - GRID.padding) / (colW + GRID.gap));
  const gy = Math.round((yPx - GRID.padding) / (rowH + GRID.gap));
  return { x: clamp(gx, 0, cols - 1), y: clamp(gy, 0, 999) };
}
function makeDraftSafeState() {
  return {
    meta: {
      description: String(state.meta?.description || "").trim(),
      tags: Array.isArray(state.meta?.tags) ? state.meta.tags : [],
      theme: normalizeTheme(state.meta?.theme || "emerald"),
      canvasBackgroundUrl: String(state.meta?.canvasBackgroundUrl || "").trim(),
      canvasBackgroundStoragePath: String(state.meta?.canvasBackgroundStoragePath || "").trim(),
      shellBackgroundUrl: String(state.meta?.shellBackgroundUrl || "").trim(),
      shellBackgroundStoragePath: String(state.meta?.shellBackgroundStoragePath || "").trim(),
      pageBackgroundUrl: String(state.meta?.pageBackgroundUrl || "").trim(),
      pageBackgroundStoragePath: String(state.meta?.pageBackgroundStoragePath || "").trim()
    },
    blocks: (state.blocks || []).map((b) => {
      const copy = { ...b };
      delete copy.dataUrl;
      return copy;
    }),
    decorations: (state.decorations || []).map((d) => ({ ...d }))
  };
}
let draftSaveTimer = null;
function syncCustomThemeControls() {
  if (customThemeControls) {
    customThemeControls.style.display = "block";
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

function getBuilderShellTarget() {
  return (
    document.querySelector(".builder-canvas-shell") ||
    document.querySelector(".builder-shell") ||
    document.querySelector(".builder-stage") ||
    document.querySelector(".workbench") ||
    document.querySelector(".editor-shell") ||
    canvas?.parentElement ||
    null
  );
}

function applyCanvasBackground() {
  if (!canvas) return;

  const shell = getBuilderShellTarget();
  const page = document.body;

  clearBackgroundStyles(canvas);
  if (shell && shell !== canvas) clearBackgroundStyles(shell);
  clearBackgroundStyles(page);

  const canvasBg = String(state.meta?.canvasBackgroundUrl || "").trim();
  const shellBg = String(state.meta?.shellBackgroundUrl || "").trim();
  const pageBg = String(state.meta?.pageBackgroundUrl || "").trim();

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

function saveState() {
  try {
    const snapshot = JSON.stringify(makeDraftSafeState());

    history.push(snapshot);
    if (history.length > 50) history.shift();

    const routedServerId = serverIdFromUrl;

    if (!routedServerId) {
      return;
    }

    if (draftSaveTimer) clearTimeout(draftSaveTimer);

    draftSaveTimer = setTimeout(async () => {
      try {
        await saveDraftPage(routedServerId);
        console.log("Draft saved to Firestore:", routedServerId);
      } catch (err) {
        console.error("Failed to save Firestore draft:", err);
      }
    }, 500);
  } catch (err) {
    console.error("Failed to save builder draft:", err);
  }
}
function sizePxToGrid(wPx, hPx) {
  const { cols, colW, rowH } = getGrid();
  const gw = Math.round((wPx + GRID.gap) / (colW + GRID.gap));
  const gh = Math.round((hPx + GRID.gap) / (rowH + GRID.gap));
  return { w: clamp(gw, 1, cols), h: clamp(gh, 2, 999) };
}

function gridToPx(x, y, w, h) {
  const { cols, colW, rowH } = getGrid();
  const px = GRID.padding + x * (colW + GRID.gap);
  const py = GRID.padding + y * (rowH + GRID.gap);
  const pw = w * colW + GRID.gap * (w - 1);
  const ph = h * rowH + GRID.gap * (h - 1);
  return { px, py, pw, ph, cols, colW, rowH };
}

function renderAll() {
  blocksLayer.innerHTML = "";
  decoLayer.innerHTML = "";

  for (const b of state.blocks) {
    if (b.type === "banner" || b.type === "vote") continue;
    renderBlock(b);
  }
  for (const d of state.decorations) renderDeco(d);
}

function makeBlockShell(b) {
  const el = document.createElement("div");
  el.className = "block";
  el.dataset.id = b.id;

  const head = document.createElement("div");
  head.className = "block-head";

  const title = document.createElement("div");
  title.className = "block-title";
    if (b.type === "text") {
    title.textContent = "Text Box";
  } else if (b.type === "image") {
    title.textContent = "Image Box";
  } else {
    title.textContent = "Block";
  }

  const actions = document.createElement("div");
  actions.className = "block-actions";

  const del = document.createElement("button");
  del.className = "iconbtn";
  del.type = "button";
  del.textContent = "Delete";

  del.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  del.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (b.storagePath) {
      deleteStorageFile(b.storagePath);
    }

    state.blocks = state.blocks.filter(x => x.id !== b.id);
    renderAll();
    saveState();
  });
  el.addEventListener("pointerdown", (e) => {
    if (decoMode) return;
    state.selectedBlockId = b.id;
    if (fontSelect) {
      fontSelect.value = b.fontFamily || "inherit";
    }
  });
  actions.appendChild(del);
  head.appendChild(title);
  head.appendChild(actions);

  const body = document.createElement("div");
  body.className = "block-body";
  const rot = document.createElement("div");
  rot.className = "block-rot";

  rot.addEventListener("pointerdown", (e) => {
    if (decoMode) return;
    e.preventDefault();
    e.stopPropagation();

    const rect = canvas.getBoundingClientRect();
    const blockRect = el.getBoundingClientRect();

    const centerX = blockRect.left + blockRect.width / 2;
    const centerY = blockRect.top + blockRect.height / 2;

    const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
    const startRot = Number(b.rot || 0);

    rot.setPointerCapture(e.pointerId);

    const onMove = (ev) => {
      ev.preventDefault();

      const ang = Math.atan2(ev.clientY - centerY, ev.clientX - centerX);
      const deltaDeg = (ang - startAngle) * (180 / Math.PI);

      let next = startRot + deltaDeg;

      if (ev.shiftKey) {
        next = Math.round(next / 15) * 15;
      }

      b.rot = next;
      el.style.transform = `rotate(${b.rot}deg)`;
    };

    const onUp = () => {
      rot.releasePointerCapture(e.pointerId);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      saveState();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  });
  const resize = document.createElement("div");
  resize.className = "resize";
  resize.title = "Resize";

  el.appendChild(head);
  el.appendChild(rot);
  el.appendChild(body);
  el.appendChild(resize);

  setupDrag(el, head, b, "block");
  setupResize(el, resize, b, "block");

  return { el, body };
}
function togglePreview(on) {
  document.body.classList.toggle("preview", on);
}
function sanitizeHtml(dirty) {
  const t = document.createElement("template");
  t.innerHTML = String(dirty || "");

  const blocked = new Set(["script","style","iframe","object","embed","link","meta"]);
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

function buildPublishPayload() {
  const payload = JSON.parse(JSON.stringify(state));
  payload.blocks = (payload.blocks || []).filter(
    (b) => b.type !== "banner" && b.type !== "vote"
  );

  for (const b of payload.blocks || []) {
    if (b.type === "text") b.html = sanitizeHtml(b.html);
    if (b.type === "vote") {
      b.voteUrl = String(b.voteUrl || "").trim();
      b.label = String(b.label || "Vote here").trim() || "Vote here";
    }
  }

  return payload;
}
async function publishToFirebase(payload) {
  const firebaseReady = await waitForFirebaseReady();

  if (!firebaseReady) {
    throw new Error("Firebase did not finish initializing.");
  }

  const user = await waitForAuthUser();

  if (!user) {
    throw new Error("You must be logged in to publish.");
  }

  const { firestore, storage } = await loadFirebase();
  const { doc, setDoc, getDoc, serverTimestamp } = firestore;
  const { ref } = storage;

  const db = window.bcDb;
  const st = window.bcStorage;

  if (!db || !st) {
    throw new Error("Firebase not initialized. Check builder.html module script.");
  }

  const nameEl = document.getElementById("serverNameInput");
  const ipEl = document.getElementById("serverIpInput");

  const serverName = String(nameEl?.value || "").trim();
  const enteredServerIp = String(ipEl?.value || "").trim();

  const routedServerId = serverIdFromUrl;
  const isNew = !routedServerId;

  if (!serverName) {
    alert("Add Server name before publishing.");
    return null;
  }

  if (isNew && !enteredServerIp) {
    alert("Add Server IP before publishing.");
    return null;
  }

  console.log("bcDb value:", window.bcDb);
  console.log("bcStorage value:", window.bcStorage);
  console.log("bcAuth value:", window.bcAuth);
  console.log("db constructor:", window.bcDb?.constructor?.name);
  console.log("publish user uid:", user.uid);

  const serverRef = isNew
    ? doc(db, "servers", crypto.randomUUID())
    : doc(db, "servers", routedServerId);

  let lockedServerIp = enteredServerIp;

  if (!isNew) {
    const existingSnap = await getDoc(serverRef);

    if (!existingSnap.exists()) {
      throw new Error("Server not found.");
    }

    const existing = existingSnap.data() || {};
    const currentUid = user.uid;

    console.log("existing.ownerUid:", existing.ownerUid);
    console.log("currentUid:", currentUid);
    console.log("routedServerId:", routedServerId);

    if (!currentUid || existing.ownerUid !== currentUid) {
      throw new Error("You cannot publish changes to a server you do not own.");
    }

    lockedServerIp = String(existing.ip || "").trim();

    if (!lockedServerIp) {
      throw new Error("Existing server is missing its locked IP.");
    }

    if (ipEl) {
      ipEl.value = lockedServerIp;
    }
  }

  const serverId = serverRef.id;

  let bannerUrl = "";
  const nextBlocks = [];

  for (const b of payload.blocks || []) {
    if (b.type === "image") {
      if (b.imageUrl) {
        const copy = { ...b };
        delete copy.dataUrl;
        nextBlocks.push(copy);
        continue;
      }

      const dataUrl = String(b.dataUrl || "");
      if (!dataUrl) {
        nextBlocks.push(b);
        continue;
      }

      const webp = await compressToWebp(dataUrl, 1200, 0.82);
      const fileId = safeFileName(b.id || crypto.randomUUID());
      const storageRef = ref(st, `serverPages/${serverId}/images/${fileId}.webp`);
      const imageUrl = await uploadBlobAndGetUrl(storageRef, webp);

      const copy = { ...b };
      delete copy.dataUrl;
      copy.imageUrl = imageUrl;
      nextBlocks.push(copy);
      continue;
    }

    nextBlocks.push(b);
  }
  let canvasBackgroundUrl = String(state.meta?.canvasBackgroundUrl || "").trim();
  let shellBackgroundUrl = String(state.meta?.shellBackgroundUrl || "").trim();
  let pageBackgroundUrl = String(state.meta?.pageBackgroundUrl || "").trim();

  if (canvasBackgroundUrl.startsWith("data:")) {
    const webp = await compressToWebp(canvasBackgroundUrl, 1600, 0.82);
    const bgRef = ref(st, `serverPages/${serverId}/backgrounds/canvas.webp`);
    canvasBackgroundUrl = await uploadBlobAndGetUrl(bgRef, webp);
  }

  if (shellBackgroundUrl.startsWith("data:")) {
    const webp = await compressToWebp(shellBackgroundUrl, 1600, 0.82);
    const bgRef = ref(st, `serverPages/${serverId}/backgrounds/shell.webp`);
    shellBackgroundUrl = await uploadBlobAndGetUrl(bgRef, webp);
  }

  if (pageBackgroundUrl.startsWith("data:")) {
    const webp = await compressToWebp(pageBackgroundUrl, 1600, 0.82);
    const bgRef = ref(st, `serverPages/${serverId}/backgrounds/page.webp`);
    pageBackgroundUrl = await uploadBlobAndGetUrl(bgRef, webp);
  }

  const ownerUid = user.uid;

  const serverDocData = {
    ownerUid,
    name: serverName,
    description: String(state.meta?.description || "").trim(),
    tags: Array.isArray(state.meta?.tags) ? state.meta.tags : [],
    theme: normalizeTheme(state.meta?.theme || "emerald"),
    updatedAt: serverTimestamp(),
    pagePublishedAt: serverTimestamp(),
    isPublished: true
  };

  if (isNew) {
    serverDocData.ip = lockedServerIp;
    serverDocData.createdAt = serverTimestamp();
    serverDocData.views = 0;
    serverDocData.upvotes = 0;
  }

  await setDoc(serverRef, serverDocData, { merge: true });

  const pageRef = doc(db, "servers", serverId, "pages", "main");

  await setDoc(pageRef, {
    serverId,
    version: 1,
  meta: {
    description: String(state.meta?.description || "").trim(),
    tags: Array.isArray(state.meta?.tags) ? state.meta.tags : [],
    theme: normalizeTheme(state.meta?.theme || "emerald"),
    canvasBackgroundUrl,
    shellBackgroundUrl,
    pageBackgroundUrl
  },
    blocks: nextBlocks,
    decorations: payload.decorations || [],
    updatedAt: serverTimestamp()
  }, { merge: true });

  localStorage.setItem(LAST_SERVER_ID_KEY, serverId);
  replaceUrlServerId(serverId);
  state.meta.canvasBackgroundUrl = canvasBackgroundUrl;
  state.meta.shellBackgroundUrl = shellBackgroundUrl;
  state.meta.pageBackgroundUrl = pageBackgroundUrl;
  syncCustomThemeControls();
  applyCanvasBackground();

  lockIpField(true);
  const usedPaths = nextBlocks
    .map(b => b.storagePath)
    .filter(Boolean);

  await cleanupUnusedDraftImages(serverId, usedPaths);
  return { serverId, bannerUrl };
}
async function handleBackgroundUpload(fileInput, urlKey, storagePathKey, filePrefix) {
  const file = fileInput?.files?.[0];
  if (!file) return;

  try {
    const routedServerId = serverIdFromUrl;

    if (!routedServerId) {
      const dataUrl = await fileToDataUrl(file);
      state.meta[urlKey] = dataUrl;
      state.meta[storagePathKey] = "";
      applyCanvasBackground();
      saveState();
      return;
    }

    if (state.meta[storagePathKey]) {
      await deleteStorageFile(state.meta[storagePathKey]);
    }

    const { imageUrl, storagePath } = await uploadDraftImage(
      file,
      routedServerId,
      `${filePrefix}_${Date.now()}`
    );

    state.meta[urlKey] = imageUrl;
    state.meta[storagePathKey] = storagePath;

    applyCanvasBackground();
    saveState();
  } catch (err) {
    console.error(`${filePrefix} upload failed:`, err);
  } finally {
    if (fileInput) fileInput.value = "";
  }
}

async function handleBackgroundRemove(urlKey, storagePathKey) {
  try {
    if (state.meta[storagePathKey]) {
      await deleteStorageFile(state.meta[storagePathKey]);
    }
  } catch (err) {
    console.warn("Background delete failed:", err);
  }

  state.meta[urlKey] = "";
  state.meta[storagePathKey] = "";
  applyCanvasBackground();
  saveState();
}
function renderBlock(b) {
  const { el, body } = makeBlockShell(b);
  const { px, py, pw, ph } = gridToPx(b.x, b.y, b.w, b.h);

  el.style.left = `${px}px`;
  el.style.top = `${py}px`;
  el.style.width = `${pw}px`;
  el.style.height = `${ph}px`;
  el.style.transform = `rotate(${b.rot || 0}deg)`;
  
  if (b.type === "text") {
    const rte = document.createElement("div");
    rte.className = "rte";
    rte.contentEditable = "true";
    rte.spellcheck = true;
    rte.innerHTML = b.html || "<b>Title</b><br/>Write your lore, staff info, rules, etc.";
    rte.style.fontFamily = b.fontFamily || "inherit";

    rte.addEventListener("input", () => {
      b.html = rte.innerHTML;
      saveState();
    });

    rte.addEventListener("keydown", (e) => {
      if (e.key !== "Tab") return;

      e.preventDefault();

      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;

      const range = sel.getRangeAt(0);
      const spaces = document.createTextNode("\u00A0\u00A0\u00A0\u00A0");
      range.insertNode(spaces);

      range.setStartAfter(spaces);
      range.setEndAfter(spaces);
      sel.removeAllRanges();
      sel.addRange(range);

      b.html = rte.innerHTML;
      saveState();
    });

    body.appendChild(rte);
  }

  if (b.type === "image") {
    const box = document.createElement("div");
    box.className = "imagebox";

    const label = document.createElement("div");
    label.innerHTML =
      b.type === "banner"
        ? "<b>Banner</b><div class='muted'>Choose an image for your banner.</div>"
        : "<b>Image Block</b><div class='muted'>Choose an image to preview.</div>";

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";

    const preview = document.createElement("div");
    preview.className = "muted";
    preview.style.fontWeight = "900";

    const src = b.imageUrl || b.dataUrl || "";
    if (src) {
      box.style.backgroundImage = `url('${src}')`;
      box.style.backgroundSize = "cover";
      box.style.backgroundPosition = "center";
      box.style.borderStyle = "solid";
      label.style.display = "none";
      preview.textContent = "Image set";
    }

    input.addEventListener("change", async () => {
      const file = input.files && input.files[0];
      if (!file) return;

      const routedServerId = serverIdFromUrl;

      if (!routedServerId) {
        const dataUrl = await fileToDataUrl(file);
        b.dataUrl = dataUrl;

        box.style.backgroundImage = `url('${dataUrl}')`;
        box.style.backgroundSize = "cover";
        box.style.backgroundPosition = "center";
        box.style.borderStyle = "solid";
        label.style.display = "none";
        preview.textContent = "Image set";

        saveState();
        return;
      }
      try {
        preview.textContent = "Uploading...";
        if (b.storagePath) {
          await deleteStorageFile(b.storagePath);
        }
        const { imageUrl, storagePath } = await uploadDraftImage(file, routedServerId, b.id);

        b.imageUrl = imageUrl;
        b.storagePath = storagePath;
        delete b.dataUrl;

        box.style.backgroundImage = `url('${imageUrl}')`;
        box.style.backgroundSize = "cover";
        box.style.backgroundPosition = "center";
        box.style.borderStyle = "solid";
        label.style.display = "none";
        preview.textContent = "Uploaded";

        saveState();
      } catch (err) {
        console.error("Draft upload failed:", err);
        preview.textContent = "Upload failed";
      }
    });

    box.appendChild(label);
    box.appendChild(input);
    box.appendChild(preview);
    body.appendChild(box);
  }
  blocksLayer.appendChild(el);
}
function dataUrlToBlob(dataUrl) {
  const parts = String(dataUrl).split(",");
  const mime = parts[0].match(/:(.*?);/)?.[1] || "image/png";
  const bin = atob(parts[1] || "");
  const len = bin.length;
  const arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

async function blobToImage(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function compressToWebp(dataUrl, maxW, quality) {
  const blob = dataUrlToBlob(dataUrl);
  const img = await blobToImage(blob);

  const scale = Math.min(1, maxW / img.width);
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvasEl = document.createElement("canvas");
  canvasEl.width = w;
  canvasEl.height = h;

  const ctx = canvasEl.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);

  const outBlob = await new Promise((resolve) => {
    canvasEl.toBlob((b) => resolve(b), "image/webp", quality);
  });

  return outBlob;
}

function safeFileName(id) {
  return String(id).replace(/[^a-zA-Z0-9_-]/g, "_");
}

async function uploadBlobAndGetUrl(storageRef, blob) {
  const { storage } = await loadFirebase();
  const { uploadBytes, getDownloadURL } = storage;

  await uploadBytes(storageRef, blob, {
    contentType: blob.type || "image/webp",
    cacheControl: "public,max-age=31536000"
  });

  return await getDownloadURL(storageRef);
}
async function cleanupUnusedDraftImages(serverId, usedPaths) {
  try {
    const user = await waitForAuthUser();
    if (!user) return;

    const { storage } = await loadFirebase();
    const { ref, listAll, deleteObject } = storage;

    const st = window.bcStorage;

    const folderRef = ref(st, `draftUploads/${user.uid}/${serverId}`);

    const res = await listAll(folderRef);

    const usedSet = new Set(usedPaths.filter(Boolean));

    for (const item of res.items) {
      const fullPath = item.fullPath;

      if (!usedSet.has(fullPath)) {
        try {
          await deleteObject(item);
          console.log("GC deleted:", fullPath);
        } catch (err) {
          console.warn("GC failed delete:", fullPath, err);
        }
      }
    }
  } catch (err) {
    console.warn("GC skipped:", err);
  }
}
async function uploadDraftImage(file, serverId, blockId) {
  const user = await waitForAuthUser();
  if (!user) throw new Error("Not authenticated");

  const st = window.bcStorage;
  if (!st) throw new Error("Storage not ready");

  const { ref } = (await loadFirebase()).storage;

  const webp = await compressToWebp(await fileToDataUrl(file), 1200, 0.82);

  const path = `draftUploads/${user.uid}/${serverId}/${safeFileName(blockId)}.webp`;
  const storageRef = ref(st, path);

  const imageUrl = await uploadBlobAndGetUrl(storageRef, webp);

  return { imageUrl, storagePath: path };
}
async function deleteStorageFile(storagePath) {
  if (!storagePath) return;

  try {
    const { storage } = await loadFirebase();
    const { ref, deleteObject } = storage;

    const st = window.bcStorage;
    const fileRef = ref(st, storagePath);

    await deleteObject(fileRef);
    console.log("Deleted old image:", storagePath);
  } catch (err) {
    console.warn("Failed to delete old image:", storagePath, err);
  }
}
function renderDeco(d) {
  const el = document.createElement("div");
  el.className = "deco";
  el.dataset.id = d.id;
  el.textContent = d.value;
  const del = document.createElement("button");
  del.type = "button";
  del.className = "deco-del";
  del.textContent = "×";
  const rot = document.createElement("div");
  rot.className = "deco-rot";

  rot.addEventListener("pointerdown", (e) => {
    if (!decoMode) return;
    e.preventDefault();
    e.stopPropagation();

    state.selectedDecoId = d.id;
    renderAll();

    const rect = canvas.getBoundingClientRect();
    const centerX = rect.left + d.x * rect.width;
    const centerY = rect.top + d.y * rect.height;

    const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
    const startRot = Number(d.rot || 0);

    const onMove = (ev) => {
      ev.preventDefault();

      const ang = Math.atan2(ev.clientY - centerY, ev.clientX - centerX);
      const deltaDeg = (ang - startAngle) * (180 / Math.PI);

      let next = startRot + deltaDeg;

      if (ev.shiftKey) {
        next = Math.round(next / 15) * 15;
      }

      d.rot = next;

      renderAll();
      saveState();
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  });

  el.appendChild(rot);
  del.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  del.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    state.decorations = state.decorations.filter(x => x.id !== d.id);
    if (state.selectedDecoId === d.id) state.selectedDecoId = null;

    renderAll();
    saveState();
  });

  el.appendChild(del);  const res = document.createElement("div");
  res.className = "deco-resize";
  res.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  el.appendChild(res);

  const rect = canvas.getBoundingClientRect();
  el.style.left = `${d.x * rect.width}px`;
  el.style.top = `${d.y * rect.height}px`;
  el.style.fontSize = `${d.size}px`;
  el.style.opacity = `${d.opacity}`;
  el.style.transform = `rotate(${d.rot}deg)`;
  el.style.zIndex = String(d.z || 1);

  el.addEventListener("pointerdown", (e) => {
    if (!decoMode) return;
    e.preventDefault();
    selectDeco(el);
  });

  setupDrag(el, el, d, "deco");
  setupDecoResize(el, res, d);

  decoLayer.appendChild(el);
}
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
function setupDrag(containerEl, handleEl, item, kind) {
  handleEl.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".deco-resize")) return;
    if (e.target.closest("button, a, input, textarea, select, [contenteditable='true']")) return;

    if (kind === "deco" && !decoMode) return;
    if (kind === "block" && decoMode) return;
    if (kind === "deco") {
      state.selectedDecoId = item.id;
      for (const node of decoLayer.querySelectorAll(".deco")) node.classList.remove("selected");
      const node = decoLayer.querySelector(`[data-id="${item.id}"]`);
      if (node) node.classList.add("selected");
    }

    e.preventDefault();    

    const startX = e.clientX;
    const startY = e.clientY;

    const rect = containerEl.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();

    const origLeft = rect.left - canvasRect.left;
    const origTop = rect.top - canvasRect.top;

    handleEl.setPointerCapture(e.pointerId);

    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;

      if (kind === "block") {
        const nextLeft = origLeft + dx;
        const nextTop = origTop + dy;

        const { cols, colW, rowH } = getGrid();

        const maxX = Math.max(0, cols - item.w);
        const maxY = Math.max(0, Math.floor(canvasRect.height / rowH) - item.h);

        const gx = Math.round(nextLeft / colW);
        const gy = Math.round(nextTop / rowH);

        item.x = clamp(gx, 0, maxX);
        item.y = clamp(gy, 0, maxY);

        const { px, py, pw, ph } = gridToPx(item.x, item.y, item.w, item.h);
        containerEl.style.left = `${px}px`;
        containerEl.style.top = `${py}px`;
        containerEl.style.width = `${pw}px`;
        containerEl.style.height = `${ph}px`;
      }

      if (kind === "deco") {
        const canvasW = canvasRect.width;
        const canvasH = canvasRect.height;
        const nx = clamp((origLeft + dx) / canvasW, 0, 1);
        const ny = clamp((origTop + dy) / canvasH, 0, 1);
        item.x = nx;
        item.y = ny;
        containerEl.style.left = `${nx * canvasW}px`;
        containerEl.style.top = `${ny * canvasH}px`;
      }
    };

    const onUp = () => {
      handleEl.releasePointerCapture(e.pointerId);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  });
}
function normalizeTheme(theme) {
  const allowed = ["emerald", "royal", "crimson", "gold", "ocean", "obsidian"];
  return allowed.includes(theme) ? theme : "emerald";
}
function applyTheme(theme) {
  const safeTheme = normalizeTheme(theme);
  document.body.dataset.theme = safeTheme;
}
function setupResize(blockEl, handleEl, b) {
  handleEl.addEventListener("pointerdown", (e) => {
    if (decoMode) return;
    e.preventDefault();

    const startX = e.clientX;
    const startY = e.clientY;

    const rect = blockEl.getBoundingClientRect();
    const startW = rect.width;
    const startH = rect.height;

    handleEl.setPointerCapture(e.pointerId);

    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;

      const nextW = Math.max(80, startW + dx);
      const nextH = Math.max(120, startH + dy);

      const g = sizePxToGrid(nextW, nextH, b.type);
      b.w = g.w;
      b.h = g.h;

      const { px, py, pw, ph } = gridToPx(b.x, b.y, b.w, b.h);
      blockEl.style.left = `${px}px`;
      blockEl.style.top = `${py}px`;
      blockEl.style.width = `${pw}px`;
      blockEl.style.height = `${ph}px`;
    };

    const onUp = () => {
      handleEl.releasePointerCapture(e.pointerId);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  });
}
function renderTagDropdown() {
  if (!tagDropdownMenu || !tagDropdownBtn) return;

  const selected = Array.isArray(state.meta?.tags) ? state.meta.tags : [];
  tagDropdownMenu.innerHTML = "";

  if (selected.length === 0) {
    tagDropdownBtn.textContent = "Select tags";
  } else if (selected.length === 1) {
    tagDropdownBtn.textContent = selected[0];
  } else {
    tagDropdownBtn.textContent = `${selected.length} tags selected`;
  }

  for (const tag of AVAILABLE_TAGS) {
    const row = document.createElement("label");
    row.className = "tag-dropdown-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = selected.includes(tag);

    checkbox.addEventListener("change", () => {
      const current = Array.isArray(state.meta?.tags) ? [...state.meta.tags] : [];

      if (checkbox.checked) {
        if (current.length >= MAX_SELECTED_TAGS) {
          checkbox.checked = false;
          alert(`You can only choose up to ${MAX_SELECTED_TAGS} tags.`);
          return;
        }
        current.push(tag);
      } else {
        const index = current.indexOf(tag);
        if (index !== -1) current.splice(index, 1);
      }

      state.meta.tags = current;
      renderTagDropdown();
      syncStagePreview();
      saveState();
    });

    const text = document.createElement("span");
    text.textContent = tag;

    row.appendChild(checkbox);
    row.appendChild(text);
    tagDropdownMenu.appendChild(row);
  }
}
tagDropdownBtn?.addEventListener("click", () => {
  const isHidden = tagDropdownMenu.hasAttribute("hidden");

  if (isHidden) {
    tagDropdownMenu.removeAttribute("hidden");
  } else {
    tagDropdownMenu.setAttribute("hidden", "");
  }
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".tag-dropdown")) {
    tagDropdownMenu?.setAttribute("hidden", "");
  }
});
function setupDecoResize(decoEl, handleEl, d) {
  handleEl.addEventListener("pointerdown", (e) => {
    if (!decoMode) return;
    e.preventDefault();

    const startY = e.clientY;
    const startSize = d.size;

    handleEl.setPointerCapture(e.pointerId);

    const onMove = (ev) => {
      const dy = ev.clientY - startY;
      const nextSize = clamp(startSize + dy * 0.2, 14, 180);
      d.size = nextSize;
      decoEl.style.fontSize = `${nextSize}px`;
    };

    const onUp = () => {
      handleEl.releasePointerCapture(e.pointerId);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  });
}

function addTextBlock() {
  if (state.blocks.filter(b => b.type === "text").length >= MAX_TEXT_BLOCKS) {
    alert("Maximum text boxes reached.");
    return;
  }
  const id = uid("blk");
  const b = {
    id,
    type: "text",
    x: 1,
    y: 1,
    w: 6,
    h: 8,
    rot: 0,
    html: "<b>Title</b><br/>Write your lore, staff info, rules, etc."
  };
  state.blocks.push(b);
  renderAll();
}

function addImageBlock() {
  if (state.blocks.filter(b => b.type === "image").length >= MAX_IMAGE_BLOCKS) {
    alert("Maximum image boxes reached.");
    return;
  }
  const id = uid("blk");
  const b = {
    id,
    type: "image",
    x: 7,
    y: 1,
    w: 4,
    h: 8,
    rot: 0,
    dataUrl: ""
  };
  state.blocks.push(b);
  renderAll();
}

function addEmojiDeco() {
  setDecoMode(true);
  const emojiCount = state.decorations.filter(d => d.type === "emoji").length;
  if (emojiCount >= 10) {
    alert("Max 10 emojis for now.");
    return;
  }
  const raw = (emojiInput.value || "✨").trim() || "✨";
  const val = Array.from(raw).slice(0, 3).join("") || "✨";

  const id = uid("deco");
  const d = {
    id,
    type: "emoji",
    value: val,
    x: 0.52,
    y: 0.16,
    size: 54,
    opacity: 1,
    rot: 0,
    z: 10
  };

  state.decorations.push(d);
  renderAll();
  saveState();
}

function setDecoMode(on) {
  decoMode = on;

  toggleDecoBtn.textContent = `Edit decorations: ${decoMode ? "On" : "Off"}`;
  toggleDecoBtn.classList.toggle("primary", decoMode);
  toggleDecoBtn.classList.toggle("ghost", !decoMode);

  canvas.classList.toggle("deco-on", decoMode);
  canvas.style.cursor = decoMode ? "crosshair" : "default";

  if (!decoMode) {
    state.selectedDecoId = null;
    for (const node of decoLayer.querySelectorAll(".deco")) {
      node.classList.remove("selected");
    }
  }
}
function selectDeco(el) {
  for (const node of decoLayer.querySelectorAll(".deco")) {
    node.classList.remove("selected");
  }
  el.classList.add("selected");
  state.selectedDecoId = el.dataset.id;
}
async function loadServerPageFromFirebase(serverId) {
  const { firestore } = await loadFirebase();
  const { doc, getDoc } = firestore;

  const db = window.bcDb;
  if (!db) {
    throw new Error("Firebase database is not ready.");
  }

  const user = await waitForAuthUser();

  if (!user) {
    throw new Error("You must be logged in to edit a server.");
  }

  const serverSnap = await getDoc(doc(db, "servers", serverId));

  if (!serverSnap.exists()) {
    throw new Error(`Server ${serverId} was not found.`);
  }

  const serverData = serverSnap.data() || {};

  if (!serverData.ownerUid) {
    throw new Error("This server is missing an owner and cannot be edited.");
  }

  if (serverData.ownerUid !== user.uid) {
    throw new Error("You do not own this server page.");
  }

  const pageSnap = await getDoc(doc(db, "servers", serverId, "pages", "main"));
  const pageData = pageSnap.exists() ? pageSnap.data() || {} : {};
  state.meta = {
    description: pageData?.meta?.description || serverData.description || "",
    tags: Array.isArray(pageData?.meta?.tags)
      ? pageData.meta.tags
      : (Array.isArray(serverData.tags) ? serverData.tags : []),
    theme: normalizeTheme(pageData?.meta?.theme || serverData.theme || "emerald"),
    canvasBackgroundUrl: String(pageData?.meta?.canvasBackgroundUrl || "").trim(),
    canvasBackgroundStoragePath: "",
    shellBackgroundUrl: String(pageData?.meta?.shellBackgroundUrl || "").trim(),
    shellBackgroundStoragePath: "",
    pageBackgroundUrl: String(pageData?.meta?.pageBackgroundUrl || "").trim(),
    pageBackgroundStoragePath: ""
  };
  applyTheme(state.meta.theme || "emerald");
  syncCustomThemeControls();
  applyCanvasBackground();
  const nameEl = document.getElementById("serverNameInput");
  const ipEl = document.getElementById("serverIpInput");

  if (nameEl) nameEl.value = serverData.name || "";
  if (ipEl) ipEl.value = serverData.ip || "";
  if (serverDescriptionInput) {
    serverDescriptionInput.value = state.meta.description || "";
  }

  syncStagePreview();

  lockIpField(true);

  state.blocks = Array.isArray(pageData.blocks) ? pageData.blocks : [];
  state.decorations = Array.isArray(pageData.decorations) ? pageData.decorations : [];

  renderAll();
  syncStagePreview();
  return {
    ok: true,
    serverData,
    pageData,
    ownerUid: user.uid
  };
}
function lockIpField(locked) {
  const ipEl = document.getElementById("serverIpInput");
  if (!ipEl) return;

  ipEl.disabled = !!locked;
  ipEl.readOnly = !!locked;
  ipEl.style.opacity = locked ? "0.65" : "1";
  ipEl.style.cursor = locked ? "not-allowed" : "text";

  if (locked) {
    ipEl.title = "Server IP cannot be changed after the server is created.";
  } else {
    ipEl.title = "";
  }
}
function showBuilderAccessError(message) {
  clearStateObject();
  renderAll();

  const nameEl = document.getElementById("serverNameInput");
  const ipEl = document.getElementById("serverIpInput");

  if (nameEl) {
    nameEl.value = "";
    nameEl.disabled = true;
    nameEl.placeholder = "Access denied";
  }

  if (ipEl) {
    ipEl.value = "";
    ipEl.disabled = true;
    ipEl.readOnly = true;
    ipEl.placeholder = "Access denied";
  }

  if (addTextBtn) addTextBtn.disabled = true;
  if (addImageBtn) addImageBtn.disabled = true;
  if (addEmojiBtn) addEmojiBtn.disabled = true;
  if (toggleDecoBtn) toggleDecoBtn.disabled = true;
  if (previewBtn) previewBtn.disabled = true;
  if (publishBtn) publishBtn.disabled = true;
  if (resetBtn) resetBtn.disabled = true;
  if (exportBtn) exportBtn.disabled = true;
  if (fontSelect) fontSelect.disabled = true;

  alert(message);
}
async function assertServerOwnership(serverId) {
  const firebaseReady = await waitForFirebaseReady();
  if (!firebaseReady) {
    throw new Error("Firebase did not finish initializing.");
  }

  const user = await waitForAuthUser();
  if (!user) {
    throw new Error("You must be logged in.");
  }

  const { firestore } = await loadFirebase();
  const { doc, getDoc } = firestore;

  const db = window.bcDb;
  if (!db) {
    throw new Error("Firebase database is not ready.");
  }

  const serverRef = doc(db, "servers", serverId);
  const serverSnap = await getDoc(serverRef);

  if (!serverSnap.exists()) {
    throw new Error("Server not found.");
  }

  const serverData = serverSnap.data() || {};

  if (!serverData.ownerUid) {
    throw new Error("This server has no owner.");
  }

  if (serverData.ownerUid !== user.uid) {
    throw new Error("You do not own this server.");
  }

  return { user, serverData };
}
testVoteBtn?.addEventListener("click", async () => {
  const activeServerId = getActiveServerId();

  if (!activeServerId) {
    alert("Publish your server first before testing voting.");
    return;
  }

  try {
    testVoteBtn.disabled = true;
    testVoteBtn.textContent = "Sending...";
    if (testVoteMsg) testVoteMsg.textContent = "";

    await saveVotingConfig(activeServerId);

    const res = await fetch("https://us-central1-blockclub-4742a.cloudfunctions.net/testVote", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        serverId: activeServerId
      })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data?.error || "Test vote failed.");
    }

    if (testVoteMsg) {
      testVoteMsg.textContent = "Test vote sent successfully. Check your Minecraft server console.";
    }

    testVoteBtn.textContent = "Sent!";
    setTimeout(() => {
      testVoteBtn.textContent = "Send Test Vote";
      testVoteBtn.disabled = false;
    }, 1200);
  } catch (err) {
    console.error("Test vote failed:", err);
    if (testVoteMsg) {
      testVoteMsg.textContent = err.message || "Test vote failed.";
    }
    testVoteBtn.textContent = "Send Test Vote";
    testVoteBtn.disabled = false;
  }
});

async function loadDraftPage(serverId) {
  const { firestore } = await loadFirebase();
  const { doc, getDoc } = firestore;

  const db = window.bcDb;
  if (!db) {
    throw new Error("Firebase database is not ready.");
  }

  const draftRef = doc(db, "servers", serverId, "drafts", "main");
  const draftSnap = await getDoc(draftRef);

  if (!draftSnap.exists()) {
    return null;
  }

  return draftSnap.data() || null;
}

async function saveDraftPage(serverId) {
  const ownership = await assertServerOwnership(serverId);

  const { firestore } = await loadFirebase();
  const { doc, setDoc, serverTimestamp } = firestore;

  const db = window.bcDb;
  if (!db) {
    throw new Error("Firebase database is not ready.");
  }

  const safeState = makeDraftSafeState();
  const draftRef = doc(db, "servers", serverId, "drafts", "main");

  await setDoc(
    draftRef,
    {
      serverId,
      ownerUid: ownership.user.uid,
      version: 1,
      meta: safeState.meta,
      blocks: safeState.blocks,
      decorations: safeState.decorations,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}
function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];

  return tags
    .map(t => String(t || "").trim())
    .filter(t => AVAILABLE_TAGS.includes(t))
    .filter((t, i, arr) => arr.indexOf(t) === i)
    .slice(0, MAX_SELECTED_TAGS);
}

function syncStagePreview() {
  applyTheme(state.meta?.theme || "emerald");
  const serverName = String(document.getElementById("serverNameInput")?.value || "").trim();
  const serverIp = String(document.getElementById("serverIpInput")?.value || "").trim();
  const description = String(state.meta?.description || "").trim();
  const tags = Array.isArray(state.meta?.tags) ? state.meta.tags : [];

  if (stageServerName) {
    stageServerName.textContent = serverName || "Example Server Name";
  }

  if (stageServerIp) {
    stageServerIp.textContent = serverIp || "play.example.net";
  }

  if (stageServerDescription) {
    stageServerDescription.textContent =
      description || "A fresh survival world with big wars, strong teams, and a reason to come back tomorrow.";
  }

  if (stageTagList) {
    const shownTags = tags.length ? tags : ["SMP", "PvP", "Economy"];
    stageTagList.innerHTML = shownTags
      .map(tag => `<span class="pillchip">${tag}</span>`)
      .join("");
  }
}
async function loadState() {
  const routedServerId = serverIdFromUrl;

  if (routedServerId) {
    try {
      const { serverData } = await assertServerOwnership(routedServerId);
      await loadVotingConfig(routedServerId);
      const nameEl = document.getElementById("serverNameInput");
      const ipEl = document.getElementById("serverIpInput");

      if (nameEl) nameEl.value = serverData.name || "";
      if (ipEl) ipEl.value = serverData.ip || "";

      lockIpField(true);

      const draftData = await loadDraftPage(routedServerId);

      if (draftData) {
        clearStateObject();
        state.meta = {
          description: draftData?.meta?.description || "",
          tags: Array.isArray(draftData?.meta?.tags) ? draftData.meta.tags : [],
          theme: normalizeTheme(draftData?.meta?.theme || "emerald"),
          canvasBackgroundUrl: String(draftData?.meta?.canvasBackgroundUrl || "").trim(),
          canvasBackgroundStoragePath: String(draftData?.meta?.canvasBackgroundStoragePath || "").trim(),
          shellBackgroundUrl: String(draftData?.meta?.shellBackgroundUrl || "").trim(),
          shellBackgroundStoragePath: String(draftData?.meta?.shellBackgroundStoragePath || "").trim(),
          pageBackgroundUrl: String(draftData?.meta?.pageBackgroundUrl || "").trim(),
          pageBackgroundStoragePath: String(draftData?.meta?.pageBackgroundStoragePath || "").trim()
        };

        if (themeSelect) {
          themeSelect.value = state.meta.theme || "emerald";
        }
        applyTheme(state.meta.theme || "emerald");
        syncCustomThemeControls();
        applyCanvasBackground();

        state.blocks = Array.isArray(draftData.blocks) ? draftData.blocks : [];
        state.decorations = Array.isArray(draftData.decorations) ? draftData.decorations : [];

        if (serverDescriptionInput) {
          serverDescriptionInput.value = state.meta.description || "";
        }

        state.meta.tags = normalizeTags(state.meta.tags);
        renderTagDropdown();

        console.log(`Loaded Firestore draft for server ${routedServerId}`);
        renderTagDropdown();
        syncStagePreview();
        syncCustomThemeControls();
        applyCanvasBackground();
        renderAll();
        return;
      }

      const loadedPublished = await loadServerPageFromFirebase(routedServerId);
      if (loadedPublished) {
        console.log(`Loaded published page for server ${routedServerId}`);
        renderAll();
        return;
      }

      clearStateObject();
      renderAll();
      return;
    } catch (err) {
      console.error("Routed builder access denied:", err);
      showBuilderAccessError(err.message || "You do not have permission to edit this server.");
      return;
    }
  }

  const user = await waitForAuthUser();

  if (!user) {
    showBuilderAccessError("You must be signed in with your real account to use the builder.");
    return;
  }

  lockIpField(false);

  clearStateObject();
  addTextBlock();
  addImageBlock();
  syncStagePreview();
  renderTagDropdown();
  renderAll();
}

function resetState() {
  state.meta = {
    description: "",
    tags: [],
    theme: "emerald",
    canvasBackgroundUrl: "",
    canvasBackgroundStoragePath: "",
    shellBackgroundUrl: "",
    shellBackgroundStoragePath: "",
    pageBackgroundUrl: "",
    pageBackgroundStoragePath: ""
  };
  state.blocks = [];
  state.decorations = [];
  if (themeSelect) themeSelect.value = "emerald";
  applyTheme("emerald");
  if (serverDescriptionInput) serverDescriptionInput.value = "";
  renderTagDropdown();
  syncStagePreview();
  renderAll();
  syncCustomThemeControls();
  applyCanvasBackground();
}

function exportState() {
  exportArea.value = JSON.stringify(state, null, 2);
  exportDialog.showModal();
}

function copyExportText() {
  navigator.clipboard.writeText(exportArea.value || "");
  copyExport.textContent = "Copied";
  setTimeout(() => (copyExport.textContent = "Copy"), 900);
}

canvas.addEventListener("pointerdown", (e) => {
  if (!decoMode) return;
  if (e.target.closest(".deco")) return;

  state.selectedDecoId = null;
  for (const node of decoLayer.querySelectorAll(".deco")) {
    node.classList.remove("selected");
  }
});

addTextBtn.addEventListener("click", () => {
  addTextBlock();
  saveState();
});

addImageBtn.addEventListener("click", () => {
  addImageBlock();
  saveState();
});
if (fontSelect) {
  fontSelect.addEventListener("change", () => {
    if (!state.selectedBlockId) return;
    const b = state.blocks.find(x => x.id === state.selectedBlockId);
    if (!b) return;
    b.fontFamily = fontSelect.value || "inherit";
    renderAll();
    saveState();
  });
}
toggleDecoBtn.addEventListener("click", () => setDecoMode(!decoMode));
addEmojiBtn.addEventListener("click", addEmojiDeco);
exportBtn.addEventListener("click", () => exportState());

resetBtn.addEventListener("click", () => {
  if (!confirm("Reset canvas? This clears blocks and decorations.")) return;
  resetState();
  saveState();
});

window.addEventListener("keydown", (e) => {
  if (!decoMode) return;
  if (!state.selectedDecoId) return;

  if (e.key === "Backspace" || e.key === "Delete") {
    e.preventDefault();

    state.decorations = state.decorations.filter(d => d.id !== state.selectedDecoId);
    state.selectedDecoId = null;

    renderAll();
    saveState();
    return;
  }

  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
    e.preventDefault();

    const step = e.shiftKey ? 0.02 : 0.005;
    const d = state.decorations.find(x => x.id === state.selectedDecoId);
    if (!d) return;

    if (e.key === "ArrowLeft") d.x -= step;
    if (e.key === "ArrowRight") d.x += step;
    if (e.key === "ArrowUp") d.y -= step;
    if (e.key === "ArrowDown") d.y += step;

    d.x = Math.max(0, Math.min(1, d.x));
    d.y = Math.max(0, Math.min(1, d.y));

    renderAll();
    saveState();
  }
});

closeExport.addEventListener("click", () => exportDialog.close());
copyExport.addEventListener("click", copyExportText);
previewBtn.addEventListener("click", () => {
  saveState();

  const routedServerId = serverIdFromUrl;
  const url = routedServerId
    ? `preview.html?serverId=${encodeURIComponent(routedServerId)}&draft=1`
    : "preview.html";

  openOrFocusPreview(url);

  setTimeout(() => {
    sendPreviewState();
  }, 150);
});
publishBtn.addEventListener("click", async () => {
  const payload = buildPublishPayload();

  try {
    const result = await publishToFirebase(payload);
    if (!result) return;

    exportArea.value = JSON.stringify(
      { serverId: result.serverId, bannerUrl: result.bannerUrl, page: payload },
      null,
      2
    );
    exportDialog.showModal();

    alert(`Published! serverId: ${result.serverId}`);
  } catch (err) {
    console.error("PUBLISH ERROR FULL:", err);
    console.error("PUBLISH ERROR STACK:", err?.stack);
    alert(String(err?.message || err));
  }
});
document.getElementById("serverNameInput")?.addEventListener("input", syncStagePreview);
document.getElementById("serverIpInput")?.addEventListener("input", syncStagePreview);

serverDescriptionInput?.addEventListener("input", () => {
  let value = String(serverDescriptionInput.value || "").trim();

  if (/[.!?].+[A-Za-z0-9]/.test(value)) {
    value = value.split(/(?<=[.!?])\s+/)[0].trim();
    serverDescriptionInput.value = value;
  }

  state.meta.description = value;
  syncStagePreview();
  saveState();
});
window.addEventListener("resize", () => renderAll());
window.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key === "z") {
    if (history.length > 1) {
      history.pop();
      const prev = history[history.length - 1];
      const parsed = JSON.parse(prev);
      state.meta = {
        description: parsed.meta?.description || "",
        tags: Array.isArray(parsed.meta?.tags) ? parsed.meta.tags : [],
        theme: normalizeTheme(parsed.meta?.theme || "emerald"),
        canvasBackgroundUrl: String(parsed.meta?.canvasBackgroundUrl || "").trim(),
        canvasBackgroundStoragePath: String(parsed.meta?.canvasBackgroundStoragePath || "").trim(),
        shellBackgroundUrl: String(parsed.meta?.shellBackgroundUrl || "").trim(),
        shellBackgroundStoragePath: String(parsed.meta?.shellBackgroundStoragePath || "").trim(),
        pageBackgroundUrl: String(parsed.meta?.pageBackgroundUrl || "").trim(),
        pageBackgroundStoragePath: String(parsed.meta?.pageBackgroundStoragePath || "").trim()
      };
      if (themeSelect) {
        themeSelect.value = state.meta.theme;
      }
      applyTheme(state.meta.theme);
      state.blocks = parsed.blocks || [];
      state.decorations = parsed.decorations || [];

      if (serverDescriptionInput) {
        serverDescriptionInput.value = state.meta.description || "";
      }
      
      renderTagDropdown();
      syncStagePreview();
      renderAll();
      syncCustomThemeControls();
      applyCanvasBackground();
    }
  }
});
homeBtn?.addEventListener("click", () => {
  window.location.href = "index.html";
});

addCanvasBackgroundBtn?.addEventListener("click", () => {
  canvasBackgroundInput?.click();
});

addShellBackgroundBtn?.addEventListener("click", () => {
  shellBackgroundInput?.click();
});

addPageBackgroundBtn?.addEventListener("click", () => {
  pageBackgroundInput?.click();
});

canvasBackgroundInput?.addEventListener("change", async () => {
  await handleBackgroundUpload(
    canvasBackgroundInput,
    "canvasBackgroundUrl",
    "canvasBackgroundStoragePath",
    "canvas_background"
  );
});

shellBackgroundInput?.addEventListener("change", async () => {
  await handleBackgroundUpload(
    shellBackgroundInput,
    "shellBackgroundUrl",
    "shellBackgroundStoragePath",
    "shell_background"
  );
});

pageBackgroundInput?.addEventListener("change", async () => {
  await handleBackgroundUpload(
    pageBackgroundInput,
    "pageBackgroundUrl",
    "pageBackgroundStoragePath",
    "page_background"
  );
});

removeCanvasBackgroundBtn?.addEventListener("click", async () => {
  await handleBackgroundRemove("canvasBackgroundUrl", "canvasBackgroundStoragePath");
});

removeShellBackgroundBtn?.addEventListener("click", async () => {
  await handleBackgroundRemove("shellBackgroundUrl", "shellBackgroundStoragePath");
});

removePageBackgroundBtn?.addEventListener("click", async () => {
  await handleBackgroundRemove("pageBackgroundUrl", "pageBackgroundStoragePath");
});

applyTheme("emerald");
if (themeSelect) {
  themeSelect.value = "emerald";
}
setDecoMode(false);

loadState().catch((err) => {
  console.error(err);
  clearStateObject();
  addTextBlock();
  addImageBlock();
  syncStagePreview();
  renderTagDropdown();
  syncCustomThemeControls();
  applyCanvasBackground();
  applyCanvasBackground();
  renderAll();
});
