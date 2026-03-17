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
