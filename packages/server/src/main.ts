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
import { generateStarterMap } from './maps/StarterMap.js';
import { Database } from './database/Database.js';
import { AuthManager } from './auth/AuthManager.js';

const SAVE_INTERVAL_MS = 60_000; // periodic save every 60 seconds

function main(): void {
  console.log('=== 2wowD Game Server ===');

  // Database & Auth
  const db = new Database('./game.db');
  const authManager = new AuthManager(db);
  console.log('[DB] SQLite database initialized');

  // Generate map
  const mapData = generateStarterMap();
  console.log(`[Map] Generated ${mapData.width}x${mapData.height} map with ${mapData.spawnPoints.length} spawn points`);

  // Create world
  const world = new World(mapData);

  // Create network manager
  const network = new NetworkManager();

  // Create systems
  const movementSystem = new MovementSystem();
  const buffSystem = new BuffSystem(network);
  const combatSystem = new CombatSystem(network, buffSystem);
  const mobAISystem = new MobAISystem(network, buffSystem);
  const spawnSystem = new SpawnSystem(network);
  const chatSystem = new ChatSystem(network);

  // Create message handler
  const messageHandler = new MessageHandler(
    world,
    network,
    movementSystem,
    combatSystem,
    chatSystem,
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

  // Spawn initial mobs
  spawnSystem.spawnInitialMobs(world);
  console.log(`[Spawn] Spawned ${world.mobs.size} mobs`);

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
