const admin = require("firebase-admin");

const serviceAccount = require("../serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const SERVER_STATUS_ENDPOINT = "https://us-central1-blockclub-4742a.cloudfunctions.net/serverStatus";

const seedServers = [
  {
    id: "seed-hypixel",
    name: "Hypixel",
    ip: "mc.hypixel.net",
    edition: "Java",
    mode: "minigames",
    description: "A large public Minecraft network known for minigames, SkyBlock, Bed Wars, and SkyWars.",
    tags: ["Minigames", "SkyBlock", "Bed Wars", "SkyWars"]
  },
  {
    id: "seed-minecraft-central",
    name: "Minecraft Central",
    ip: "mccentral.org",
    edition: "Java",
    mode: "network",
    description: "A classic public Minecraft network with survival, skyblock, prison, and minigame modes.",
    tags: ["Survival", "Skyblock", "Prison", "Minigames"]
  },
  {
    id: "seed-cubecraft",
    name: "CubeCraft",
    ip: "play.cubecraft.net",
    edition: "Java",
    mode: "minigames",
    description: "A public Minecraft minigame network known for fast casual game modes.",
    tags: ["Minigames", "SkyWars", "EggWars"]
  },
  {
    id: "seed-manacube",
    name: "ManaCube",
    ip: "mc.manacube.com",
    edition: "Java",
    mode: "network",
    description: "A public Minecraft network with skyblock, parkour, prison, earth, and factions-style gameplay.",
    tags: ["Skyblock", "Parkour", "Prison", "Earth", "Factions"]
  },
  {
    id: "seed-opblocks",
    name: "OPBlocks",
    ip: "play.opblocks.com",
    edition: "Java",
    mode: "prison",
    description: "A public Minecraft network with prison, skyblock, survival, and related game modes.",
    tags: ["Prison", "Skyblock", "Survival"]
  },
  {
    id: "seed-complex-gaming",
    name: "Complex Gaming",
    ip: "hub.mc-complex.com",
    edition: "Java",
    mode: "modded",
    description: "A public Minecraft network with modded, Pixelmon, vanilla, and survival-style servers.",
    tags: ["Pixelmon", "Modded", "Survival", "Vanilla"]
  },
  {
    id: "seed-earthmc",
    name: "EarthMC",
    ip: "join.earthmc.net",
    edition: "Java",
    mode: "towny",
    description: "A public Earth-style Minecraft server focused on towny, economy, nations, and geopolitics.",
    tags: ["Earth", "Towny", "Economy", "Geopolitics"]
  },
  {
    id: "seed-minehut",
    name: "Minehut",
    ip: "mc.minehut.com",
    edition: "Java",
    mode: "network",
    description: "A public Minecraft server hub where players can join and create community servers.",
    tags: ["Server Hub", "SMP", "Creative", "PvP"]
  },
  {
    id: "seed-applemc",
    name: "AppleMC",
    ip: "applemc.fun",
    edition: "Java",
    mode: "lifesteal",
    description: "A public Minecraft network with lifesteal, earth SMP, PvP, and related modes.",
    tags: ["Lifesteal", "Earth SMP", "FFA", "PvP"]
  },
  {
    id: "seed-donutsmp",
    name: "DonutSMP",
    ip: "donutsmp.net",
    edition: "Java",
    mode: "smp",
    description: "A public Minecraft SMP-style network with PvP, survival, and economy elements.",
    tags: ["SMP", "PvP", "Survival", "Lifesteal"]
  },
  {
    id: "seed-wynncraft",
    name: "Wynncraft",
    ip: "play.wynncraft.com",
    edition: "Java",
    mode: "rpg",
    description: "A public Minecraft MMORPG server with quests, classes, fantasy zones, and RPG progression.",
    tags: ["MMORPG", "RPG", "Quests", "Fantasy"]
  },
  {
    id: "seed-purple-prison",
    name: "Purple Prison",
    ip: "purpleprison.org",
    edition: "Java",
    mode: "prison",
    description: "A public Minecraft prison server with PvP, ranks, economy, and prison progression.",
    tags: ["Prison", "PvP", "Economy", "Ranks"]
  },
  {
    id: "seed-pikanetwork",
    name: "PikaNetwork",
    ip: "play.pika-network.net",
    edition: "Java",
    mode: "network",
    description: "A public Minecraft network with survival, skyblock, factions, prison, and minigame-style modes.",
    tags: ["Survival", "Skyblock", "Factions", "Prison"]
  },
  {
    id: "seed-jartexnetwork",
    name: "JartexNetwork",
    ip: "play.jartexnetwork.com",
    edition: "Java",
    mode: "network",
    description: "A public Minecraft network with skyblock, prison, survival, factions, and minigames.",
    tags: ["Skyblock", "Prison", "Survival", "Factions"]
  },
  {
    id: "seed-moxmc",
    name: "MoxMC",
    ip: "moxmc.net",
    edition: "Java",
    mode: "network",
    description: "A public Minecraft network with prison, survival, skyblock, and PvP-oriented game modes.",
    tags: ["Prison", "Survival", "Skyblock", "PvP"]
  },
  {
    id: "seed-lemoncloud",
    name: "LemonCloud",
    ip: "play.lemoncloud.org",
    edition: "Java",
    mode: "network",
    description: "A public Minecraft network with survival, skyblock, prison, and community-focused gameplay.",
    tags: ["Survival", "Skyblock", "Prison", "Economy"]
  },
  {
    id: "seed-mineheroes",
    name: "MineHeroes",
    ip: "play.mineheroes.org",
    edition: "Java",
    mode: "network",
    description: "A public Minecraft network with skyblock, prison, factions, and survival-style modes.",
    tags: ["Skyblock", "Prison", "Factions", "Survival"]
  },
  {
    id: "seed-pvpwars",
    name: "PvPWars",
    ip: "play.pvpwars.net",
    edition: "Java",
    mode: "pvp",
    description: "A public Minecraft server network focused on PvP, factions, skyblock, and competitive progression.",
    tags: ["PvP", "Factions", "Skyblock", "Competitive"]
  },
  {
    id: "seed-fadecloud",
    name: "FadeCloud",
    ip: "fadecloud.com",
    edition: "Java",
    mode: "network",
    description: "A public Minecraft network with prison, skyblock, survival, and economy-based progression.",
    tags: ["Prison", "Skyblock", "Survival", "Economy"]
  },
  {
    id: "seed-insanitycraft",
    name: "InsanityCraft",
    ip: "play.insanitycraft.net",
    edition: "Java",
    mode: "network",
    description: "A public Minecraft network with survival, skyblock, factions, and other multiplayer modes.",
    tags: ["Survival", "Skyblock", "Factions", "SMP"]
  }
];

function makeBlocks(server) {
  return [
    {
      id: server.id + "-title",
      type: "text",
      x: 0,
      y: 0,
      w: 12,
      h: 1,
      rot: 0,
      html: "<h1>" + server.name + "</h1>"
    },
    {
      id: server.id + "-description",
      type: "text",
      x: 0,
      y: 1,
      w: 12,
      h: 3,
      rot: 0,
      html:
        "<p>" +
        server.description +
        "</p><p><strong>IP:</strong> " +
        server.ip +
        "</p><p><em>Unclaimed public listing. Own this server? Claim and customize this page.</em></p>"
    }
  ];
}

async function refreshStatus(server) {
  try {
    const res = await fetch(SERVER_STATUS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        serverId: server.id,
        ip: server.ip,
        edition: server.edition
      })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.log("Status skipped for " + server.name + ": " + (data.error || res.status));
      return;
    }

    console.log(
      "Status updated for " +
        server.name +
        ": " +
        data.status +
        " " +
        (data.playersOnline || 0) +
        "/" +
        (data.maxPlayers || 0)
    );
  } catch (error) {
    console.log("Status failed for " + server.name + ": " + error.message);
  }
}

