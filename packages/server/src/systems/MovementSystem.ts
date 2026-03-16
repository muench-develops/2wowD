import {
  Vec2,
  MAP_WIDTH,
  MAP_HEIGHT,
  normalize,
  vectorToDirection,
} from '@isoheim/shared';
import { Player } from '../entities/Player.js';
import { World } from '../core/World.js';

export class MovementSystem {
  update(world: World, deltaMs: number): void {
    const deltaSeconds = deltaMs / 1000;

    for (const player of world.players.values()) {
      if (player.isDead || !player.moveDirection) continue;

      const dir = normalize(player.moveDirection);
      if (dir.x === 0 && dir.y === 0) continue;

      const speed = player.stats.speed;
      const newX = player.position.x + dir.x * speed * deltaSeconds;
      const newY = player.position.y + dir.y * speed * deltaSeconds;

      // Clamp to map bounds (keep 1 tile from edge to stay inside border)
      const clampedX = Math.max(1, Math.min(MAP_WIDTH - 2, newX));
      const clampedY = Math.max(1, Math.min(MAP_HEIGHT - 2, newY));

      // Check collision at the new position
      if (!world.isCollision(clampedX, clampedY)) {
        player.position.x = clampedX;
        player.position.y = clampedY;
      } else {
        // Try sliding along axes
        if (!world.isCollision(clampedX, player.position.y)) {
          player.position.x = clampedX;
        } else if (!world.isCollision(player.position.x, clampedY)) {
          player.position.y = clampedY;
        }
      }

      player.position.direction = vectorToDirection(dir);
    }
  }
}
