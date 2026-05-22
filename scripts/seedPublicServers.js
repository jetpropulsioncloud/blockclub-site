const admin = require("firebase-admin");

const serviceAccount = require("../serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const seedServers = [
  {
    name: "Hypixel",
    slug: "hypixel",
    ip: "mc.hypixel.net",
    edition: "Java",
    description: "A large public Minecraft network known for minigames, SkyBlock, Bed Wars, and SkyWars.",
    tags: ["Minigames", "SkyBlock", "Bed Wars", "SkyWars"]
  },
  {
    name: "Minecraft Central",
    slug: "minecraft-central",
    ip: "mccentral.org",
    altIp: "mc-central.net",
    edition: "Java",
    description: "A classic public Minecraft network with survival, skyblock, prison, and minigame modes.",
    tags: ["Survival", "Skyblock", "Prison", "Minigames"]
  },
  {
    name: "CubeCraft",
    slug: "cubecraft",
    ip: "play.cubecraft.net",
    edition: "Java",
    description: "A public Minecraft minigame network known for fast casual game modes.",
    tags: ["Minigames", "SkyWars", "EggWars"]
  },
  {
    name: "ManaCube",
    slug: "manacube",
    ip: "mc.manacube.com",
    edition: "Java / Bedrock",
    description: "A public Minecraft network with skyblock, parkour, prison, earth, and factions-style gameplay.",
    tags: ["Skyblock", "Parkour", "Prison", "Earth", "Factions"]
  },
  {
    name: "OPBlocks",
    slug: "opblocks",
    ip: "play.opblocks.com",
    bedrockIp: "bedrock.opblocks.com:19132",
    edition: "Java / Bedrock",
    description: "A public Minecraft network with prison, skyblock, survival, and related game modes.",
    tags: ["Prison", "Skyblock", "Survival", "Pixelmon"]
  },
  {
    name: "Complex Gaming",
    slug: "complex-gaming",
    ip: "hub.mc-complex.com",
    edition: "Java",
    description: "A public Minecraft network with modded, Pixelmon, vanilla, and survival-style servers.",
    tags: ["Pixelmon", "Modded", "Survival", "Vanilla"]
  },
  {
    name: "EarthMC",
    slug: "earthmc",
    ip: "join.earthmc.net",
    edition: "Java",
    description: "A public Earth-style Minecraft server focused on towny, economy, nations, and geopolitics.",
    tags: ["Earth", "Towny", "Economy", "Geopolitics"]
  },
  {
    name: "Minehut",
    slug: "minehut",
    ip: "mc.minehut.com",
    bedrockIp: "bedrock.minehut.com",
    edition: "Java / Bedrock",
    description: "A public Minecraft server hub where players can join and create community servers.",
    tags: ["Server Hub", "SMP", "Creative", "PvP"]
  },
  {
    name: "AppleMC",
    slug: "applemc",
    ip: "applemc.fun",
    edition: "Java",
    description: "A public Minecraft network with lifesteal, earth SMP, PvP, and related modes.",
    tags: ["Lifesteal", "Earth SMP", "FFA", "PvP"]
  },
  {
    name: "DonutSMP",
    slug: "donutsmp",
    ip: "donutsmp.net",
    edition: "Java / Bedrock",
    description: "A public Minecraft SMP-style network with PvP, survival, and economy elements.",
    tags: ["SMP", "PvP", "Survival", "Lifesteal"]
  },
  {
    name: "Wynncraft",
    slug: "wynncraft",
    ip: "play.wynncraft.com",
    edition: "Java",
    description: "A public Minecraft MMORPG server with quests, classes, fantasy zones, and RPG progression.",
    tags: ["MMORPG", "RPG", "Quests", "Fantasy"]
  }
];

async function seedServersToFirestore() {
  const batch = db.batch();
  const now = admin.firestore.FieldValue.serverTimestamp();

  for (const server of seedServers) {
    const ref = db.collection("servers").doc(server.slug);
    const existingDoc = await ref.get();

    if (existingDoc.exists && existingDoc.data().claimStatus === "claimed") {
      console.log(`Skipped claimed server: ${server.name}`);
      continue;
    }

    batch.set(
      ref,
      {
        serverId: server.slug,
        name: server.name,
        slug: server.slug,
        ip: server.ip,
        altIp: server.altIp || "",
        bedrockIp: server.bedrockIp || "",
        edition: server.edition,
        description: server.description,
        tags: server.tags,
        claimStatus: "unclaimed",
        listingType: "public_seed",
        isPublicSeed: true,
        isClaimable: true,
        ownerUid: null,
        isPublished: true,
        upvotes: 0,
        views: 0,
        bannerUrl: "",
        logoUrl: "",
        theme: "royal",
        updatedAt: now,
        seededAt: now
      },
      { merge: true }
    );
  }

  await batch.commit();
  console.log(`Seeded ${seedServers.length} public server listings.`);
}

seedServersToFirestore()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });