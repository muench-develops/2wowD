import { World } from './core/World.js';
import { GameLoop } from './core/GameLoop.js';
import { NetworkManager } from './network/NetworkManager.js';
import { MessageHandler } from './network/MessageHandler.js';
import { MovementSystem } from './systems/MovementSystem.js';
import { CombatSystem } from './systems/CombatSystem.js';
import { BuffSystem } from './systems/BuffSystem.js';
import { MobAISystem } from './systems/MobAISystem.js';
import { SpawnSystem } from './systems/SpawnSystem.js';
import { ChatSystem } from './systems/ChatSystem.js';
import { LootSystem } from './systems/LootSystem.js';
import { QuestManager } from './systems/QuestManager.js';
import { ZoneManager } from './systems/ZoneManager.js';
import { generateStarterPlainsMap } from './maps/StarterPlainsMap.js';
import { generateDarkForestMap } from './maps/DarkForestMap.js';
import { generateAncientDungeonMap } from './maps/AncientDungeonMap.js';
import { Database } from './database/Database.js';
import { AuthManager } from './auth/AuthManager.js';
import { ZoneId } from '@isoheim/shared';

const SAVE_INTERVAL_MS = 60_000; // periodic save every 60 seconds

function main(): void {
  console.log('=== Isoheim Game Server ===');

  // Database & Auth
  const db = new Database('./game.db');
  const authManager = new AuthManager(db);
  console.log('[DB] SQLite database initialized');

  // Initialize ZoneManager
  const zoneManager = new ZoneManager();
  console.log('[ZoneManager] Initializing zones...');

  // Generate and register all three zones
  const starterPlainsMap = generateStarterPlainsMap();
  zoneManager.registerZone(ZoneId.StarterPlains, starterPlainsMap);

  const darkForestMap = generateDarkForestMap();
  zoneManager.registerZone(ZoneId.DarkForest, darkForestMap);

  const ancientDungeonMap = generateAncientDungeonMap();
  zoneManager.registerZone(ZoneId.AncientDungeon, ancientDungeonMap);

  console.log('[ZoneManager] All zones loaded');

  // Create world with ZoneManager
  const world = new World(zoneManager, ZoneId.StarterPlains);

  // Create network manager
  const network = new NetworkManager();
  network.setWorld(world);

  // Create systems
  const movementSystem = new MovementSystem();
  const buffSystem = new BuffSystem(network);
  const combatSystem = new CombatSystem(network, buffSystem);
  const mobAISystem = new MobAISystem(network, buffSystem);
  const spawnSystem = new SpawnSystem(network);
  const chatSystem = new ChatSystem(network);
  const lootSystem = new LootSystem(network);
  const questManager = new QuestManager(network);

  // Wire loot and quest into combat
  combatSystem.setLootSystem(lootSystem);
  combatSystem.setQuestManager(questManager);

  // Create message handler
  const messageHandler = new MessageHandler(
    world,
    network,
    movementSystem,
    combatSystem,
    chatSystem,
    lootSystem,
    questManager,
    authManager,
    db,
  );

  // Create game loop
  const gameLoop = new GameLoop(
    world,
    movementSystem,
    combatSystem,
    mobAISystem,
    spawnSystem,
    buffSystem,
    lootSystem,
    network,
  );

  // Wire up network events
  network.onConnect = (_sessionId: string) => {
    // Connection established, waiting for auth messages
  };

  network.onDisconnect = (sessionId: string) => {
    messageHandler.handleDisconnect(sessionId);
  };

  network.onMessage = (sessionId: string, message) => {
    messageHandler.handleMessage(sessionId, message);
  };

  // Spawn initial mobs for all zones
  spawnSystem.spawnInitialMobs(world);
  const totalMobs = world.mobs.size;
  console.log(`[Spawn] Spawned ${totalMobs} mobs across all zones`);

  // Periodic save
  const saveTimer = setInterval(() => {
    messageHandler.saveAllPlayers();
  }, SAVE_INTERVAL_MS);

  // Start network and game loop
  network.start();
  gameLoop.start();

  // Graceful shutdown
  const shutdown = () => {
    console.log('\n[Server] Shutting down...');
    clearInterval(saveTimer);
    gameLoop.stop();
    messageHandler.saveAllPlayers();
    console.log('[DB] All players saved');
    db.close();
    console.log('[DB] Database closed');
    network.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main();
