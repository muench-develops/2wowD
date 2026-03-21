# Squad Decisions

## Active Decisions

### 2026-03-16: Architecture — Monorepo with npm workspaces
**By:** muench-develops
**What:** TypeScript monorepo: packages/shared (types+protocol), packages/server (Node+WS), packages/client (Phaser+Vite)
**Why:** Clean separation, shared types, single build command

### 2026-03-16: Auth — SQLite with scrypt
**By:** muench-develops
**What:** better-sqlite3 for persistence, Node crypto.scrypt for password hashing, max 4 characters per account
**Why:** Simple, no external deps, synchronous DB fits game loop

### 2026-03-16: Zones — Zone areas, not instancing
**By:** Coordinator
**What:** Dungeon zones are harder map areas shared with all players, not instanced per party
**Why:** More achievable for current scope

### 2026-03-16: Phase 3 scope
**By:** muench-develops
**What:** Items/inventory, potions, equipment, zones+dungeon, mob collision, NPCs+quests, guide, skill animations, Git repo, MegaLinter, Docker

### 2026-03-16: Workflow — Feature branches + PR requirement
**By:** muench-develops
**What:** All work on feature branches (`squad/{issue-number}-{slug}`), PRs required to merge to main, Kormac reviews all PRs for clean code, MegaLinter must pass
**Why:** Protect main branch quality, enforce code review gate

### 2026-03-16: Team — Kormac added as Code Reviewer
**By:** Coordinator
**What:** Kormac (Diablo universe) joins as Clean Code Reviewer with reviewer powers (approve/reject + lockout protocol)
**Why:** User requested Uncle Bob-style code quality enforcement

### 2026-03-16: Branch Protection on main
**By:** Haedrig (DevOps)
**What:** Branch protection applied to `main`:
  - 1 approving PR review required
  - MegaLinter status check required (strict mode)
  - No force pushes, no branch deletion
  - Admin enforcement OFF (owner can bypass in emergencies)
**Why:** Align with feature branch workflow, enforce code quality gate, reduce integration bugs

### 2026-03-16: DevOps Setup — Git, Docker, MegaLinter
**By:** Haedrig (DevOps)
**What:**
  - **Git/GitHub:** Repository muench-develops/2wowD (public, MIT), default branch main
  - **Docker:** Multi-stage builds (Node 20 alpine), client on 3000 (nginx), server on 8080 (Node+WS), game.db persisted
  - **MegaLinter:** ESLint (TypeScript), Prettier (JSON), markdownlint, Hadolint, Trivy; CI via GitHub Actions
**Why:** Establish standard development, deployment, and quality pipeline infrastructure

### 2026-03-16: VFX Manager Pattern
**By:** Leah (Frontend Dev)
**What:** `VFXManager` singleton in packages/client/src/systems/ for all ability visual effects using Phaser Graphics+Tweens only
**Why:** Decouple VFX from GameScene, match SoundManager convention, avoid particle emitter API fragility

### 2026-03-17: Clean Code Patterns — UI Components
**By:** Leah (Frontend Dev)
**What:** Six patterns for all UI components:
  1. Event Handler Memory Leak Prevention — Track handlers in Map, unbind in destroy()
  2. Named Constants Over Magic Numbers — All literals (numbers, colors, strings) as constants
  3. Function Size Limit — Keep functions ~20 lines, extract into single-purpose helpers
  4. Intention-Revealing Names — No abbreviations or single-letter variables
  5. DRY — Replace duplicated logic with parameterized helpers
  6. Defensive localStorage — Wrap in try-catch with fallbacks (private browsing mode)
**Context:** Applied to PR #15 refactoring, recommended as team standard for Phase 3 frontend
**Why:** Prevent memory leaks, improve maintainability, self-documenting code

### 2026-03-17: ESLint Cleanup Strategy
**By:** Tyrael  
**Context:** MegaLinter CI failing on zone system branch due to 3 errors + 43 warnings
**What:**
   - Unused imports/variables: removed entirely rather than commented out
   - Unused function params: prefixed with `_` per project eslintrc argsIgnorePattern
   - Unused assigned variables: removed assignment, kept side-effect call
   - `as any` cast: replaced with proper types (e.g., `as CharacterInfo`)
   - Empty catch blocks: added `/* no-op */` comment per no-empty rule
   - Found and fixed 3 additional warnings (GameLoop.ts, BuffSystem.ts, MobAISystem.ts) beyond the listed 46
**Result:** Surgical lint-only changes, no game logic modified, TypeScript compilation verified clean

### 2026-03-17: Multi-Zone System Backend Architecture
**By:** Tyrael (Backend Dev)  
**Feature:** Issue #3 — Zones, Portals & Dungeon (Phase 2 Backend)  
**What:**
   1. **ZoneManager as Central Registry** — Single source of truth for all zone data, centralized zone registration and lookup
   2. **World as Backward-Compatible Wrapper** — Refactor World to wrap ZoneManager, preserve legacy API with zone-scoped methods alongside
   3. **Portal Interaction** — 2.0 tile proximity range, validate target zone matches portal to prevent exploits
   4. **Database Migration** — Auto-add current_zone column with default 'starter-plains' for graceful upgrade
   5. **Zone Broadcasts** — PlayerJoined/PlayerLeft only sent to players in same zone for spatial isolation
   6. **Mob Abilities** — Cooldown-based system, Bone Lord rotates abilities, DoT/CC applied via BuffSystem
   7. **Map Generation** — Hand-crafted zone layouts (Starter Plains, Dark Forest, Ancient Dungeon) with defined spawn points
   8. **Spawn System** — Zone-aware spawning, 600s Bone Lord respawn timer, shorter timers for regular mobs
**Why:** Achieves Phase 2 zone isolation requirement without instancing, maintains existing system compatibility, enables future zone-level features

### 2026-03-17: Frontend Zone System — Phase 3 Implementation Plan
**By:** Leah (Frontend Dev)  
**Context:** Issue #3 — Multi-zone system with portals and Ancient Dungeon  
**What:**
   1. **Zone-Specific Tile Palette System** — Procedural tile textures per zone palette (plains/forest/dungeon) keyed as `tile-{palette}-{tileType}`
   2. **Portal Rendering** — Pulsing cyan Graphics circles with tweened radius/alpha animation, not as tiles
   3. **Zone Transition Overlay** — Full-screen fade-to-black with zone name/subtitle during transition
   4. **Entity State Clearing** — Clear all players (except local), mobs, and loot on zone change
   5. **New Mob Visual Design** — Distinct geometric shapes and colors (Spider purple octagon, Bandit dark red diamond, Wolf Alpha brown triangle, Skeleton Mage purple skeleton, Bone Lord red/black boss)
   6. **Mob VFX in VFXManager** — Add `playSkeletonMageProjectile()` and `playBoneLordAura()` methods to singleton
   7. **Zone Name HUD Display** — Zone name centered at top of screen (x: 640, y: 8) with golden text
   8. **Tooltip System** — Event-based tooltips emitted from GameScene to HUDScene for portal interaction
**Why:** Delivers Phase 3 zone rendering and client-side portal/transition mechanics, maintains procedural art style, follows clean code UI patterns

### 2026-03-21: Potions & Consumables Cooldown Design
**Date:** 2026-03-21  
**Agent:** Tyrael  
**Context:** Issue #5 — Potions & Consumables Implementation

**What:**
Implemented dual-cooldown system for consumables:
1. **Shared potion cooldown** (15s) applies to all HP/MP potions
2. **Individual item cooldowns** for special items (Bandage 30s, TP Scroll 60s)

**Rationale:**
- Prevents potion spam (too easy to stack instant heals)
- Shared cooldown encourages strategic HP vs MP potion use
- Individual cooldowns allow unique mechanics (bandage HoT, teleport escape)
- Matches standard MMO design patterns (WoW, FFXIV)

**Technical Approach:**
- **Server State:** `Player.potionSharedCooldownUntil: number` — shared CD expiry timestamp; `Player.itemCooldowns: Map<string, number>` — per-itemId expiry timestamps
- **Validation:** `canUseConsumable()` checks both cooldowns before allowing use
- **Client Sync:** `PotionCooldownUpdate` message sends remaining milliseconds for UI display
- **Bandage HoT:** 50% max HP over 8s, interrupted on damage via `Player.takeDamage()`; encourages out-of-combat use

**Alternatives Considered:**
1. Global consumable cooldown — Too restrictive, kills item variety
2. No shared cooldown — Instant heal spam breaks combat balance
3. Percentage-based HoT per tick — Went with fixed amount for predictability

**Impact:**
- Balanced consumable usage in combat
- Clear distinction between instant (potion) and HoT (bandage) healing
- Extensible for future consumable types (buff scrolls, damage potions)

### 2026-03-21: Equipment UI Architecture
**By:** Leah (Frontend Dev)  
**Context:** Issue #6 — Equipment system client UI  

