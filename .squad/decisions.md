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

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction
- All code changes go through PRs — Kormac reviews for clean code compliance
