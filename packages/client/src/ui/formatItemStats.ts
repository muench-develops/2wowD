import type { ItemStats } from '@isoheim/shared';

/** Builds a human-readable stat text block for item tooltips. */
export function formatItemStats(stats: ItemStats): string {
  let text = '';
  if (stats.attack) text += `+${stats.attack} Attack\n`;
  if (stats.defense) text += `+${stats.defense} Defense\n`;
  if (stats.health) text += `+${stats.health} Health\n`;
  if (stats.mana) text += `+${stats.mana} Mana\n`;
  if (stats.speed) text += `+${stats.speed} Speed\n`;
  if (stats.critChance) text += `+${(stats.critChance * 100).toFixed(0)}% Crit\n`;
  return text;
}