**What:**
1. **Dual-panel equipment state** — Both `CharacterPanel` and `InventoryPanel` hold a copy of `PlayerEquipment` state, synced via HUDScene forwarding the `equipmentUpdate` event from GameScene to both panels.
2. **Paper-doll layout** — 7 equipment slots arranged in a 3-column × 4-row grid inside CharacterPanel using `EQUIP_SLOT_LAYOUT` array (col: -1/0/1, row: 0-3). Panel widened from 240px → 280px to fit.
3. **Right-click dual purpose** — Right-click on inventory items: consumables → use, equippable items → equip. Replaces previous consumable-only right-click handler.
4. **Ring auto-resolution** — When equipping a ring, client checks Ring1 first. If occupied, falls back to Ring2. Server handles the actual slot assignment authoritatively.
5. **Stat comparison tooltip** — Inventory tooltip now shows stat diffs (green +N / red -N) against the currently equipped item in that slot. Uses `EQUIPMENT_SLOT_FOR_ITEM_TYPE` to determine which slot to compare.
6. **Equipment bonus display** — Stats section in CharacterPanel shows base class stats with equipment bonuses appended as green `(+N)` text. Uses `ITEM_STAT_TO_CLASS_STAT` mapping (critChance excluded as it has no ClassStats equivalent).
7. **Shared index exports** — Added `EquipItemMessage`, `UnequipItemMessage`, `EquipmentUpdateMessage` exports to shared/src/index.ts (were missing from Tyrael's backend work).

**Why:**
- Dual-state approach avoids cross-panel dependencies while keeping UI responsive
- Paper-doll layout follows MMO convention for intuitive equipment management
- Right-click context-sensitivity (equip vs use) is standard MMO UX
- Equipment bonuses shown inline avoid separate tooltip needs for equipped gear impact

### 2026-03-21: PR #20 Review — Integration Verification Required
**By:** Kormac (Code Reviewer)
**Date:** 2026-03-21
**Context:** PR #20 Wave B review found 3 critical integration bugs

**Observation:**
When features are split across server (Tyrael) and client (Leah) on the same branch, integration gaps can occur:
- Message handlers added to protocol but not wired in server dispatch
- Persistence methods added to Database but never called from save/load paths

**Recommendation:**
For future multi-agent feature branches:
1. **Integration checklist** before PR: For every new `ClientMessageType`, verify a corresponding `case` in `handleMessage()` switch
2. **Persistence checklist**: For every new entity state (equipment, buffs, etc.), verify it's in both `saveAndRemovePlayer()` AND `handleSelectCharacter()` load path
3. **Full roundtrip smoke test**: client sends → server handles → server persists → server loads → server responds → client renders

**Impact:**
PR #20 blocked until Tyrael adds equip/unequip handlers + persistence wiring. ~3 critical bugs, all in MessageHandler.ts integration layer. Post-fix re-review approved all 13 requested changes.

### 2026-03-21: createDefaultEquipmentMap shared helper
**By:** Leah (Frontend Dev, cross-domain assignment)
**Date:** 2026-03-21
**Context:** Kormac review fix — DRY issue #8

**What:**
Created `createDefaultEquipmentMap()` utility function in `packages/shared/src/utils.ts` that returns a `Map<EquipmentSlot, string | null>` with all 7 equipment slots initialized to `null`. Exported from shared index.ts.

**Where used:**
- `packages/server/src/entities/Player.ts` — equipment field initializer
- `packages/server/src/database/Database.ts` — `loadEquipment()` default map

**Why:**
The 7-slot equipment Map initialization was duplicated identically in 2 files. Centralizing it ensures consistency if slots change and follows DRY principle. Placed in shared utils since both server and potentially client need it.

**Impact:**
- Any future equipment slot additions only need to be changed in one place
- Shared package is the correct home since EquipmentSlot is already a shared type

### 2026-03-21: Extract formatItemStats() shared UI helper
**By:** Tyrael (Backend Dev, cross-domain assignment)
**Date:** 2026-03-21
**Context:** Kormac review rejection on PR #20, DRY issue #7

**What:**
Created `packages/client/src/ui/formatItemStats.ts` with a single function `formatItemStats(stats: ItemStats): string` that builds the stat text block used in item tooltips.

**Why:**
CharacterPanel.showEquipTooltip() and InventoryPanel.showTooltip() had identical 6-line stat text building blocks. Extracting to a shared helper eliminates duplication and ensures future stat additions only need one change.

**Alternatives Considered:**
- Inline the logic in a base class — overkill, panels don't share an inheritance chain
- Put it in shared package — it's UI-presentation logic, belongs in client

**Impact:**
- Both panels now import and call `formatItemStats()` instead of inline stat blocks
- No behavioral change; output is identical

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction
- All code changes go through PRs — Kormac reviews for clean code compliance
