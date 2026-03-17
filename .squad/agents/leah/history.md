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
