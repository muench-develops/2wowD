# Team Decisions

Central decision log for 2wowD MMO project. Track architectural choices, code standards, and feature decisions.

---

## Active Decisions

### Decision: PR #9 Review — ESC Menu with Logout

**Reviewer:** Kormac  
**Branch:** `squad/esc-menu-logout`  
**Date:** 2025-01-29  
**Status:** ✅ APPROVED

This PR adds ESC key game menu functionality with logout, plus Docker security hardening and ESM fixes. The code is clean, well-structured, and follows Uncle Bob's principles.

**Key Findings:**
- Movement stop BEFORE menu opens prevents stuck movement bug
- Clean event-driven architecture
- Proper Phaser scene lifecycle integration
- Docker security hardening (non-root USER, HEALTHCHECK)
- ESM __dirname fix properly applied

**Standards Applied:**
- Function size limit: ~20 lines ✅
- No magic numbers ✅
- Intention-revealing names ✅
- Resource cleanup ✅
- Error handling ✅
- DRY principle ✅

**Conclusion:** Ready to merge.

---

### Decision: Expanded MegaLinter Linters

**Date:** 2026-03-16  
**By:** Haedrig (DevOps)  
**PR:** #8 (squad/megalinter-linters)

Added 8 new linters to the CI pipeline:
- jscpd (copy/paste), cspell (spelling), v8r (JSON), yamllint (YAML)
- commitlint (conventional commits), gitleaks (secrets), checkov (license/security)
- tsc --noEmit (TypeScript type checking, separate CI job)

**Key Decisions:**
1. **tsc --noEmit as separate CI job** — MegaLinter has no native tsc type-check linter. Added it as a parallel job in the workflow so it runs alongside MegaLinter without blocking it.
2. **gitleaks over secretlint** — gitleaks is natively supported by MegaLinter (REPOSITORY_GITLEAKS) and has broader detection rules. Trivy (already enabled) covers CVEs; gitleaks covers secrets specifically.
3. **checkov for license checking** — MegaLinter's REPOSITORY_CHECKOV covers both license compliance and infrastructure security policies in one tool.
4. **cspell dictionary** — Pre-populated with game-specific terms (mana, mobs, rogue, phaser, isometric, etc.) and squad member names to avoid false positives on first run.
5. **jscpd thresholds** — Set to min 5 lines / 50 tokens as a reasonable starting point. Can tighten later if needed.

**Impact:** CI will now catch: duplicated code, typos, invalid YAML/JSON, leaked secrets, license issues, type errors, and non-conventional commits. All existing linters (ESLint, Prettier, markdownlint, Hadolint, Trivy) preserved.

---

### Decision: Clean Code Standards Enforcement on PR #15

**Date:** 2026-03-17  
**By:** Kormac (Code Reviewer)  
**Context:** PR #15 review — New Player Tutorial Guide System  
**Status:** ENFORCEMENT ACTIVE

Enforced Clean Code principles on first feature PR review. Identified 6 categories of violations that block merge despite functional correctness.

**Standards Applied:**

1. **Function Size Limit (~20 lines)**
   - Violation: `render()` method at 49 lines
   - Rationale: Large functions do multiple things, hard to test/maintain
   - Action Required: Extract into smaller, single-purpose methods

2. **No Magic Numbers**
   - Violation: Inline colors (0x1a1a2e), dimensions (420, 68), delays (5000)
   - Rationale: Intent unclear, duplication risk, hard to maintain consistency
   - Action Required: Extract ALL literals as named constants at top of file

3. **Intention-Revealing Names**
   - Violation: Single-letter vars (`s`, `W`, `H`), abbreviations (`bg`, `txt`, `prog`)
   - Rationale: Code should read like prose — names must reveal purpose
   - Action Required: Full descriptive names (`currentStep`, `BOX_WIDTH`, `messageText`)

4. **Resource Cleanup**
   - Violation: Event handlers bound but never unbound
   - Rationale: Memory leaks on scene destruction, especially in long-running games
   - Action Required: Track handlers, unbind in `destroy()`

5. **Error Handling**
   - Violation: localStorage access without try-catch
   - Rationale: Private browsing throws exceptions, crashes app
   - Action Required: Wrap storage operations, provide fallback behavior

6. **DRY (Don't Repeat Yourself)**
   - Violation: Arrow rendering duplicates similar triangle logic 4 times
   - Rationale: Copy-paste leads to inconsistencies, harder to change
   - Action Required: Extract helper method

**Precedent Set:**

Going forward, all PRs must meet these standards:
- Functions ≤ ~20 lines (extract if larger)
- Zero magic numbers (all literals named)
- No abbreviations or single-letter vars (except loop counters `i`, `j`)
- All event bindings cleaned up in destroy
- Try-catch on external APIs (localStorage, network)
- No copy-paste code — extract helpers

**Why This Matters:**

This is a **long-term MMO project**. Clean code isn't optional:
- Future developers (including ourselves in 6 months) need readable code
- Memory leaks compound over play sessions
- Magic numbers become "why did we choose this?" mysteries
- Large functions resist change and testing

**Outcome:** PR #15 **BLOCKED** until refactored. Reassigned to Leah for cleanup. Will re-review after changes.

**Team Impact:** Establishes that **functional correctness ≠ merge approval**. Code quality is a gate, not a suggestion. MegaLinter catches style; Kormac enforces Clean Code principles.

---

### Decision: ESC Menu in HUDScene (not separate scene)

**By:** Leah (Frontend Dev)  
**Date:** 2025-07-25

**What:** The ESC game menu is implemented as a UI component (`EscMenu`) instantiated inside `HUDScene`, rather than as a separate Phaser scene.

**Why:**
- HUDScene is already the UI overlay for GameScene — adding another overlay scene would complicate the scene lifecycle
- EscMenu needs to communicate with both GameScene (input blocking) and HUDScene (rendering) — living in HUDScene keeps the event flow simple
- The ESC key repurposed from "deselect target" to "toggle menu" — targeting can still be cleared by clicking empty space
- Follows the same Graphics+Zone+Text button pattern used in CharacterSelectScene modals (no DOM elements for the menu itself)

**Trade-offs:**
- ESC no longer deselects target (minor behavior change, click-to-deselect still works)
- Settings button is a placeholder — needs future implementation

---

### Decision: Issue #3 Decomposition — Zones, Portals & Dungeon

**Decomposed by:** Deckard  
**Date:** 2026-03-16  
**Status:** Ready for Sprint Planning

**Overview:**

Issue #3 requires implementing a multi-zone game world with zone transitions, new mob types, and server-side zone persistence.

**Scope:**
- **3 zones:** Starter Plains (50×50), Dark Forest (60×60), Ancient Dungeon (40×40)
- **Zone system:** ZoneManager with per-zone mobs, loot, portals
- **Player tracking:** `Player.currentZone` field, zone-scoped spatial queries
- **Portal mechanics:** Portal tiles trigger `ZoneChanged` message
- **5 new mob types:** Spider (poison DoT), Bandit (stun), Wolf Alpha (howl AoE), Skeleton Mage (ranged), Bone Lord (3 abilities boss)
- **Persistence:** Zone state persisted in DB
- **Client-side:** Zone transition overlay, tile palette switching, portal visuals, zone name HUD

**Key Architectural Decision:**

**Zones are shared areas, not instanced** — all players see the same zone state.

**Phase Breakdown:**

1. **Phase 1: Shared Types (2–3 hours)** — S1–S4
   - Blocker: None
   - Owner: Shared
   
2. **Phase 2: Backend (15–18 hours)** — T1–T8
   - Owner: Tyrael
   - Blocked on: Phase 1
   
3. **Phase 3: Frontend (12–15 hours)** — L1–L6
   - Owner: Leah
   - Blocked on: Phase 1

**Total Estimate:** 35–40 hours (5 developer-days with 2 devs parallel)

**Key Architectural Decisions:**

1. **Zones are shared** (not instanced) — all players see same zone state
2. **Multi-zone spatial isolation** — queries don't leak between zones
3. **Portal symmetry** — two-way travel between zones (recommended)
4. **Zone persistence** — mob spawns reset on server restart (consistent with existing)
5. **Ability transfer** — player abilities/buffs carry across zones

**Risk Mitigation:**

| Risk | Mitigation |
|------|-----------|
| Portal positions not symmetric between zones | Validate portal pairs in zone generators; add unit test |
| Spatial queries leak between zones | Exhaustive testing of zone isolation; add assertions |
| Stun AI halt causes game loop hiccup | Test stun application under load; profile |
| Large zone maps cause lag on client | Implement viewport culling for entities; test 60fps |
| Zone transition causes network sync loss | Add state validation message pre/post transition |
| New mob sprites not ready in time | Use placeholder colored squares; defer art polish to next phase |

**Critical Path:**

1. Phase 1 (Shared): S1–S4 (2–3 hours) ← **Blocker for both teams**
2. Phase 2 (Backend): T1 (1–2 hrs) → T2 (2–3 hrs) → T3 (2 hrs) → [T4, T5, T6, T7 parallel] → T8 (1 hr)
3. Phase 3 (Frontend): L1 (1 hr) → [L2, L3, L4 parallel] → L5 (2 hrs) → L6 (4–6 hrs)

**Suggested Sprint Breakdown:**
- Day 1: Phase 1 (Shared) — all members
- Day 2: Tyrael T1–T3 + Leah L1–L2 (parallel)
- Day 3: Tyrael T4–T7 + Leah L3–L4 (parallel)
- Day 4: Tyrael T8 + Leah L5–L6 (parallel)
- Day 5: Integration testing, bug fixes, optimization

**For Tyrael (Backend Lead):**
- Start with T1 (ZoneManager) immediately after Phase 1 complete
- T3 (World refactor) is highest complexity; plan for pair programming or detailed review
- T5 (portal handler) is critical path for L5; prioritize after T3

**For Leah (Frontend Lead):**
- L1 (zone awareness) is foundation; unblock yourself early
- L2–L4 have good parallelization opportunities
- L5 depends on T5 being testable; coordinate checkpoint with Tyrael

**For Deckard (Architecture Lead):**
- Review T3 (World refactor) for architectural impact
- Ensure zone isolation is bulletproof before shipping
- Monitor spatial query performance as zones scale
- Validate portal symmetry in map generators

---

## Historical Decisions

*Previous decisions archived. Current active decisions above.*

---

**Last Updated:** 2026-03-17T05:00:00Z  
**Scribe:** Copilot
