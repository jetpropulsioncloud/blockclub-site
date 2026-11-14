// Browser-level Phase 1 smoke test against demo Firebase emulators.
// Requires Playwright, Chromium, and Firebase emulators:exec.
// This script must NEVER use production Firebase credentials or endpoints.
"use strict";

const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const ORIGIN = "http://127.0.0.1:5000";
const TEST_PROJECT = "demo-blockclub-e2e";
const EMAIL = "phase1-e2e-" + Date.now() + "@example.test";
const USERNAME = "phase1e2e" + Date.now().toString().slice(-8);
const PASSWORD = "phase1-test-password-2026";
const INITIAL_NAME = "BlockClub Phase 1 Integration";
const EDITED_NAME = "BlockClub Phase 1 Integration Updated";
// Valid 1x1 PNG, used only against the local Storage emulator.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+sBKcAAAAASUVORK5CYII=",
  "base64"
);

async function readServers(page) {
  return page.evaluate(async () => {
    const { db } = await import("/firebase.js");
    const { collection, getDocs } = await import(
      "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js"
    );
    const snap = await getDocs(collection(db, "servers"));
    return snap.docs.map((doc) => ({
      id: doc.id,
      name: doc.data().name,
      ownerUid: doc.data().ownerUid,
      ip: doc.data().ip,
      iconUrl: doc.data().iconUrl,
      isPublished: doc.data().isPublished,
    }));
  });
}

async function readPage(page, serverId) {
  return page.evaluate(async (id) => {
    const { db } = await import("/firebase.js");
    const { doc, getDoc } = await import(
      "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js"
    );
    const snapshot = await getDoc(doc(db, "servers", id, "pages", "main"));
    if (!snapshot.exists()) return null;
    const data = snapshot.data();
    return {
      version: data.version,
      blocks: data.blocks?.length,
      pages: data.pages?.length,
      canvasBackgroundUrl: data.meta?.canvasBackgroundUrl,
      iconUrl: data.meta?.iconUrl,
    };
  }, serverId);
}

