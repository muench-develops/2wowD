import {
  MapData,
  TileType,
  SpawnPoint,
  MobType,
  MAP_WIDTH,
  MAP_HEIGHT,
  PLAYER_SPAWN_X,
  PLAYER_SPAWN_Y,
} from '@isoheim/shared';

export function generateStarterMap(): MapData {
  const tiles: TileType[][] = [];
  const collisions: boolean[][] = [];

  for (let y = 0; y < MAP_HEIGHT; y++) {
    tiles[y] = [];
    collisions[y] = [];
    for (let x = 0; x < MAP_WIDTH; x++) {
      tiles[y][x] = TileType.Grass;
      collisions[y][x] = false;
    }
  }

  // Stone paths through center
  for (let i = 5; i < MAP_WIDTH - 5; i++) {
    tiles[PLAYER_SPAWN_Y][i] = TileType.Stone;
    tiles[i][PLAYER_SPAWN_X] = TileType.Stone;
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
        if (nx >= 0 && nx < MAP_WIDTH && ny >= 0 && ny < MAP_HEIGHT) {
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
      if (nx >= 0 && nx < MAP_WIDTH && ny >= 0 && ny < MAP_HEIGHT) {
        if (dx * dx + dy * dy <= 12) {
          tiles[ny][nx] = TileType.Water;
          collisions[ny][nx] = true;
        }
      }
    }
  }

  // Map border collisions
  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      if (x === 0 || x === MAP_WIDTH - 1 || y === 0 || y === MAP_HEIGHT - 1) {
        collisions[y][x] = true;
      }
    }
  }

  const spawnPoints: SpawnPoint[] = [
    // Goblins near NW dirt patch
    { position: { x: 8, y: 8 }, mobType: MobType.Goblin, respawnTime: 15, count: 3 },
    { position: { x: 12, y: 10 }, mobType: MobType.Goblin, respawnTime: 15, count: 2 },
    // Wolves near SW dirt patch
    { position: { x: 10, y: 38 }, mobType: MobType.Wolf, respawnTime: 20, count: 3 },
    { position: { x: 8, y: 42 }, mobType: MobType.Wolf, respawnTime: 20, count: 2 },
    // Skeletons near SE dirt patch
    { position: { x: 40, y: 38 }, mobType: MobType.Skeleton, respawnTime: 30, count: 3 },
    { position: { x: 42, y: 42 }, mobType: MobType.Skeleton, respawnTime: 30, count: 2 },
    // Mixed near NE
    { position: { x: 30, y: 12 }, mobType: MobType.Goblin, respawnTime: 15, count: 2 },
    { position: { x: 42, y: 15 }, mobType: MobType.Wolf, respawnTime: 20, count: 2 },
  ];

  return {
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    tiles,
    collisions,
    spawnPoints,
    playerSpawn: { x: PLAYER_SPAWN_X, y: PLAYER_SPAWN_Y },
  };
}
