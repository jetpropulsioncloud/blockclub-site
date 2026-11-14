// Phase 1 publishing regressions: no Firebase credentials or live writes needed.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "builder.js"), "utf8");

function extract(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, "Missing start marker: " + startMarker);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(end, -1, "Missing end marker: " + endMarker);
  return source.slice(start, end);
}

const publishSource = extract(
  "async function publishToFirebase(payload) {",
  "\nasync function handleBackgroundUpload("
);
const clickSource = extract(
  "let publishInProgress = false;\npublishBtn.addEventListener",
  "\ndocument.getElementById(\"serverNameInput\")?.addEventListener"
);

function createPublisher(initialId = null, initialOwner = "user-1") {
  const writes = [];
  const servers = new Map();
  if (initialId) {
    servers.set(initialId, { ownerUid: initialOwner, ip: "play.example.net" });
  }

  const firestore = {
    doc: (_db, ...segments) => ({
      id: segments[segments.length - 1],
      path: segments.join("/"),
    }),
    getDoc: async (ref) => {
      const data = servers.get(ref.id);
      return {
        exists: () => data !== undefined,
        data: () => data,
      };
    },
    setDoc: async (ref, data) => {
      writes.push({ path: ref.path, data });
      if (ref.path.startsWith("servers/") && ref.path.split("/").length === 2) {
        servers.set(ref.id, { ...servers.get(ref.id), ...data });
      }
    },
    serverTimestamp: () => "server-timestamp",
  };
  const elements = {
    serverNameInput: { value: "New Example Server" },
    serverIpInput: { value: "play.example.net" },
  };
  const context = {
    serverIdFromUrl: initialId,
    window: { bcDb: {}, bcStorage: {} },
    document: { getElementById: (id) => elements[id] || null },
    crypto: { randomUUID: () => "generated-id" },
    state: {
      meta: {
        description: "A friendly Minecraft community",
        descriptionHtml: "<p>Welcome!</p>",
        tags: ["SMP"],
        theme: "emerald",
        iconUrl: "",
        iconStoragePath: "",
      },
      activePageId: "home",
    },
    waitForFirebaseReady: async () => true,
    waitForAuthUser: async () => ({ uid: "user-1" }),
    loadFirebase: async () => ({
      firestore,
      storage: { ref: (_storage, storagePath) => ({ path: storagePath }) },
    }),
    syncActivePageFromCanvas: () => {},
    prepareBlocksForPublish: async (blocks) => blocks,
    preparePageBackgroundsForPublish: async (page) => ({
      canvasBackgroundUrl: page.canvasBackgroundUrl,
      shellBackgroundUrl: page.shellBackgroundUrl,
      pageBackgroundUrl: page.pageBackgroundUrl,
    }),
    compressToWebp: async () => { throw new Error("Unexpected conversion"); },
    uploadBlobAndGetUrl: async () => { throw new Error("Unexpected upload"); },
    normalizeTheme: (theme) => theme,
    localStorage: { setItem: () => {} },
    replaceUrlServerId: (id) => { context.serverIdFromUrl = id; },
    renderServerIcon: () => {},
    syncCustomThemeControls: () => {},
    applyCanvasBackground: () => {},
    lockIpField: () => {},
    cleanupUnusedDraftImages: async () => {},
    console: { log: () => {}, warn: () => {} },
  };

  const publish = vm.runInNewContext(publishSource + "\npublishToFirebase;", context);
  const payload = {
    activePageId: "home",
    pages: [{
      id: "home",
      title: "Home",
      blocks: [{ id: "welcome", type: "text", html: "Hello" }],
      decorations: [],
      canvasBackgroundUrl: "https://example.org/canvas.webp",
      shellBackgroundUrl: "https://example.org/shell.webp",
      pageBackgroundUrl: "https://example.org/page.webp",
    }],
  };
  return { publish, payload, writes, servers, context, elements };
}

test("new listing publishes server and page with all background URLs", async () => {
  const run = createPublisher();
  const result = await run.publish(run.payload);

  assert.equal(result.serverId, "generated-id");
  assert.equal(run.writes.length, 2);
  const server = run.writes.find((entry) => entry.path === "servers/generated-id");
  const page = run.writes.find((entry) => entry.path === "servers/generated-id/pages/main");
  assert.ok(server);
  assert.ok(page);
  assert.equal(server.data.ownerUid, "user-1");
  assert.equal(server.data.ip, "play.example.net");
  assert.equal(server.data.isPublished, true);
  assert.equal(page.data.meta.canvasBackgroundUrl, "https://example.org/canvas.webp");
  assert.equal(page.data.meta.shellBackgroundUrl, "https://example.org/shell.webp");
  assert.equal(page.data.meta.pageBackgroundUrl, "https://example.org/page.webp");
});

test("second publish in same session edits existing listing rather than duplicating it", async () => {
  const run = createPublisher();
  await run.publish(run.payload);
  await run.publish(run.payload);
  assert.deepEqual([...run.servers.keys()], ["generated-id"]);
  assert.equal(run.writes.filter((write) => write.path === "servers/generated-id").length, 2);
  assert.equal(run.context.serverIdFromUrl, "generated-id");
});

test("publishing someone else's server is rejected before any write", async () => {
  const run = createPublisher("not-owned", "another-user");
  await assert.rejects(run.publish(run.payload), /do not own/);
  assert.equal(run.writes.length, 0);
});

test("two rapid publish clicks execute only one publication and restore the button", async () => {
  let onClick;
  let resolvePublish;
  let publishCalls = 0;
  const pending = new Promise((resolve) => { resolvePublish = resolve; });
  const button = {
    disabled: false,
    addEventListener: (name, callback) => {
      assert.equal(name, "click");
      onClick = callback;
    },
  };
  const context = {
    publishBtn: button,
    buildPublishPayload: () => ({ pages: [] }),
    publishToFirebase: async () => {
      publishCalls++;
      await pending;
      return { serverId: "example", bannerUrl: "" };
    },
    exportArea: { value: "" },
    exportDialog: { showModal: () => {} },
    alert: () => {},
    console: { error: () => {} },
  };
  vm.runInNewContext(clickSource, context);

  const first = onClick();
  const second = onClick();
  assert.equal(publishCalls, 1);
  assert.equal(button.disabled, true);

  resolvePublish();
  await Promise.all([first, second]);
  assert.equal(publishCalls, 1);
  assert.equal(button.disabled, false);
});

test("failed publish unlocks the button so the user can retry", async () => {
  let onClick;
  let alerts = 0;
  const button = {
    disabled: false,
    addEventListener: (_, callback) => { onClick = callback; },
  };
  const context = {
    publishBtn: button,
    buildPublishPayload: () => ({ pages: [] }),
    publishToFirebase: async () => { throw new Error("test failure"); },
    exportArea: { value: "" },
    exportDialog: { showModal: () => {} },
    alert: () => { alerts++; },
    console: { error: () => {} },
  };
  vm.runInNewContext(clickSource, context);
  await onClick();
  assert.equal(button.disabled, false);
  assert.equal(alerts, 1);
});
