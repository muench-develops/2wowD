# Kormac — History

## Core Context
- **Project:** 2wowD, 2D isometric MMO by muench-develops
- **Stack:** TypeScript monorepo (packages/shared, packages/server, packages/client)
- **Server:** Node.js + WebSocket, SQLite via better-sqlite3, @2wowd/shared
- **Client:** Phaser.js + Vite, @2wowd/shared
- **Monorepo path:** repo root (this repository)
- **GitHub:** muench-develops/2wowD (public)
- **Build:** `npm run build` (shared first, then server+client)
- **CI:** MegaLinter (ESLint, Prettier, Trivy, Hadolint, markdownlint)

## Learnings

### PR #15 Re-Review (2026-03-17) — Clean Code Refactoring Complete
**Verdict:** APPROVED ✅

**Context:** Re-reviewed PR #15 after Leah addressed all 6 Clean Code violations from initial review.

**Violations Status:**
1. ✅ **Function Size:** render() reduced from 49 → 10 lines via extraction of createTextBox(), createArrow(), setupAutoAdvance()
2. ✅ **Magic Numbers:** 30+ named constants extracted (BOX_BG_COLOR, TEXT_BOX_WIDTH, AUTO_ADVANCE_DELAY_MS, etc.)
3. ✅ **Naming:** All abbreviations replaced with intention-revealing names (currentTutorialStep, background, stepText, progressText, skipButton, targetX, targetY, etc.)
4. ✅ **Resource Cleanup:** Map-based event handler tracking (eventHandlers) + proper destroy() with events.off()
5. ✅ **Error Handling:** try-catch blocks added to loadProgress(), saveProgress(), and finish() for localStorage
6. ✅ **DRY:** Arrow rendering consolidated into drawArrowTriangle() helper method (eliminates 4x duplication)

**Code Quality Assessment:**
- 9 helper functions extracted from original monolithic render()
- Clear separation of concerns: text box creation, arrow rendering, auto-advance logic
- Proper abstraction levels maintained within each function
- Follows existing UI component patterns (Container-based architecture)
- No new issues introduced by refactoring

**Technical Note:** drawArrowTriangle() is 34 lines due to switch statement handling 4 directional cases (up/down/left/right). This is acceptable per Clean Code principles: "It's hard to make a small switch statement" (Martin, p37). Function satisfies Single Responsibility Principle (one reason to change: arrow rendering logic) and each case is clear and simple. Further extraction would reduce readability without benefit.

**Key Learnings:**
- Switch statements are an acceptable exception to the 20-line guideline when each case is simple
- Single Responsibility Principle trumps line count in edge cases
- Map-based tracking is the correct pattern for dynamic event handler cleanup
- Consistent error handling on localStorage is critical (private browsing mode throws exceptions)
- Named constants dramatically improve code readability (30+ constants vs inline values)

**Outcome:** All requested changes successfully implemented. PR ready to merge.
### PR #15 Review (2026-03-17) — New Player Tutorial Guide System
**Verdict:** REQUEST CHANGES

**Functional Assessment:** Implementation is sound and meets all acceptance criteria. Tutorial system works correctly with localStorage persistence, event-driven step advancement, and UI highlighting.

**Code Quality Issues Found:**
1. **Large Functions:** `render()` method at 49 lines violates ~20 line guideline — needs extraction into `createTextBox()`, `createArrow()`, `setupAutoAdvance()`
2. **Magic Numbers:** Pervasive throughout — colors (0x1a1a2e, 0xe0c070), dimensions (420, 68), delays (5000ms) not extracted as named constants
3. **Poor Naming:** Single-letter vars (`s`, `W`, `H`) and abbreviations (`bg`, `txt`, `prog`) reduce readability
4. **Memory Leak:** Event handlers bound in `bindEvents()` but never unbound in `destroy()` — potential leak on scene transitions
5. **No Error Handling:** localStorage access can throw in private browsing — needs try-catch wrapper
6. **Code Duplication:** Arrow rendering repeats similar triangle logic 4 times

**Patterns Observed:**
- GuideSystem follows existing UI component structure (Container-based like EscMenu, ChatPanel)
- Event-driven architecture aligns with GameScene/HUDScene communication pattern
- Uses localStorage with project prefix `isoheim_tutorial_*`
- Positioned at depth 950/940 to overlay other UI elements

**Key Learnings:**
- Project uses Phaser.GameObjects.Container pattern for complex UI (not DOM)
- Event cleanup is critical — all `scene.events.on()` need corresponding `.off()` in destroy
- Constants pattern: top-level ALL_CAPS for dimensions/colors (see EscMenu: MENU_WIDTH, BUTTON_GAP)
- No tolerance for magic numbers — even colors and positions must be named
- Function size limit strictly enforced at ~20 lines

**Next Steps:** Reassigned to Leah (Frontend Dev) for refactoring. Will re-review once changes applied.

