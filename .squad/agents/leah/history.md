# Leah — History

## Learnings
- Project: 2wowD, 2D isometric MMO by muench-develops
- Client at packages/client/ with Vite dev server on port 3000
- Scene flow: BootScene → LoginScene → CharacterSelectScene → GameScene (+ HUDScene overlay)
- HUDScene launches as overlay from GameScene via scene.launch()
- Fixed race condition: HUDScene must launch BEFORE applyWelcome() emits events
- GameScene uses client-side prediction with pendingMoves reconciliation
- All sprites procedurally generated — colored rectangles with class-specific colors
- Isometric rendering with depth sorting via getDepthForPosition()
- VFXManager singleton in systems/VFXManager.ts — procedural Graphics+Tweens effects for all 12 abilities
- VFX depth 9000 (above entities, below FloatingText at 10000)
- Ability IDs: warrior-charge/whirlwind/shield-block, mage-fireball/frost-bolt/blizzard, rogue-backstab/eviscerate/vanish, priest-heal/smite/shield
- Projectile VFX (fireball, frost bolt) use trail particles + impact burst; color-parameterized shared method
- All VFX auto-destroy via tween onComplete callbacks — no manual cleanup needed
- BootScene generates a 4×4 'particle' texture for potential future particle emitter use
- PR #15 Clean Code refactoring: Extracted large functions (render 49 lines → 9 methods), eliminated magic numbers (30+ constants), fixed abbreviations (s/W/H/bg/txt → descriptive names), added event handler cleanup (Map-based tracking), enhanced error handling (try-catch localStorage), applied DRY (drawArrowTriangle helper). Key learnings: Event handler memory leaks prevented via Map tracking in destroy(), all literals named for maintainability, functions under ~20 lines for readability.
- **Zone System (Phase 3, Issue #3):** Implemented comprehensive multi-zone client architecture with 3 distinct visual themes (Plains/Forest/Dungeon), procedurally generated zone-specific tile palettes in BootScene using tilePalette metadata, interactive portal system with pulsing cyan animations (16-22px radius tweens) and hover tooltips, smooth zone transition overlay with fade-to-black + zone name display (2s duration), ZoneChangedMessage handler that clears all entities except local player and reloads map with new palette, 5 new mob sprites (Spider purple octagon, Bandit red diamond, WolfAlpha brown triangle with red eyes, SkeletonMage purple skeleton, BoneLord large red/black boss with horns), mob-specific VFX methods in VFXManager (SkeletonMage projectile, BoneLord aura). Zone name displayed in HUD top-center with golden text. Portal depths at entity+500, transition overlay at 20000+, tooltips at 10000. All textures procedural (no external assets). Client-side prediction preserved across zone changes. Event-based GameScene↔HUDScene communication for zone updates and tooltips.
- **Bugfix batch (Loot/ErrorMessages/CharacterPanel/MapBounds):** Fixed double-splice in LootPickedUp handler — GameScene and LootWindow were both splicing the same items array by reference; removed the GameScene splice, letting LootWindow.removeItem() be the single owner. Added `showErrorMessage` event emission from GameScene's ServerError handler + HUDScene floating text notification (red/orange, tween fade-out at 2.5s, depth 2000). Created CharacterPanel (ui/CharacterPanel.ts) toggled by C key — shows name, class, level, XP bar, health/mana, and base CLASS_STATS values; follows InventoryPanel pattern with dark 0x1a1a2e bg, golden headers, depth 1000. Clamped client-side prediction to zone bounds using ZONE_METADATA (both in update() and pending move re-application), matching server's `Math.max(1, Math.min(width-2, ...))` logic. Key lesson: shared mutable references (worldLoots items array) must have a single mutation owner — event-driven architectures make double-mutation bugs subtle.
- **Equipment UI (Issue #6):** Implemented full equipment client UI. CharacterPanel expanded from 240px → 280px with paper-doll layout (7 slots: Head/Weapon/Chest/Ring1/Legs/Ring2/Boots) using `EQUIP_SLOT_LAYOUT` array for grid positioning. Equipment state stored as `PlayerEquipment` in both CharacterPanel and InventoryPanel. Right-click equip in InventoryPanel sends `ClientMessageType.EquipItem` with auto ring-slot resolution (Ring1→Ring2 fallback). Click-to-unequip in CharacterPanel sends `UnequipItem`. Stat comparison tooltip built via `buildComparisonText()` showing green/red diffs against currently equipped item. Equipment bonuses calculated from `ITEM_DATABASE` stats and displayed as `(+N)` in green after base class stats. `ITEM_STAT_TO_CLASS_STAT` maps ItemStats keys to ClassStats keys (critChance has no ClassStats equivalent → null). `EquipmentUpdate` handler in GameScene emits to HUDScene which forwards to both panels. Equipment also emitted from `applyWelcome()` when `PlayerState.equipment` is present. Shared index.ts needed export additions for `EquipItemMessage`, `UnequipItemMessage`, `EquipmentUpdateMessage`.

## Wave B Summary (2026-03-21) — SHIPPED
- **Parallel coordination:** Tyrael built potions + equipment backends on squad/5-potions-consumables; Leah built equipment UI on same branch sequentially to avoid merge conflicts
- **Backend integration (Tyrael):** Dual-cooldown consumable system (15s shared potion CD, 30-60s per-item CD), bandage HoT (50% max HP over 8s), full equipment mechanics (7 slots, stat recalc, persistence), ring auto-resolution, database migrations, message protocol for cooldown/equipment sync
- **Frontend features (Leah):** Paper-doll equipment display, right-click equip/unequip dual purpose (consumables→use, items→equip), stat comparison tooltips (green/red diffs), equipment bonus display in CharacterPanel, event-driven state sync via HUDScene
- **Code complete:** All 3 packages build clean, ESLint passes, PR #20 ready for Kormac review
- **Lesson learned:** Parallel feature branch work on same branch needs careful serialization — recommend using git worktrees or explicit hand-off protocol in future waves

## Kormac Review Fix — Cross-Domain Server Assignment (2026-03-21)
- **Context:** Kormac rejected PR #20, Reviewer Rejection Lockout protocol locked Tyrael out. Leah assigned to fix server-side issues.
- **Critical Bug #1:** Added missing `EquipItem`/`UnequipItem` case handlers to `handleMessage()` switch in MessageHandler.ts. Equipment system was completely non-functional without these dispatch entries.
- **Critical Bug #2:** Added equipment loading from DB in `handleSelectCharacter()` after inventory load. Equipment was lost on every login.
- **Critical Bug #3:** Added `this.db.saveEquipment()` calls in both `saveAndRemovePlayer()` and `saveAllPlayers()`. Equipment was never persisted on disconnect or shutdown.
- **Bug #4:** Declared `bandageHealPerTick: number = 0` field on Player class, removed all `as any` casts in MessageHandler.ts and GameLoop.ts.
- **Bug #5:** Changed `effectType` type annotation from `string` to `'heal' | 'mana' | 'teleport' | 'buff'` in GameScene's ConsumableUsed handler, removed `as any` cast. Types already matched in protocol.ts and VFXManager.ts.
- **Refactor #6:** Extracted `applyHealConsumable()`, `applyManaConsumable()`, `applyTeleportConsumable()` from handleUseItem. Each ~5-10 lines, following existing `applyBandageHoT()` pattern.
- **DRY #8:** Created `createDefaultEquipmentMap()` in shared/src/utils.ts, exported from index.ts. Replaced duplicate 7-slot Map initialization in Player.ts and Database.ts.
- **VFX #9:** Extracted 30+ magic numbers from consumable VFX methods to named static readonly constants on VFXManager class (colors, counts, spreads, durations, sizes).
- **VFX #10:** Renamed all single-letter variables in consumable VFX: `g`→`graphics`, `ox`/`oy`→`offsetX`/`offsetY`, `r`→`radius`, `a`→`angle`, `px`/`py`→`particleX`/`particleY`.
- **Build:** All 3 packages (shared, server, client) compile clean with zero TypeScript errors.
- **Lesson:** Cross-domain fixes require careful reading of existing patterns. The equip/unequip handlers followed the exact same pattern as UseItem/MoveItem — get player, call method, send update if successful.

## PR #20 Merge & Wave B Completion (2026-03-21T17:41:00Z)
- **Kormac Re-Review:** All 13 issues verified fixed, APPROVED ✅ (2026-03-21T17:40:00Z)
- **PR #20 Squash Merge:** Merged to main, branch squad/5-potions-consumables deleted
- **Issues Closed:** #5 (Potions & Consumables), #6 (Equipment & Gear)
- **Status:** Wave B fully shipped to production
- **Dev Servers Running:** Client localhost:3000, Server localhost:8080
- **Next:** User testing & Wave C planning
