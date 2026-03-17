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