async function testSeed() {
  console.log("Project ID:", serviceAccount.project_id);

  const now = admin.firestore.FieldValue.serverTimestamp();

  for (const server of seedServers) {
    const serverRef = db.collection("servers").doc(server.id);
    const pageRef = db.collection("servers").doc(server.id).collection("pages").doc("main");

    const existingDoc = await serverRef.get();
    const existingData = existingDoc.exists ? existingDoc.data() : {};

    if (existingData.claimStatus === "claimed" || existingData.ownerUid) {
      console.log("Skipped claimed server: " + server.name);
      continue;
    }

    await serverRef.set(
      {
        name: server.name,
        ip: server.ip,
        edition: server.edition,
        mode: server.mode,
        description: server.description,
        excerpt: server.description,
        tags: server.tags,
        theme: "royal",
        bannerUrl: "",
        logoUrl: "",
        isPublished: true,
        votingEnabled: false,
        ownerUid: null,
        upvotes: existingData.upvotes || 0,
        views: existingData.views || 0,
        totalVotes: existingData.totalVotes || 0,
        createdAt: existingData.createdAt || now,
        updatedAt: now,
        pagePublishedAt: existingData.pagePublishedAt || now,
        claimStatus: "unclaimed",
        listingType: "public_seed",
        isPublicSeed: true,
        isClaimable: true
      },
      { merge: true }
    );

    await pageRef.set(
      {
        meta: {
          theme: "royal",
          canvasBackgroundUrl: "",
          shellBackgroundUrl: "",
          pageBackgroundUrl: ""
        },
        blocks: makeBlocks(server),
        decorations: [],
        updatedAt: now,
        publishedAt: now
      },
      { merge: true }
    );

    console.log("Wrote test doc to: servers/" + server.id);
  }

  console.log("Seed docs finished. Refreshing live status now...");

  for (const server of seedServers) {
    await refreshStatus(server);
  }

  console.log("Done seeding public servers.");
}

testSeed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });