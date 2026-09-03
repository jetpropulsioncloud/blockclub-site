from pathlib import Path

root = Path('guildfrontier-build/project')

build = root / 'build.gradle.kts'
s = build.read_text()
s = s.replace('version = "0.4.0"', 'version = "0.4.3"')
s = s.replace('io.papermc.paper:paper-api:26.2.build.+', 'io.papermc.paper:paper-api:1.21-R0.1-SNAPSHOT')
s = s.replace('JavaLanguageVersion.of(25)', 'JavaLanguageVersion.of(21)')
s = s.replace('options.release.set(25)', 'options.release.set(21)')
build.write_text(s)

plugin = root / 'src/main/resources/plugin.yml'
s = plugin.read_text()
s = s.replace("version: '0.4.0'", "version: '0.4.3'")
s = s.replace("api-version: '26.2'", "api-version: '1.21'")
plugin.write_text(s)

config = root / 'src/main/resources/config.yml'
s = config.read_text()
s = s.replace('# BlockClub Guild Frontier v0.4.0', '# BlockClub Guild Frontier v0.4.3')
s = s.replace('# Paper 26.2 / Java 25 / LuckPerms / GroupDepositPoints 2.1.9', '# Paper 1.21 / Java 21 / LuckPerms / GroupDepositPoints 2.1.9')
start = s.index('boundary:\n')
end = s.index('\n\ntravel:\n', start)
boundary = '''boundary:
  enabled: true
  visible-distance: 24
  visual-throttle-ms: 750
  # Real world blocks make the PvP edge obvious from a distance.
  ground-material: RED_CONCRETE
  pillar-material: RED_STAINED_GLASS
  marker-spacing: 3.0
  pillar-spacing: 12.0
  pillar-height: 3'''
s = s[:start] + boundary + s[end:]
config.write_text(s)

fm = root / 'src/main/java/com/blockclub/frontier/FrontierManager.java'
s = fm.read_text()
s = s.replace('import org.bukkit.Particle;\n', '')
s = s.replace('import java.util.Optional;\nimport java.util.UUID;\n', 'import java.util.Optional;\nimport java.util.Set;\nimport java.util.UUID;\n')
s = s.replace(
    '    private final Map<UUID, Long> boundaryVisualUntil = new HashMap<>();\n',
    '    private final Map<UUID, Long> boundaryVisualUntil = new HashMap<>();\n'
    '    private final EnumMap<GuildId, Map<BlockKey, Material>> boundaryBlocks = new EnumMap<>(GuildId.class);\n'
)
s = s.replace(
    '    private CampaignState campaign;\n    private boolean resetting;\n',
    '    private CampaignState campaign;\n    private boolean resetting;\n\n'
    '    private record BlockKey(int x, int y, int z) {}\n'
)

old = '''        if (world != null) {
            configureWorldBorder(world);
        }
    }

    private void createFreshCampaign'''
new = '''        if (world != null) {
            configureWorldBorder(world);
            rebuildAllBoundaryMarkers();
        }
    }

    private void createFreshCampaign'''
if old not in s:
    raise SystemExit('ensureCampaignWorldLoaded marker not found')
s = s.replace(old, new, 1)

old = '''        travelCooldownUntil.clear();
        boundaryVisualUntil.clear();

        Bukkit.broadcastMessage(prefix() + "Campaign #" + campaignNumber + " has begun. A fresh resource world is open.");'''
new = '''        travelCooldownUntil.clear();
        boundaryVisualUntil.clear();
        boundaryBlocks.clear();
        rebuildAllBoundaryMarkers();

        Bukkit.broadcastMessage(prefix() + "Campaign #" + campaignNumber + " has begun. A fresh resource world is open.");'''
if old not in s:
    raise SystemExit('fresh campaign marker not found')
s = s.replace(old, new, 1)

old = '''        World frontier = Bukkit.getWorld(worldName());
        World fallback = fallbackWorld();

        if (frontier != null) {'''
new = '''        World frontier = Bukkit.getWorld(worldName());
        World fallback = fallbackWorld();
        clearAllBoundaryMarkers();

        if (frontier != null) {'''
if old not in s:
    raise SystemExit('rotate campaign marker not found')
s = s.replace(old, new, 1)

particle_start = s.index('        int points = Math.max(3, Math.min(20, plugin.getConfig().getInt("boundary.particle-points", 9)));')
particle_end = s.index('\n    }\n\n    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)\n    public void onTeleport', particle_start)
s = s[:particle_start] + '        // The visible edge is made from world blocks in v0.4.3.\n' + s[particle_end:]

