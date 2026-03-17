import {
  MapData,
  TileType,
  SpawnPoint,
  MobType,
  ZONE_METADATA,
  ZoneId,
  ZONE_PLAYER_SPAWNS,
  ZONE_PORTALS,
} from '@isoheim/shared';

export function generateDarkForestMap(): MapData {
  const meta = ZONE_METADATA[ZoneId.DarkForest];
  const tiles: TileType[][] = [];
  const collisions: boolean[][] = [];

  // Base forest floor
  for (let y = 0; y < meta.height; y++) {
    tiles[y] = [];
    collisions[y] = [];
    for (let x = 0; x < meta.width; x++) {
      tiles[y][x] = TileType.Grass;
      collisions[y][x] = false;
    }
  }

  // Dirt paths through the forest
  const spawnPoint = ZONE_PLAYER_SPAWNS[ZoneId.DarkForest];
  for (let i = 0; i < meta.width; i++) {
    if (i % 3 !== 0) {
      tiles[30][i] = TileType.Dirt;
    }
  }
  for (let i = 0; i < meta.height; i++) {
    if (i % 3 !== 0) {
      tiles[i][30] = TileType.Dirt;
    }
  }

  // Water streams (hazard areas)
  const streams = [
    { cx: 15, cy: 15, length: 10, horizontal: true },
    { cx: 45, cy: 25, length: 12, horizontal: false },
  ];
  for (const stream of streams) {
    for (let i = 0; i < stream.length; i++) {
      const nx = stream.horizontal ? stream.cx + i : stream.cx;
      const ny = stream.horizontal ? stream.cy : stream.cy + i;
      if (nx >= 0 && nx < meta.width && ny >= 0 && ny < meta.height) {
        tiles[ny][nx] = TileType.Water;
        collisions[ny][nx] = true;
      }
    }
  }

  // Stone clearings (safe spots)
  const clearings = [
    { cx: spawnPoint.x, cy: spawnPoint.y, radius: 2 },
    { cx: 30, cy: 10, radius: 3 },
    { cx: 50, cy: 50, radius: 3 },
  ];
  for (const clearing of clearings) {
    for (let dy = -clearing.radius; dy <= clearing.radius; dy++) {
      for (let dx = -clearing.radius; dx <= clearing.radius; dx++) {
        const nx = clearing.cx + dx;
        const ny = clearing.cy + dy;
        if (nx >= 0 && nx < meta.width && ny >= 0 && ny < meta.height) {
          if (dx * dx + dy * dy <= clearing.radius * clearing.radius) {
            tiles[ny][nx] = TileType.Stone;
            collisions[ny][nx] = false;
          }
        }
      }
    }
  }

  // Map border collisions
  for (let y = 0; y < meta.height; y++) {
    for (let x = 0; x < meta.width; x++) {
      if (x === 0 || x === meta.width - 1 || y === 0 || y === meta.height - 1) {
        collisions[y][x] = true;
      }
    }
  }

  // Portal tiles
  const portals = ZONE_PORTALS[ZoneId.DarkForest];
  for (const portal of portals) {
    const px = Math.floor(portal.position.x);
    const py = Math.floor(portal.position.y);
    if (px >= 0 && px < meta.width && py >= 0 && py < meta.height) {
      tiles[py][px] = TileType.Stone;
      collisions[py][px] = false;
    }
  }

  const spawnPoints: SpawnPoint[] = [
    // Spiders (level 3, poison DoT)
    { position: { x: 10, y: 10 }, mobType: MobType.Spider, respawnTime: 25, count: 4 },
    { position: { x: 50, y: 15 }, mobType: MobType.Spider, respawnTime: 25, count: 3 },
    { position: { x: 15, y: 45 }, mobType: MobType.Spider, respawnTime: 25, count: 3 },
    // Bandits (level 4, stun)
    { position: { x: 35, y: 20 }, mobType: MobType.Bandit, respawnTime: 30, count: 3 },
    { position: { x: 20, y: 35 }, mobType: MobType.Bandit, respawnTime: 30, count: 2 },
    { position: { x: 45, y: 45 }, mobType: MobType.Bandit, respawnTime: 30, count: 3 },
    // Wolf Alpha (level 5, AoE howl)
    { position: { x: 30, y: 50 }, mobType: MobType.WolfAlpha, respawnTime: 40, count: 2 },
    { position: { x: 50, y: 30 }, mobType: MobType.WolfAlpha, respawnTime: 40, count: 1 },
    // Some regular wolves and skeletons
    { position: { x: 25, y: 25 }, mobType: MobType.Wolf, respawnTime: 20, count: 2 },
    { position: { x: 40, y: 10 }, mobType: MobType.Skeleton, respawnTime: 30, count: 2 },
  ];

  return {
    width: meta.width,
    height: meta.height,
    tiles,
    collisions,
    spawnPoints,
    playerSpawn: spawnPoint,
  };
}
