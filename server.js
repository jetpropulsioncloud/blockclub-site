import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  increment,
  serverTimestamp,
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
const GRID = {
  columns: 12,
  width: 1360,
  rowHeight: 64,
  gap: 12,
  padding: 16
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
  spUpvoteBtn: document.getElementById("spUpvoteBtn"),
  spTags: document.getElementById("spTags"),
  spDesc: document.getElementById("spDesc"),
  pageCanvas: document.getElementById("pageCanvas"),
  spVoteUsername: document.getElementById("spVoteUsername"),
  spVoteBtn: document.getElementById("spVoteBtn"),
  spVoteMsg: document.getElementById("spVoteMsg"),
  spVotesPill: document.getElementById("spVotesPill"),
  featuredStatus: document.getElementById("featuredStatus"),
  featuredPlayers: document.getElementById("featuredPlayers"),
};
let currentViewer = null;
let currentServerData = null;
function getDraftKey(serverId) {
  return serverId ? `bc_builder_state_${serverId}` : "bc_builder_state_v1";
}

function safeParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
function normalizeTheme(theme) {
  const allowed = ["emerald", "royal", "crimson", "gold", "ocean", "obsidian"];
  return allowed.includes(theme) ? theme : "emerald";
}

function applyTheme(theme) {
  document.body.dataset.theme = normalizeTheme(theme);
}
function loadDraftPageData(serverId) {
  const raw = localStorage.getItem(getDraftKey(serverId));
  if (!raw) return null;

  const parsed = safeParse(raw);
  if (!parsed) return null;

  return {
    blocks: Array.isArray(parsed.blocks) ? parsed.blocks : [],
    decorations: Array.isArray(parsed.decorations) ? parsed.decorations : []
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
async function fetchServerStatusByIp(ip, edition = "") {
  const rawIp = String(ip || "").trim();
  if (!rawIp) return null;

  try {
    const isBedrock = String(edition || "").toLowerCase().includes("bedrock");

    const endpoint = isBedrock
      ? `https://api.mcsrvstat.us/bedrock/3/${encodeURIComponent(rawIp)}`
      : `https://api.mcsrvstat.us/3/${encodeURIComponent(rawIp)}`;

    const res = await fetch(endpoint);
    if (!res.ok) {
      throw new Error(`Status fetch failed: ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    console.error("Featured status fetch failed:", err);
    return null;
  }
}

async function loadFeaturedBlockClubCard() {
  if (!els.featuredStatus || !els.featuredPlayers) return;

  els.featuredStatus.textContent = "Checking...";
  els.featuredStatus.classList.remove("online");
  els.featuredStatus.classList.add("offline");
  els.featuredPlayers.textContent = "Checking players...";

  const data = await fetchServerStatusByIp("play.mcblockclub.com");

  if (!data || !data.online) {
    els.featuredStatus.textContent = "Offline";
    els.featuredStatus.classList.remove("online");
    els.featuredStatus.classList.add("offline");
    els.featuredPlayers.textContent = "0 players";
    return;
  }

  els.featuredStatus.textContent = "Online";
  els.featuredStatus.classList.remove("offline");
  els.featuredStatus.classList.add("online");

  const online = Number(data?.players?.online ?? 0);
  const max = Number(data?.players?.max ?? 0);

  if (Number.isFinite(online) && Number.isFinite(max) && max > 0) {
    els.featuredPlayers.textContent = `${online}/${max} players`;
    return;
  }

  if (Number.isFinite(online)) {
    els.featuredPlayers.textContent = `${online} players`;
    return;
  }

  els.featuredPlayers.textContent = "Online";
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
  console.log("LIVE BLOCK DATA", b);
  console.log("LIVE BLOCK PX", { px, py, pw, ph });
  el.style.left = `${px}px`;
  el.style.top = `${py}px`;
  el.style.width = `${pw}px`;
  el.style.height = `${ph}px`;
  el.style.transform = `rotate(${b.rot || 0}deg)`;
  el.style.outline = "1px solid rgba(255,255,255,0.15)";

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

    const src = String(b.imageUrl || b.dataUrl || "").trim();
    if (src) {
      img.style.backgroundImage = `url("${escapeHtml(src)}")`;
    }

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

  const canvasW = GRID.width;
  const canvasH = Math.max(700, els.pageCanvas?.offsetHeight || 700);

  const x = (d.x || 0) * canvasW;
  const y = (d.y || 0) * canvasH;

  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.position = "absolute";
  el.style.transform = `translate(-50%, -50%) rotate(${d.rot || 0}deg)`;
  el.style.fontSize = `${d.size || 54}px`;
  el.style.opacity = `${d.opacity ?? 1}`;

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
function wireUpvoteButton(serverData, currentUser) {
  if (!els.spUpvoteBtn || !els.spUpvotesPill) return;

  const btn = els.spUpvoteBtn;
  btn.replaceWith(btn.cloneNode(true));
  els.spUpvoteBtn = document.getElementById("spUpvoteBtn");

  const serverRef = doc(db, "servers", serverId);
  const safeUpvotes = Number(serverData.upvotes || 0);

  els.spUpvotesPill.textContent = `${safeUpvotes.toLocaleString()} upvotes`;

  if (!currentUser) {
    els.spUpvoteBtn.textContent = "Sign in to upvote";
    els.spUpvoteBtn.disabled = true;
    return;
  }

  if (serverData.ownerUid === currentUser.uid) {
    els.spUpvoteBtn.textContent = "Own server";
    els.spUpvoteBtn.disabled = true;
    return;
  }

  const voteRef = doc(db, "servers", serverId, "votes", currentUser.uid);

  async function syncVoteButtonState() {
    try {
      const voteSnap = await getDoc(voteRef);

      if (voteSnap.exists()) {
        els.spUpvoteBtn.textContent = "Remove vote";
      } else {
        els.spUpvoteBtn.textContent = "▲ Upvote";
      }

      els.spUpvoteBtn.disabled = false;
    } catch (err) {
      console.error("Failed to sync vote state:", err);
      els.spUpvoteBtn.textContent = "Vote unavailable";
      els.spUpvoteBtn.disabled = true;
    }
  }

  els.spUpvoteBtn.textContent = "Loading...";
  els.spUpvoteBtn.disabled = true;

  syncVoteButtonState();

  els.spUpvoteBtn.addEventListener("click", async () => {
    try {
      els.spUpvoteBtn.disabled = true;

      const result = await runTransaction(db, async (tx) => {
        const [serverSnap, voteSnap] = await Promise.all([
          tx.get(serverRef),
          tx.get(voteRef)
        ]);

        if (!serverSnap.exists()) {
          throw new Error("Server does not exist.");
        }

        const currentUpvotes = Number(serverSnap.data()?.upvotes || 0);

        if (voteSnap.exists()) {
          tx.delete(voteRef);
          tx.update(serverRef, {
            upvotes: Math.max(0, currentUpvotes - 1)
          });

          return {
            voted: false,
            upvotes: Math.max(0, currentUpvotes - 1)
          };
        }

        tx.set(voteRef, {
          uid: currentUser.uid,
          serverId,
          createdAt: serverTimestamp()
        });

        tx.update(serverRef, {
          upvotes: currentUpvotes + 1
        });

        return {
          voted: true,
          upvotes: currentUpvotes + 1
        };
      });

      serverData.upvotes = result.upvotes;
      els.spUpvotesPill.textContent = `${Number(result.upvotes || 0).toLocaleString()} upvotes`;
      els.spUpvoteBtn.textContent = result.voted ? "Remove vote" : "▲ Upvote";
      els.spUpvoteBtn.disabled = false;
    } catch (err) {
      console.error("Failed to toggle vote:", err);
      els.spUpvoteBtn.textContent = "Vote failed";
      setTimeout(() => {
        syncVoteButtonState();
      }, 900);
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
function wireMinecraftVoteButton(serverData, currentUser) {
  if (!els.spVoteBtn || !els.spVoteUsername || !els.spVoteMsg || !els.spVotesPill) return;

  const btn = els.spVoteBtn;
  const newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);
  els.spVoteBtn = newBtn;

  const totalVotes = Number(serverData.totalVotes || 0);
  els.spVotesPill.textContent = `${totalVotes.toLocaleString()} votes`;
  els.spVoteMsg.textContent = "";

  if (!serverData.votingEnabled) {
    els.spVoteBtn.disabled = true;
    els.spVoteBtn.textContent = "Voting unavailable";
    els.spVoteMsg.textContent = "This server has not enabled BlockClub voting yet.";
    return;
  }

  els.spVoteBtn.disabled = false;
  els.spVoteBtn.textContent = "Vote";

  els.spVoteBtn.addEventListener("click", async () => {
    const minecraftUsername = String(els.spVoteUsername.value || "").trim();

    if (!minecraftUsername) {
      els.spVoteMsg.textContent = "Enter your Minecraft username first.";
      return;
    }

    if (!currentUser) {
      els.spVoteMsg.textContent = "You need to be signed in before voting.";
      return;
    }

    try {
      els.spVoteBtn.disabled = true;
      els.spVoteBtn.textContent = "Voting...";
      els.spVoteMsg.textContent = "";

      const res = await fetch("https://us-central1-blockclub-4742a.cloudfunctions.net/vote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          serverId,
          minecraftUsername
        })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        els.spVoteMsg.textContent = data?.error || "Vote failed.";
        els.spVoteBtn.disabled = false;
        els.spVoteBtn.textContent = "Vote";
        return;
      }

      const nextTotalVotes =
        typeof data?.totalVotes === "number"
          ? data.totalVotes
          : Number(serverData.totalVotes || 0) + 1;

      serverData.totalVotes = nextTotalVotes;
      els.spVotesPill.textContent = `${nextTotalVotes.toLocaleString()} votes`;
      els.spVoteMsg.textContent = "Vote submitted successfully.";
      els.spVoteUsername.value = "";

      els.spVoteBtn.disabled = false;
      els.spVoteBtn.textContent = "Vote";
    } catch (err) {
      console.error("Vote request failed:", err);
      els.spVoteMsg.textContent = "Vote failed. Please try again.";
      els.spVoteBtn.disabled = false;
      els.spVoteBtn.textContent = "Vote";
    }
  });
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
  const activeTheme = normalizeTheme(pageData?.meta?.theme || serverData.theme || "emerald");
  applyTheme(activeTheme);
  const name = serverData.name || "Untitled Server";
  const ip = serverData.ip || "No IP listed";
  const status = previewMode
    ? "preview"
    : (serverData.status || (serverData.isPublished ? "published" : "draft"));
  const mode = serverData.mode || "smp";
  const views = Number(serverData.views || 0);
  const upvotes = Number(serverData.upvotes || 0);
  const totalVotes = Number(serverData.totalVotes || 0);

  const playerCount =
    typeof serverData.playerCount === "number"
      ? serverData.playerCount
      : typeof serverData.players === "number"
      ? serverData.players
      : null;

  const maxPlayers =
    typeof serverData.maxPlayers === "number"
      ? serverData.maxPlayers
      : typeof serverData.playerMax === "number"
      ? serverData.playerMax
      : null;

  const players =
    typeof playerCount === "number" && typeof maxPlayers === "number"
      ? `${playerCount}/${maxPlayers} players`
      : typeof playerCount === "number"
      ? `${playerCount} players`
      : "—";

  document.title = `${name} | BlockClub`;

  if (els.spName) els.spName.textContent = name;
  if (els.spIp) els.spIp.textContent = ip;
  if (els.spStatusPill) els.spStatusPill.textContent = status;
  if (els.spModePill) els.spModePill.textContent = mode;
  if (els.spViewsPill) els.spViewsPill.textContent = `${views.toLocaleString()} views`;
  if (els.spPlayersPill) els.spPlayersPill.textContent = players;
  if (els.spUpvotesPill) els.spUpvotesPill.textContent = `${upvotes.toLocaleString()} upvotes`;
  if (els.spDesc) els.spDesc.textContent = serverData.description || "No description yet.";
  if (els.spVotesPill) els.spVotesPill.textContent = `${totalVotes.toLocaleString()} votes`;

  renderBanner(serverData);
  renderTags(serverData.tags);
  renderPublishedPage(pageData);
  wireCopyIp(serverData.ip || "");
  wireUpvoteButton(serverData, currentViewer);
  loadFeaturedBlockClubCard();
  wireMinecraftVoteButton(serverData, currentViewer);
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
  currentViewer = currentUser;
  currentServerData = serverData;
  const isPublished = !!serverData.isPublished;
  const isOwner = !!currentUser && serverData.ownerUid === currentUser.uid;

  if (!isPublished && !(previewMode && isOwner)) {
    showNotFound("This server page is not published.");
    return;
  }

  const publishedPageData = pageSnap.exists()
    ? pageSnap.data() || {}
    : { blocks: [], decorations: [] };

  let pageData = publishedPageData;

  if (previewMode) {
    if (!isOwner) {
      showNotFound("Only the owner can view preview mode.");
      return;
    }

    const draftPageData = loadDraftPageData(serverId);
    console.log("Preview draftPageData:", draftPageData);

    if (draftPageData) {
      pageData = draftPageData;
    }
  }

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
window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    console.log("Page restored → forcing fresh auth sync");

    onAuthStateChanged(auth, (user) => {
      loadServerPage(user).catch((err) => {
        console.error(err);
      });
    });
  }
});

function rehydrateServerPage() {
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    unsubscribe();

    loadServerPage(user).catch((err) => {
      console.error(err);
      showNotFound(err.message || "Unknown error while loading the page.");
    });
  });
}

rehydrateServerPage();