async function run() {
  if (!String(process.env.FIRESTORE_EMULATOR_HOST || "").includes("8080") ||
      !String(process.env.FIREBASE_AUTH_EMULATOR_HOST || "").includes("9099")) {
    throw new Error("Refusing browser test without local Firebase Auth/Firestore emulator environment.");
  }

  const browser = await chromium.launch({ headless: true });
  let context;
  try {
    context = await browser.newContext();
    // No request from these tests may reach a production BlockClub function.
    let blockedProductionCalls = 0;
    await context.route("**/us-central1-blockclub-4742a.cloudfunctions.net/**", async (route) => {
      blockedProductionCalls++;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Production endpoint intentionally disabled in integration tests." }),
      });
    });

    const page = await context.newPage();
    page.setDefaultTimeout(25_000);
    const pageErrors = [];
    page.on("pageerror", (err) => {
      pageErrors.push(page.url() + ": " + err.message);
    });
    page.on("dialog", async (dialog) => {
      await dialog.accept(dialog.type() === "prompt" ? USERNAME : undefined);
    });

    await page.goto(ORIGIN + "/index.html", { waitUntil: "domcontentloaded" });
    const projectId = await page.evaluate(async () => {
      const { app } = await import("/firebase.js");
      return app.options.projectId;
    });
    assert.equal(projectId, TEST_PROJECT, "Browser must use demo Firebase project, never production");
    console.log("PASS: Browser Firebase project is isolated demo project");

    await page.locator("#btnOpenAuth").click();
    await page.locator("#btnSwitchToRegister").click();
    await page.locator("#authIdentifier").fill(EMAIL);
    await page.locator("#authPassword").fill(PASSWORD);
    await page.locator("#btnLogin").click();
    await page.waitForFunction(() =>
      document.querySelector("#userLabel")?.textContent?.startsWith("@phase1e2e")
    ).catch(async (error) => {
      const detail = await page.evaluate(async () => {
        const { auth, db } = await import("/firebase.js");
        const { doc, getDoc } = await import(
          "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js"
        );
        const uid = auth.currentUser?.uid || null;
        const profile = uid ? await getDoc(doc(db, "users", uid)).catch(() => null) : null;
        return {
          uid,
          username: profile?.exists() ? profile.data()?.username : null,
          authMessage: document.querySelector("#authMsg")?.textContent,
          userLabel: document.querySelector("#userLabel")?.textContent
        };
      });
      throw new Error("Registration UI did not settle: " + JSON.stringify(detail) + " / " + error.message);
    });
    const userId = await page.evaluate(async () => {
      const { auth } = await import("/firebase.js");
      return auth.currentUser?.uid;
    });
    assert.ok(userId, "Registration should create an authenticated user");
    console.log("PASS: Register and authenticate using local Auth emulator");

    await page.goto(ORIGIN + "/builder.html", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() =>
      window.bcAuth?.currentUser && document.body.dataset.builderReady === "true" && document.querySelector("#serverIpInput")?.disabled === false
    );
    await page.locator("#serverNameInput").fill(INITIAL_NAME);
    await page.locator("#serverIpInput").fill("play.phase1-example.test");
    await page.locator("#publishBtn").click();
    await page.waitForFunction(() => new URL(location.href).searchParams.has("serverId"));
    const serverId = new URL(page.url()).searchParams.get("serverId");
    assert.ok(serverId, "First publish should place new server ID in address bar");

    let docs = await readServers(page);
    assert.equal(docs.length, 1, "One listing expected after first publish");
    assert.equal(docs[0].id, serverId);
    assert.equal(docs[0].name, INITIAL_NAME);
    assert.equal(docs[0].ownerUid, userId);
    assert.equal(docs[0].isPublished, true);
    assert.ok(await readPage(page, serverId), "Published page document must exist");
    await page.locator("#closeExport").click();
    console.log("PASS: First publish writes real Firestore emulator documents");

    // Verify multiple same-session publishes update the same listing ID.
    await page.locator("#publishBtn").click();
    docs = await readServers(page);
    assert.equal(docs.length, 1, "Repeated publish must not create a duplicate listing");
    await page.locator("#closeExport").click();
    console.log("PASS: Re-publish in the same session keeps one server listing");

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() =>
      window.bcAuth?.currentUser && document.body.dataset.builderReady === "true" && document.querySelector("#serverIpInput")?.disabled === true
    );
    assert.equal(await page.locator("#serverNameInput").inputValue(), INITIAL_NAME);
    await page.locator("#serverNameInput").fill(EDITED_NAME);

    // Exercise actual browser image conversion, authenticated Storage upload, and URL persistence.
    await page.locator("#serverIconInput").setInputFiles({
      name: "phase1-test.png",
      mimeType: "image/png",
      buffer: PNG,
    });
    await page.waitForFunction(() => {
      const image = document.querySelector(".server-mini .server-icon img");
      return image && image.src.includes(":9199/");
    });
    await page.locator("#publishBtn").click();
    await page.locator("#exportDialog").waitFor({ state: "visible" });
    docs = await readServers(page);
    assert.equal(docs.length, 1, "Edit should keep the same server ID");
    assert.equal(docs[0].name, EDITED_NAME);
    assert.ok(docs[0].iconUrl?.includes(":9199/"), "Uploaded icon should point at local Storage emulator");
    assert.ok((await readPage(page, serverId)).iconUrl?.includes(":9199/"));
    console.log("PASS: Reload, edit, upload icon to Storage emulator, and re-publish");

    await page.goto(ORIGIN + "/server.html?serverId=" + encodeURIComponent(serverId));
    await page.waitForFunction((name) => document.querySelector("#spName")?.textContent === name, EDITED_NAME);
    assert.equal(await page.locator("#spIp").textContent(), "play.phase1-example.test");
    console.log("PASS: Public server page reads newly published content");

    await page.goto(ORIGIN + "/index.html");
    await page.waitForFunction((name) => document.querySelector("#serverGrid")?.textContent?.includes(name), EDITED_NAME);
    await page.locator("#btnLogout").click();
    await page.waitForFunction(() => document.querySelector("#btnOpenAuth")?.style.display === "inline-flex");
    await page.locator("#btnOpenAuth").click();
    await page.locator("#authIdentifier").fill(EMAIL);
    await page.locator("#authPassword").fill(PASSWORD);
    await page.locator("#btnLogin").click();
    await page.waitForFunction(() => document.querySelector("#userLabel")?.textContent?.startsWith("@phase1e2e"));
    console.log("PASS: Homepage listing and logout/login round trip");

    assert.deepEqual(pageErrors, [], "No uncaught browser-side JavaScript errors should occur");
    console.log("PASS: No uncaught browser JavaScript errors");
    if (blockedProductionCalls) {
      console.log("INFO: Blocked " + blockedProductionCalls + " attempted production status-function request(s)");
    }
    console.log("Browser emulator smoke test passed without accessing production Firebase.");
  } finally {
    if (context) await context.close();
    await browser.close();
  }
}

run().catch((error) => {
  console.error("Browser emulator smoke test failed:", error);
  process.exitCode = 1;
});
