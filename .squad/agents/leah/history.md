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
