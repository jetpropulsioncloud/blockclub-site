const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { sendVote } = require("@hytaleone/votifier");

admin.initializeApp();

function applyCors(req, res) {
  const allowedOrigins = [
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "https://blockclub-4742a.web.app",
    "https://blockclub-4742a.firebaseapp.com"
  ];

  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
  }

  res.set("Vary", "Origin");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
}

exports.vote = functions.https.onRequest(async (req, res) => {
  applyCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).send("");
  }

  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { serverId, minecraftUsername } = req.body || {};

    if (!serverId || !minecraftUsername) {
      return res.status(400).json({ error: "Missing serverId or minecraftUsername" });
    }

    const cleanUsername = String(minecraftUsername).trim();

    if (!cleanUsername) {
      return res.status(400).json({ error: "Minecraft username is required" });
    }

    const db = admin.firestore();
    const serverRef = db.collection("servers").doc(serverId);
    const configRef = serverRef.collection("private").doc("config");

    const [serverSnap, configSnap] = await Promise.all([
      serverRef.get(),
      configRef.get()
    ]);

    if (!serverSnap.exists) {
      return res.status(404).json({ error: "Server not found" });
    }

    const serverData = serverSnap.data() || {};

    if (!serverData.votingEnabled) {
      return res.status(400).json({ error: "Voting is disabled for this server" });
    }

    if (!configSnap.exists) {
      return res.status(400).json({ error: "Voting config not found" });
    }

    const config = configSnap.data() || {};

    const votifierHost = String(config.votifierHost || "").trim();
    const votifierPort = Number(config.votifierPort || 8192);
    const votifierToken = String(config.votifierToken || "").trim();
    const votifierServiceName = String(config.votifierServiceName || "blockclub").trim();
    const voteCooldownHours = Number(config.voteCooldownHours || 24);

    if (!votifierHost || !votifierPort || !votifierToken) {
      return res.status(400).json({ error: "Votifier config is incomplete" });
    }

    const now = Date.now();
    const cooldownMs = voteCooldownHours * 60 * 60 * 1000;

    const existingVotesSnap = await serverRef
      .collection("votes")
      .where("minecraftUsername", "==", cleanUsername)
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();

    if (!existingVotesSnap.empty) {
      const lastVote = existingVotesSnap.docs[0].data() || {};
      const lastVoteMs = lastVote.createdAt?.toMillis?.() || 0;

      if (lastVoteMs && now - lastVoteMs < cooldownMs) {
        const hoursRemaining = Math.ceil((cooldownMs - (now - lastVoteMs)) / (1000 * 60 * 60));
        return res.status(429).json({
          error: `You already voted recently. Try again in about ${hoursRemaining} hour(s).`
        });
      }
    }

    const voteResult = await sendVote({
      server: {
        protocol: "v2",
        host: votifierHost,
        port: votifierPort,
        token: votifierToken,
        timeout: 5000
      },
      vote: {
        username: cleanUsername,
        serviceName: votifierServiceName,
        address: req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || req.ip || "127.0.0.1",
        timestamp: now
      }
    });

    if (!voteResult.success) {
      console.error("NuVotifier delivery failed:", voteResult);
      return res.status(502).json({
        error: `Vote delivery failed: ${voteResult.message || "unknown error"}`
      });
    }

    const voteRef = serverRef.collection("votes").doc();

    await voteRef.set({
      minecraftUsername: cleanUsername,
      source: "blockclub",
      delivered: true,
      deliveredAt: admin.firestore.FieldValue.serverTimestamp(),
      failureReason: null,
      protocol: "v2",
      serviceName: votifierServiceName,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await serverRef.update({
      totalVotes: admin.firestore.FieldValue.increment(1),
      lastVoteAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return res.status(200).json({
      ok: true,
      totalVotes: Number(serverData.totalVotes || 0) + 1
    });
  } catch (err) {
    console.error("vote endpoint failed:", err);
    return res.status(500).json({ error: err?.message || "Internal server error" });
  }
});

exports.testVote = functions.https.onRequest(async (req, res) => {
  applyCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).send("");
  }

  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { serverId } = req.body || {};

    if (!serverId) {
      return res.status(400).json({ error: "Missing serverId" });
    }

    const db = admin.firestore();
    const serverRef = db.collection("servers").doc(serverId);
    const configRef = serverRef.collection("private").doc("config");

    const [serverSnap, configSnap] = await Promise.all([
      serverRef.get(),
      configRef.get()
    ]);

    if (!serverSnap.exists) {
      return res.status(404).json({ error: "Server not found" });
    }

    if (!configSnap.exists) {
      return res.status(404).json({ error: "Voting config not found" });
    }

    const config = configSnap.data() || {};

    if (!config.votingEnabled) {
      return res.status(400).json({ error: "Voting is disabled for this server" });
    }

    const host = String(config.votifierHost || "").trim();
    const port = Number(config.votifierPort || 8192);
    const token = String(config.votifierToken || "").trim();
    const serviceName = String(config.votifierServiceName || "blockclub").trim();

    if (!host || !port || !token) {
      return res.status(400).json({ error: "Incomplete voting config" });
    }

    const voteResult = await sendVote({
      server: {
        protocol: "v2",
        host,
        port,
        token,
        timeout: 5000
      },
      vote: {
        username: "TestVoteUser",
        serviceName,
        address: "127.0.0.1",
        timestamp: Date.now()
      }
    });

    if (!voteResult.success) {
      console.error("Test vote delivery failed:", voteResult);
      return res.status(502).json({
        error: `Test vote delivery failed: ${voteResult.message || "unknown error"}`
      });
    }

    return res.status(200).json({
      ok: true,
      message: "Test vote sent successfully."
    });
  } catch (err) {
    console.error("testVote failed:", err);
    return res.status(500).json({
      error: err?.message || "Test vote failed."
    });
  }
});