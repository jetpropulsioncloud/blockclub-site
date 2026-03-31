const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

exports.vote = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

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

    const voteRef = serverRef.collection("votes").doc();

    await voteRef.set({
      minecraftUsername: cleanUsername,
      source: "blockclub",
      delivered: false,
      deliveredAt: null,
      failureReason: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await serverRef.update({
      totalVotes: admin.firestore.FieldValue.increment(1),
      lastVoteAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return res.status(200).json({
      ok: true
    });
  } catch (err) {
    console.error("vote endpoint failed:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});