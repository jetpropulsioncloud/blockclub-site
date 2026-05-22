const admin = require("firebase-admin");

const serviceAccount = require("../serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const seedServers = [
  {
    id: "seed-hypixel",
    name: "Hypixel",
    ip: "mc.hypixel.net",
    description: "A large public Minecraft network known for minigames, SkyBlock, Bed Wars, and SkyWars.",
    tags: ["Minigames", "SkyBlock", "Bed Wars", "SkyWars"],
    theme: "royal"
  },
  {
    id: "seed-minecraft-central",
    name: "Minecraft Central",
    ip: "mccentral.org",
    description: "A classic public Minecraft network with survival, skyblock, prison, and minigame modes.",
    tags: ["Survival", "Skyblock", "Prison", "Minigames"],
    theme: "royal"
  },
  {
    id: "seed-cubecraft",
    name: "CubeCraft",
    ip: "play.cubecraft.net",
    description: "A public Minecraft minigame network known for fast casual game modes.",
    tags: ["Minigames", "SkyWars", "EggWars"],
    theme: "royal"
  },
  {
    id: "seed-manacube",
    name: "ManaCube",
    ip: "mc.manacube.com",
    description: "A public Minecraft network with skyblock, parkour, prison, earth, and factions-style gameplay.",
    tags: ["Skyblock", "Parkour", "Prison", "Earth", "Factions"],
    theme: "royal"
  },
  {
    id: "seed-opblocks",
    name: "OPBlocks",
    ip: "play.opblocks.com",
    description: "A public Minecraft network with prison, skyblock, survival, and related game modes.",
    tags: ["Prison", "Skyblock", "Survival", "Pixelmon"],
    theme: "royal"
  },
  {
    id: "seed-complex-gaming",
    name: "Complex Gaming",
    ip: "hub.mc-complex.com",
    description: "A public Minecraft network with modded, Pixelmon, vanilla, and survival-style servers.",
    tags: ["Pixelmon", "Modded", "Survival", "Vanilla"],
    theme: "royal"
  },
  {
    id: "seed-earthmc",
    name: "EarthMC",
    ip: "join.earthmc.net",
    description: "A public Earth-style Minecraft server focused on towny, economy, nations, and geopolitics.",
    tags: ["Earth", "Towny", "Economy", "Geopolitics"],
    theme: "royal"
  },
  {
    id: "seed-minehut",
    name: "Minehut",
    ip: "mc.minehut.com",
    description: "A public Minecraft server hub where players can join and create community servers.",
    tags: ["Server Hub", "SMP", "Creative", "PvP"],
    theme: "royal"
  },
  {
    id: "seed-applemc",
    name: "AppleMC",
    ip: "applemc.fun",
    description: "A public Minecraft network with lifesteal, earth SMP, PvP, and related modes.",
    tags: ["Lifesteal", "Earth SMP", "FFA", "PvP"],
    theme: "royal"
  },
  {
    id: "seed-donutsmp",
    name: "DonutSMP",
    ip: "donutsmp.net",
    description: "A public Minecraft SMP-style network with PvP, survival, and economy elements.",
    tags: ["SMP", "PvP", "Survival", "Lifesteal"],
    theme: "royal"
  },
  {
    id: "seed-wynncraft",
    name: "Wynncraft",
    ip: "play.wynncraft.com",
    description: "A public Minecraft MMORPG server with quests, classes, fantasy zones, and RPG progression.",
    tags: ["MMORPG", "RPG", "Quests", "Fantasy"],
    theme: "royal"
  }
];

async function seedPublicServers() {
  const now = admin.firestore.FieldValue.serverTimestamp();

  for (const server of seedServers) {
    const ref = db.collection("serverPages").doc(server.id);

    await ref.set(
      {
        name: server.name,
        ip: server.ip,
        description: server.description,
        tags: server.tags,
        theme: server.theme,

        bannerUrl: "",
        logoUrl: "",

        isPublished: true,
        votingEnabled: true,

        upvotes: 0,
        views: 0,

        ownerUid: null,

        claimStatus: "unclaimed",
        listingType: "public_seed",
        isPublicSeed: true,
        isClaimable: true,

        createdAt: now,
        updatedAt: now,
        pagePublishedAt: now
      },
      { merge: true }
    );

    console.log(`Seeded ${server.name}`);
  }

  console.log("Done seeding public servers into serverPages.");
}

seedPublicServers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });