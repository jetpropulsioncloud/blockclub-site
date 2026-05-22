const admin = require("firebase-admin");

const serviceAccount = require("../serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function testSeed() {
  console.log("Project ID:", serviceAccount.project_id);

  const now = admin.firestore.FieldValue.serverTimestamp();

  await db.collection("servers").doc("seed-hypixel").set(
    {
      name: "Hypixel",
      ip: "mc.hypixel.net",
      description: "A large public Minecraft network known for minigames, SkyBlock, Bed Wars, and SkyWars.",
      tags: ["Minigames", "SkyBlock", "Bed Wars", "SkyWars"],
      theme: "royal",
      bannerUrl: "",
      isPublished: true,
      votingEnabled: true,
      ownerUid: null,
      upvotes: 0,
      views: 0,
      createdAt: now,
      updatedAt: now,
      pagePublishedAt: now,
      claimStatus: "unclaimed",
      listingType: "public_seed",
      isPublicSeed: true,
      isClaimable: true
    },
    { merge: true }
  );

  console.log("Wrote test doc to: servers/seed-hypixel");
}

testSeed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });