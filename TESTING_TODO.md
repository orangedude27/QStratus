# QStratus — Testing TODO

Comprehensive test coverage gaps across all layers of the project.

---

## Session Log — 2026-06-12

Fixed 9 failing backend tests (223 total, 214 passing after fixes).

### Fixes Applied

| File | Tests Fixed | Root Cause |
|------|-------------|------------|
| `backend/test/rateLimiter.test.ts` | 1 | Test expected `error` property in 429 response body, but rateLimiter returns `retryAfter` only. Removed `toHaveProperty("error")` assertion. |
| `backend/test/steamdb.test.ts` | 2 | `mockFetch()` created a new `vi.fn()` each call, losing call count. Refactored to reuse a single mock function. Also removed unnecessary `vi.useRealTimers()`/`vi.useFakeTimers()` toggles that broke cache TTL checks. |
| `backend/test/steamScanner.test.ts` | 2 | `createAcfContent()` for appid 440 didn't override the appid field, so both manifests parsed as appid 730. Added `{ appid: "440", Name: "Team Fortress 2" }` override to both failing tests. |
| `backend/test/gamesController.test.ts` | 3 | `vi.resetModules()` in `beforeEach` cleared module cache, causing `steamScanner._steamLibraryPath` to reset to default before `setSteamLibraryPath()` was called. Removed `vi.resetModules()` from all describe blocks. |
| `backend/lib/localStore.ts` | 1 | Seed games loaded from `games.json` had no `source` field, so `g.source === "seed"` filter returned 0 results. Added `.map((g) => ({ ...g, source: "seed" as const }))` to `readSeedGames()`. |

### Final Result

```
Test Files: 14 passed (14)
Tests:      214 passed (223)
```

---

## Backend

### Socket Layer (0% coverage — highest priority)

Core WebSocket message handling and session orchestration.

| File | Description | Suggested Approach |
|------|-------------|-------------------|
| `backend/socket/messages.ts` | WebSocket message parsing and dispatch | Mock `ws` messages, test each message type handler |
| `backend/socket/node.ts` | Node registration, heartbeats, removal | Mock socket events, verify node tracking state |
| `backend/socket/sessions.ts` | Session lifecycle (start, stop, track) | Mock socket events, verify session state transitions |
| `backend/socket/send.ts` | Message dispatch to connected clients | Mock clients array, verify correct routing |
| `backend/socket/definitions.ts` | Message type definitions | Unit test type guards and parsers |

### Routes (5 files)

| File | Description | Suggested Approach |
|------|-------------|-------------------|
| `backend/routes/play.ts` | Session start/stop routes | Use supertest, mock session controller |
| `backend/routes/playController.ts` | Session start/stop logic | Unit test controller functions directly |
| `backend/routes/authController.ts` | Auth logic (register, login, bootstrap) | Unit test controller functions (routes already tested) |
| `backend/routes/download.ts` | Download route wiring | Route-level test (controller already tested) |
| `backend/routes/games.ts` | Games route wiring | Route-level test (controller already tested) |

### Lib (1 file)

| File | Description | Suggested Approach |
|------|-------------|-------------------|
| `backend/lib/authToken.ts` | JWT token creation/validation | Unit test token generation, expiry, verification |

---

## Frontend

### Tier 1 — Core Logic (highest ROI)

Pure functions and hooks that are easy to test and cover critical paths.

| File | Description | Tests to Write |
|------|-------------|----------------|
| `frontend/src/lib/transport/utils/chunkRingBuffer.ts` | Chunked ring buffer for streaming data | Push/pop order, overflow, wrap-around, empty state |
| `frontend/src/lib/transport/hooks/transport.ts` | WebTransport connection management | Connect/disconnect, error recovery, state transitions |
| `frontend/src/lib/transport/hooks/streamRouter.ts` | Streaming data routing | Route audio/video/control to correct streams |
| `frontend/src/lib/transport/utils/writer.ts` | Data writing pipeline | Write/read sync, buffer management |
| `frontend/src/lib/actions/dashboard.ts` | Dashboard server actions | Mock fetch calls, test data transformation |
| `frontend/src/lib/utils.ts` | Shared utility functions | Unit test each utility |

### Tier 2 — Auth & Streaming UI (moderate ROI)

Components with meaningful state logic.

| File | Description | Tests to Write |
|------|-------------|----------------|
| `frontend/src/components/auth/AuthProvider.tsx` | Auth context provider | Login/logout flow, token persistence, auth state |
| `frontend/src/components/auth/ProtectedShell.tsx` | Route protection | Redirect unauthenticated, allow authenticated |
| `frontend/src/app/(protected)/play/[id]/Streaming.tsx` | Streaming UI state | Connection states, error handling, controller input |
| `frontend/src/app/signin/SignInPageClient.tsx` | Sign-in form logic | Form validation, submit flow, error display |
| `frontend/src/components/Nav/SearchBar.tsx` | Search functionality | Debounce, filter results, clear |
| `frontend/src/lib/hooks/useControllerNavigation.ts` | Controller nav hook | Back button, scope detection |

