# Deckard — History

## Learnings
- Project started 2026-03-16 by muench-develops
- Phase 1 (core game) and Wave 1 (XP, buffs, crits, minimap, sound) complete
- Auth system with SQLite persistence complete
- Key bug fixed: HUDScene launch order race condition (skills bar not showing)
- Build chain: build:shared first, then server+client parallel via concurrently
- Phaser renders to canvas — must use page.mouse for Playwright, not DOM events
- Client uses Vite with alias @2wowd/shared → ../shared/src
