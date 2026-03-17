import {
  normalize,
  vectorToDirection,
} from '@isoheim/shared';
import { World } from '../core/World.js';

export class MovementSystem {
  update(world: World, deltaMs: number): void {
    const deltaSeconds = deltaMs / 1000;

    for (const zone of world.zoneManager.getAllZones()) {
      const mapWidth = zone.mapData.width;
      const mapHeight = zone.mapData.height;

      for (const player of zone.players.values()) {
        if (player.isDead || !player.moveDirection) continue;

        const dir = normalize(player.moveDirection);
        if (dir.x === 0 && dir.y === 0) continue;

        const speed = player.stats.speed;
        const newX = player.position.x + dir.x * speed * deltaSeconds;
        const newY = player.position.y + dir.y * speed * deltaSeconds;

        // Clamp to zone-specific bounds
        const clampedX = Math.max(1, Math.min(mapWidth - 2, newX));
        const clampedY = Math.max(1, Math.min(mapHeight - 2, newY));

        // Check collision with zone-specific data
        if (!world.isCollision(clampedX, clampedY, zone.id)) {
          player.position.x = clampedX;
          player.position.y = clampedY;
        } else {
          // Try sliding along axes
          if (!world.isCollision(clampedX, player.position.y, zone.id)) {
            player.position.x = clampedX;
          } else if (!world.isCollision(player.position.x, clampedY, zone.id)) {
            player.position.y = clampedY;
          }
        }

        player.position.direction = vectorToDirection(dir);
      }
    }
  }
}