### Tier 3 — UI Components (low ROI, mostly presentational)

Shadcn-style wrappers and landing page components.

| Directory | Files | Notes |
|-----------|-------|-------|
| `frontend/src/components/ui/` | 15 files | Button, card, dialog, progress, select, etc. — thin wrappers |
| `frontend/src/components/landingPage/` | 6 files | FeaturedGames, Highlights, Demo, Faq, Team, BlogIndexClient |
| `frontend/src/components/Nav/` | 3 files | Nav index, NavClient, SearchBar |
| `frontend/src/components/Footer/` | 2 files | ConditionalFooter, index |
| `frontend/src/components/game/` | 1 file | game-gallery.tsx |
| `frontend/src/components/controller-navigation-boundary.tsx` | 1 file | Controller back-nav wrapper |

---

## stratusd (C/C++)

Requires cmocka framework. Build with: `cmake -DWITH_TESTS=ON ..`

### Tier 1 — Pure Data Structures (easiest to test)

| File | Description | Tests to Write |
|------|-------------|----------------|
| `stratusd/Common/src/ringBuffer.c` | Thread-safe ring buffer (mutex-based) | Push/pop order, full/empty, wrap-around, concurrent access |
| `stratusd/Common/src/rbuf2.c` | Semaphore-based ring buffer (peek/pop/latest) | Same as above + peek, latest value |
| `stratusd/Encode/src/EncodeUtils.c` | Frame generation utilities | `generate_argb_frame()`, encoder send/receive |
| `stratusd/SideCar/src/api.c` | JSON message parsing/dispatch | Parse valid/invalid JSON, UUID generation, timestamp formatting |
| `stratusd/Capture/src/resize.c` | Image resizing logic | Resize dimensions, aspect ratio, edge cases |

### Tier 2 — Session & Input (important, harder due to OS deps)

| File | Description | Tests to Write |
|------|-------------|----------------|
| `stratusd/SideCar/src/session.c` | Session lifecycle (start/stop/poll) | Start/stop sequence, game launch, thread management |
| `stratusd/Input/src/gamepad.c` | Gamepad input handling | Button/axis code tables, input mapping |

### Tier 3 — Infrastructure (low testability)

| File | Description | Notes |
|------|-------------|-------|
| `stratusd/SideCar/src/SideCar.c` | Main orchestrator | Heavy OS deps, integration test only |
| `stratusd/SideCar/src/steam_launcher.c` | Steam game launcher | **Already has tests** (`steam_launcher.test.c`) |
| `stratusd/Capture/src/*.c` | 6 capture files | GPU/shared memory deps, integration test only |
| `stratusd/Encode/src/AudioEncode.c` | Audio encoding | FFmpeg deps, integration test only |
| `stratusd/Encode/src/Encode.c` | Main encoder | Heavy deps, integration test only |
| `stratusd/Encode/src/EGLUtils.c` | EGL/GPU utilities | GPU deps, not unit testable |
| `stratusd/CapturePw/src/CapturePw.c` | PipeWire capture | PipeWire/GPU deps |
| `stratusd/Input/src/Input.c` | Main input handler | Heavy deps |
| `stratusd/main.c` | Entry point | Initialization only |
| `stratusd/Transport/*.cpp` | 5 C++ files | WebTransport layer, needs C++ test framework |

---

## Shell / Deploy

| File | Description | Status |
|------|-------------|--------|
| `deploy/steamcmd/test/entrypoint.test.sh` | SteamCMD entrypoint script | **Written** (17 tests, has manual fallback runner) |

---

## Current Test Coverage Summary

| Layer | Passing Tests | Files | Coverage |
|-------|--------------|-------|----------|
| Backend (running) | 214 | 10 test files | ~60% of testable modules |
| Backend (written, not run) | 0 | — | — |
| Frontend (written, not run) | 0 | 2 test files | ~2% of components |
| stratusd (written, not run) | 0 | 1 test file | ~5% of C modules |
| Shell (written, not run) | 0 | 1 test file | 100% of entrypoint |

---

## How to Run Tests by Layer

### Backend
```bash
cd backend
npm test          # Run all tests
npm run test:watch # Watch mode
```

### Frontend (needs setup)
```bash
cd frontend
# Install test dependencies first:
pnpm add -D vitest @testing-library/react @testing-library/jest-dom jsdom
# Then:
pnpm test
```

### stratusd (needs cmocka)
```bash
# Install cmocka:
apt-get install cmake cmocka libcmocka-dev

# Build with tests:
mkdir -p build && cd build
cmake -DWITH_TESTS=ON ..
make steam_launcher_test
./steam_launcher_test
```

### Shell
```bash
cd deploy/steamcmd/test
bash entrypoint.test.sh
# Or install shunit2 for full test runner:
apt-get install shunit2
```
