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

export function generateAncientDungeonMap(): MapData {
  const meta = ZONE_METADATA[ZoneId.AncientDungeon];
  const tiles: TileType[][] = [];
  const collisions: boolean[][] = [];

  // Base stone dungeon floor
  for (let y = 0; y < meta.height; y++) {
    tiles[y] = [];
    collisions[y] = [];
    for (let x = 0; x < meta.width; x++) {
      tiles[y][x] = TileType.Stone;
      collisions[y][x] = false;
    }
  }

  // Dirt patches (corruption/decay)
  const dirtAreas = [
    { cx: 10, cy: 10, radius: 3 },
    { cx: 30, cy: 10, radius: 2 },
    { cx: 10, cy: 30, radius: 2 },
    { cx: 30, cy: 30, radius: 3 },
  ];
  for (const area of dirtAreas) {
    for (let dy = -area.radius; dy <= area.radius; dy++) {
      for (let dx = -area.radius; dx <= area.radius; dx++) {
        const nx = area.cx + dx;
        const ny = area.cy + dy;
        if (nx >= 0 && nx < meta.width && ny >= 0 && ny < meta.height) {
          if (dx * dx + dy * dy <= area.radius * area.radius) {
            tiles[ny][nx] = TileType.Dirt;
          }
        }
      }
    }
  }

  // Water (dark pools)
  const pools = [
    { cx: 8, cy: 20, radius: 2 },
    { cx: 32, cy: 20, radius: 2 },
  ];
  for (const pool of pools) {
    for (let dy = -pool.radius; dy <= pool.radius; dy++) {
      for (let dx = -pool.radius; dx <= pool.radius; dx++) {
        const nx = pool.cx + dx;
        const ny = pool.cy + dy;
        if (nx >= 0 && nx < meta.width && ny >= 0 && ny < meta.height) {
          if (dx * dx + dy * dy <= pool.radius * pool.radius) {
            tiles[ny][nx] = TileType.Water;
            collisions[ny][nx] = true;
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
  const portals = ZONE_PORTALS[ZoneId.AncientDungeon];
  for (const portal of portals) {
    const px = Math.floor(portal.position.x);
    const py = Math.floor(portal.position.y);
    if (px >= 0 && px < meta.width && py >= 0 && py < meta.height) {
      tiles[py][px] = TileType.Stone;
      collisions[py][px] = false;
    }
  }

  const spawnPoints: SpawnPoint[] = [
    // Skeleton Mages (level 8, ranged)
    { position: { x: 10, y: 10 }, mobType: MobType.SkeletonMage, respawnTime: 35, count: 3 },
    { position: { x: 30, y: 10 }, mobType: MobType.SkeletonMage, respawnTime: 35, count: 3 },
    { position: { x: 10, y: 30 }, mobType: MobType.SkeletonMage, respawnTime: 35, count: 2 },
    // Regular Skeletons (level 2)
    { position: { x: 15, y: 15 }, mobType: MobType.Skeleton, respawnTime: 30, count: 4 },
    { position: { x: 25, y: 25 }, mobType: MobType.Skeleton, respawnTime: 30, count: 3 },
    // Spiders (level 3)
    { position: { x: 5, y: 25 }, mobType: MobType.Spider, respawnTime: 25, count: 2 },
    { position: { x: 35, y: 25 }, mobType: MobType.Spider, respawnTime: 25, count: 2 },
    // Bone Lord BOSS (level 10, center of dungeon, single spawn, 10 min respawn)
    { position: { x: 20, y: 20 }, mobType: MobType.BoneLord, respawnTime: 600, count: 1 },
  ];

  return {
    width: meta.width,
    height: meta.height,
    tiles,
    collisions,
    spawnPoints,
    playerSpawn: ZONE_PLAYER_SPAWNS[ZoneId.AncientDungeon],
  };
}
