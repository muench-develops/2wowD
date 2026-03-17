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

export function generateStarterPlainsMap(): MapData {
  const meta = ZONE_METADATA[ZoneId.StarterPlains];
  const tiles: TileType[][] = [];
  const collisions: boolean[][] = [];

  for (let y = 0; y < meta.height; y++) {
    tiles[y] = [];
    collisions[y] = [];
    for (let x = 0; x < meta.width; x++) {
      tiles[y][x] = TileType.Grass;
      collisions[y][x] = false;
    }
  }

  // Stone paths through center
  const spawnPoint = ZONE_PLAYER_SPAWNS[ZoneId.StarterPlains];
  for (let i = 5; i < meta.width - 5; i++) {
    tiles[spawnPoint.y][i] = TileType.Stone;
    tiles[i][spawnPoint.x] = TileType.Stone;
  }

  // Dirt patches in corners
  const dirtPatches = [
    { cx: 10, cy: 10 },
    { cx: 40, cy: 10 },
    { cx: 10, cy: 40 },
    { cx: 40, cy: 40 },
  ];
  for (const patch of dirtPatches) {
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const nx = patch.cx + dx;
        const ny = patch.cy + dy;
        if (nx >= 0 && nx < meta.width && ny >= 0 && ny < meta.height) {
          if (dx * dx + dy * dy <= 9) {
            tiles[ny][nx] = TileType.Dirt;
          }
        }
      }
    }
  }

  // Water pond in the northeast
  const pondCx = 38;
  const pondCy = 8;
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const nx = pondCx + dx;
      const ny = pondCy + dy;
      if (nx >= 0 && nx < meta.width && ny >= 0 && ny < meta.height) {
        if (dx * dx + dy * dy <= 12) {
          tiles[ny][nx] = TileType.Water;
          collisions[ny][nx] = true;
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

  // Portal collision (to Dark Forest)
  const portals = ZONE_PORTALS[ZoneId.StarterPlains];
  for (const portal of portals) {
    const px = Math.floor(portal.position.x);
    const py = Math.floor(portal.position.y);
    if (px >= 0 && px < meta.width && py >= 0 && py < meta.height) {
      tiles[py][px] = TileType.Stone;
    }
  }

  const spawnPoints: SpawnPoint[] = [
    // Goblins near NW dirt patch (levels 1-2)
    { position: { x: 8, y: 8 }, mobType: MobType.Goblin, respawnTime: 15, count: 3 },
    { position: { x: 12, y: 10 }, mobType: MobType.Goblin, respawnTime: 15, count: 2 },
    // Wolves near SW dirt patch (level 1)
    { position: { x: 10, y: 38 }, mobType: MobType.Wolf, respawnTime: 20, count: 3 },
    { position: { x: 8, y: 42 }, mobType: MobType.Wolf, respawnTime: 20, count: 2 },
    // Skeletons near SE dirt patch (level 2)
    { position: { x: 40, y: 38 }, mobType: MobType.Skeleton, respawnTime: 30, count: 3 },
    { position: { x: 42, y: 42 }, mobType: MobType.Skeleton, respawnTime: 30, count: 2 },
    // Mixed near NE
    { position: { x: 30, y: 12 }, mobType: MobType.Goblin, respawnTime: 15, count: 2 },
    { position: { x: 42, y: 15 }, mobType: MobType.Wolf, respawnTime: 20, count: 2 },
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
