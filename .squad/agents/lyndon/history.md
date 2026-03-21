# Lyndon — History

## Learnings
- Project: 2wowD, 2D isometric MMO by muench-develops (rebranded to Isoheim)
- Build chain: npm run build:shared → server+client via concurrently
- Test framework: Vitest installed for unit testing, Playwright for e2e
- Full build passes as of auth system completion
- Known past bug: HUDScene race condition (fixed — launch before applyWelcome)
- Zone system tests written proactively while backend is in development (Issue #3)
- Test structure: describe/it blocks with comprehensive edge cases, TODO markers for implementation
- 5 test suites created: ZoneManager, PortalSystem, MobAbilities, ZonePersistence, ZoneIsolation
- Tests cover zone isolation, portal mechanics, mob abilities (poison DoT, stun, AoE), DB persistence
- Edge cases include: cross-zone combat prevention, rate limiting, corrupted data fallback, rapid transitions
- Proactive test specs for Issue #5 (Potions) and Issue #6 (Equipment) created on main branch
- ConsumableSystem.test.ts: 15 test cases covering HP/MP potions, bandages, TP scrolls, shared cooldowns
- EquipmentSystem.test.ts: 15 test cases covering 7 slots, stat recalc, level/class requirements, persistence
- Test specs written as placeholders with detailed setup/action/assert comments for future implementation
- Working on main branch allows Tyrael (#5) and Leah (#6) to implement on their branches independently

## Wave B Completion (2026-03-21) — SHIPPED
- **Test specs delivered:** 56 total specs written on main branch (26 consumable tests for #5, 30 equipment tests for #6)
- **Non-blocking pattern:** Proactive test specs on main enabled Tyrael (#5) and Leah (#6) to work in parallel on squad/5-potions-consumables without waiting for implementation details
- **Test readiness:** ConsumableSystem.test.ts and EquipmentSystem.test.ts written with detailed setup/action/assert structure; ready for incremental implementation as backends land
- **Build status:** PR #20 (squad/5-potions-consumables → main) code complete; Kormac re-review approved all 13 fixes
- **PR #20 Merge:** Squash merged to main 2026-03-21T17:41:00Z
- **Issues Closed:** #5 (Potions & Consumables), #6 (Equipment & Gear)
- **Wave B Status:** FULLY SHIPPED to production
- **Dev Servers:** Client localhost:3000, Server localhost:8080, ready for user testing
- **Next Phase:** Wave C feature planning