### 2026-03-16: PR #13 Review — Playwright config timeout fix
**Issue:** `expect.timeout` (60s) exceeded per-test `timeout` (30s), creating dead config and confusing error messages.
**Resolution:** Approved. Changed `expect.timeout` from 60s to 5s (Playwright default), keeping it well within 30s test budget.
**Pattern Observed:** Playwright E2E infrastructure was added in PR #11. This PR fixes a configuration inconsistency from that initial setup.
**Code Quality:** Clean config file, no code smells. The fix is a single-line change from `expect: { timeout: 60_000 }` to `expect: { timeout: 5_000 }`.
**Note:** PR is in draft status; ready to merge once un-drafted by maintainer.

## PR #20 Review — Wave B Code Complete (2026-03-21)
**Branch:** squad/5-potions-consumables → main  
**Status:** Review in progress  
**Agent Reviews:** Tyrael (Potions + Equipment Backend), Leah (Equipment Client UI)  
**Size:** 3 commits, 638 insertions, ~450 insertions, 12+ files modified  

**Scope:**
- **Potions & Consumables (#5):** Dual-cooldown system (15s shared, 30-60s per-item), HoT mechanics (bandage), instant consumable effects, client VFX support
- **Equipment Backend (#6):** 7-slot system, equip/unequip mechanics, stat recalculation, level/class requirements, ring auto-resolution, database persistence
- **Equipment UI (#6):** Paper-doll CharacterPanel layout, right-click dual-purpose (consumables→use, items→equip), stat comparison tooltips, equipment bonus display

**Build Status:** All 3 packages compile clean, ESLint passes, MegaLinter ready, TypeScript verified

**Quality Checkpoints:**
- Tyrael: ESLint cleanup completed, 0 errors
- Leah: UI component clean code patterns applied (named constants, function size, event cleanup)
- Shared messages: Protocol exports added (EquipItemMessage, UnequipItemMessage, EquipmentUpdateMessage)
- Lint-only changes separated from logic changes

**Notes:** Parallel work on same branch resolved by serializing branch-switch (Tyrael complete → Leah build). Lesson: Future waves should use git worktrees or explicit coordination protocol.

### PR #20 Review (2026-03-21) — Wave B: Potions & Equipment
**Verdict:** REQUEST CHANGES ❌

**Context:** 15 files changed, ~1087 insertions across shared/server/client. Two features: Potions & Consumables (#5) and Equipment & Gear (#6).

**Critical Bugs Found (3 Blockers):**
1. **Missing equip/unequip server handlers** — MessageHandler.ts switch has no `case EquipItem` or `case UnequipItem`. Equipment system is completely non-functional. Player.equipItem(), Player.unequipItem(), and Database save/load methods exist but are never called.
2. **Equipment never loaded** — handleSelectCharacter() loads inventory but never calls db.loadEquipment(). Equipment lost on reconnect.
3. **Equipment never saved** — saveAndRemovePlayer() and saveAllPlayers() persist character + inventory but never equipment. Lost on disconnect/restart.

**Type Safety Violations (2):**
4. `(player as any).bandageHealPerTick` — Property smuggled via `as any` in MessageHandler, read via `as any` in GameLoop. Should be a declared Player field.
5. `msg.effectType as any` in GameScene — ConsumableUsedMessage.effectType typed as string, should use union type matching VFXManager signature.

**Code Quality Issues:**
6. **Function size:** handleUseItem() at ~60 lines (3x guideline) — extract per-effect-type methods
7. **DRY:** Stat tooltip text building duplicated between CharacterPanel and InventoryPanel
8. **DRY:** Default equipment Map initialization copied in 3 places
9. **Magic numbers:** 30+ inline values in VFX consumable effects (colors, counts, sizes, durations)
10. **Naming:** Single-letter variables in VFX (g, ox, oy, r, a, px, py)
11. **Dead code:** Unused `color` variable in buildComparisonText(), unused STAT_NEUTRAL_COLOR constant

**What Was Done Well:**
- CharacterPanel refactored into clean extracted helpers (createCharacterInfo, createXpSection, createEquipmentSlots, addSeparator, createStatsSection)
- Equipment DB schema with transaction-based save pattern is solid
- Ring slot fallback logic (Ring1 → Ring2) correctly implemented on both client and server
- Protocol messages and shared types well-organized
- Bandage HoT interrupt on damage is clean design
- Named constants for consumable cooldowns (POTION_SHARED_COOLDOWN_MS, etc.)

**Key Learnings:**
- Integration bugs can hide when data layer and message layer are built separately — always verify the full message dispatch chain
- `as any` casts are a code smell that defeats TypeScript's value proposition; flag immediately
- When features span client+server, verify the full roundtrip: client sends → server handles → server persists → server loads → server sends
- Equipment Map initialization is a DRY candidate when the same structure appears in 3+ places
- VFX code is prone to magic number accumulation due to many visual parameters per effect

**Assignments:** Tyrael (server bugs #1-5, function size #6), Leah (VFX magic numbers #9, naming #10, DRY #7)