marker_methods = '''

    private void rebuildAllBoundaryMarkers() {
        if (campaign == null) {
            return;
        }
        for (GuildState state : campaign.guilds().values()) {
            rebuildBoundaryMarkers(state);
        }
    }

    private void rebuildBoundaryMarkers(GuildState state) {
        clearBoundaryMarkers(state.guild());
        if (!plugin.getConfig().getBoolean("boundary.enabled", true)) {
            return;
        }
        World world = Bukkit.getWorld(worldName());
        if (world == null) {
            return;
        }

        Material groundMaterial = parseMaterial(
                plugin.getConfig().getString("boundary.ground-material", "RED_CONCRETE"),
                Material.RED_CONCRETE);
        Material pillarMaterial = parseMaterial(
                plugin.getConfig().getString("boundary.pillar-material", "RED_STAINED_GLASS"),
                Material.RED_STAINED_GLASS);
        double spacing = Math.max(2.0, plugin.getConfig().getDouble("boundary.marker-spacing", 3.0));
        double pillarSpacing = Math.max(spacing, plugin.getConfig().getDouble("boundary.pillar-spacing", 12.0));
        int pillarHeight = Math.max(2, plugin.getConfig().getInt("boundary.pillar-height", 3));

        int steps = Math.max(24, (int) Math.ceil((Math.PI * 2.0 * state.radius()) / spacing));
        int pillarEvery = Math.max(1, (int) Math.round(pillarSpacing / spacing));

        Map<BlockKey, Material> changed = new HashMap<>();
        Set<Long> visitedColumns = new java.util.HashSet<>();
        for (int i = 0; i < steps; i++) {
            double angle = (Math.PI * 2.0 * i) / steps;
            int x = (int) Math.round(state.centerX() + (Math.cos(angle) * state.radius()));
            int z = (int) Math.round(state.centerZ() + (Math.sin(angle) * state.radius()));
            long packed = (((long) x) << 32) ^ (z & 0xffffffffL);
            if (!visitedColumns.add(packed)) {
                continue;
            }

            Location safe = safeSurfaceLocation(world, x, z);
            if (safe == null) {
                continue;
            }

            Block ground = world.getBlockAt(safe.getBlockX(), safe.getBlockY() - 1, safe.getBlockZ());
            trackAndSet(changed, ground, groundMaterial);

            if (i % pillarEvery == 0) {
                for (int y = 1; y <= pillarHeight; y++) {
                    Block pillarBlock = world.getBlockAt(ground.getX(), ground.getY() + y, ground.getZ());
                    if (!pillarBlock.isPassable() && pillarBlock.getType() != pillarMaterial) {
                        break;
                    }
                    trackAndSet(changed, pillarBlock, pillarMaterial);
                }
            }
        }
        boundaryBlocks.put(state.guild(), changed);
    }

    private void clearAllBoundaryMarkers() {
        for (GuildId guild : GuildId.values()) {
            clearBoundaryMarkers(guild);
        }
    }

    private void clearBoundaryMarkers(GuildId guild) {
        World world = Bukkit.getWorld(worldName());
        Map<BlockKey, Material> changed = boundaryBlocks.remove(guild);
        if (world == null || changed == null) {
            return;
        }
        for (Map.Entry<BlockKey, Material> entry : changed.entrySet()) {
            BlockKey key = entry.getKey();
            Block block = world.getBlockAt(key.x(), key.y(), key.z());
            block.setType(entry.getValue(), false);
        }
    }

    private void trackAndSet(Map<BlockKey, Material> changed, Block block, Material newType) {
        BlockKey key = new BlockKey(block.getX(), block.getY(), block.getZ());
        changed.putIfAbsent(key, block.getType());
        block.setType(newType, false);
    }

    private Material parseMaterial(String raw, Material fallback) {
        if (raw == null || raw.isBlank()) {
            return fallback;
        }
        try {
            return Material.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ignored) {
            return fallback;
        }
    }
'''
teleport_marker = '    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)\n    public void onTeleport(PlayerTeleportEvent event) {'
if teleport_marker not in s:
    raise SystemExit('teleport insertion marker not found')
s = s.replace(teleport_marker, marker_methods + '\n' + teleport_marker, 1)

old = '''        Bukkit.broadcastMessage(prefix() + state.guild().displayName() + " frontier " + verb
                + " from " + Math.round(oldRadius) + " to " + Math.round(state.radius()) + " blocks.");
        refreshOpenTravelMenus(state.guild());'''
new = '''        Bukkit.broadcastMessage(prefix() + state.guild().displayName() + " frontier " + verb
                + " from " + Math.round(oldRadius) + " to " + Math.round(state.radius()) + " blocks.");
        rebuildBoundaryMarkers(state);
        refreshOpenTravelMenus(state.guild());'''
if old not in s:
    raise SystemExit('radius change marker not found')
s = s.replace(old, new, 1)

fm.write_text(s)
