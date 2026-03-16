# Haedrig — History

## Learnings
- Project: 2wowD, 2D isometric MMO by muench-develops
- GitHub account: muench-develops, authenticated via gh CLI
- npm workspaces monorepo at /Users/justinmunch/Entwicklung/2wowD
- Server deps: ws, better-sqlite3, @2wowd/shared
- Client deps: phaser, vite, @2wowd/shared
- Build: npm run build (shared → server+client parallel via concurrently)

### 2026-03-16: Git repo + GitHub created
- Initialized git, created muench-develops/2wowD on GitHub (public)
- Default branch: main
- Added README.md (screenshots, features, tech stack, getting started)
- Added LICENSE (MIT, 2026 muench-develops)
- Updated .gitignore with *.db, .env.*, .mega-linter-reports/, *.log

### 2026-03-16: Docker setup
- Dockerfile.server: multi-stage Node 20 alpine, builds shared+server, runs with --omit=dev
- Dockerfile.client: multi-stage Node 20 alpine → nginx:alpine, serves built client
- nginx.conf: SPA fallback + /ws proxy to server:8080 (WebSocket upgrade)
- docker-compose.yml: server (port 8080) + client (port 3000), shared network, volume for game.db
- .dockerignore: excludes node_modules, dist, .git, .squad
- Client WS connects to ws://<hostname>:8080 directly (uses window.location.hostname); port 8080 is exposed in compose so it works without nginx proxy in current architecture

### 2026-03-16: MegaLinter + CI
- .mega-linter.yml: ESLint (TS), Prettier (JSON), markdownlint, Hadolint, Trivy
- .eslintrc.json: @typescript-eslint/recommended, warn on unused vars + explicit any
- .markdownlint.json: disabled MD013 (line length), MD033 (inline HTML), MD041 (first-line heading)
- .github/workflows/mega-linter.yml: runs on push/PR to main, oxsecurity/megalinter@v8

### 2026-03-16: Branch protection on main
- Applied via GitHub REST API (gh api)
- Required PR reviews: 1 approving review
- Required status checks: MegaLinter (strict mode — branch must be up-to-date)
- enforce_admins: false (owner can bypass in emergencies)
- Force pushes and branch deletion: disabled

### 2026-03-16: GitHub labels + issues created
- Created 7 squad labels: squad, squad:tyrael, squad:leah, squad:kormac, wave-a, wave-b, wave-c
- Created 7 feature issues:
  - #1 Items, Inventory & Loot (wave-a, tyrael+leah)
  - #2 Mob & Map Collision (wave-a, tyrael)
  - #3 Zones, Portals & Dungeon (wave-a, tyrael+leah)
  - #4 New Player Guide (wave-a, leah)
  - #5 Potions & Consumables (wave-b, tyrael+leah) — depends on #1
  - #6 Equipment & Gear (wave-b, tyrael+leah) — depends on #1
  - #7 NPCs & Quest System (wave-c, tyrael+leah) — depends on #1 + #3
- Wave structure: A (foundation, no deps) → B (needs items) → C (needs items+zones)
