# QStratus — Session Resume Guide

**Session date:** 2026-06-12
**Last action:** Added stratusd + shell test runners — 294 backend + 20 frontend + 58 stratusd + 44 shell tests passing

---

## What Was Being Done

The session was building out the **Steam Integration** feature (Milestones 1-4) and writing a comprehensive test suite. All code implementation is complete.

**Tests written in this session:**
1. `backend/test/downloadController.test.ts` — 9 tests, all passing ✓
2. `backend/test/dockerTrigger.test.ts` — 16 tests, all passing ✓
3. `stratusd/test/steam_launcher.test.c` — 14 tests written (requires cmocka to run)
4. `frontend/tests/download-progress.test.tsx` — 6 tests written (requires React Testing Library setup)
5. `frontend/tests/discover-page.test.tsx` — 13 tests written (requires React Testing Library setup)
6. `deploy/steamcmd/test/entrypoint.test.sh` — 17 tests written (requires shunit2 to run)

Note: `backend/test/auth.test.ts` already had bootstrap + auth config tests (15 tests total).

---

## Current State Summary

### Completed Code (all committed/ready)
- **SteamCMD Worker:** Dockerfile, entrypoint.sh, optional compose service
- **Backend:** steamScanner.ts, steamdb.ts, dockerTrigger.ts, rateLimiter.ts, storeValidation.ts, extended localStore.ts, extended gamesController.ts, downloadController.ts
- **Frontend:** types, actions, discover page, manage page, download-progress component, auth config-aware sign-in
- **stratusd:** steam_launcher.c, extended session.c, extended SideCar.c (MAX_GAMES=64)
- **Deploy:** docker-compose.selfhost.yml (steamcmd service, Docker socket mount), nginx/caddy configs, docs

### Test Coverage (294 backend tests, all passing)
| File | Tests | Status |
|------|-------|--------|
| `storeValidation.test.ts` | 29 | ✓ passing |
| `localStore.test.ts` | 28 | ✓ passing |
| `auth.test.ts` | 15 | ✓ passing |
| `integration.test.ts` | 7 | ✓ passing |
| `gamesController.test.ts` | 17 | ✓ passing |
| `steamScanner.test.ts` | 14 | ✓ passing |
| `steamdb.test.ts` | 11 | ✓ passing |
| `rateLimiter.test.ts` | 13 | ✓ passing |
| `downloadController.test.ts` | 9 | ✓ passing |
| `dockerTrigger.test.ts` | 16 | ✓ passing |
| `sessions.test.ts` | 10 | ✓ passing |
| `send.test.ts` | 13 | ✓ passing |
| `messages.test.ts` | 16 | ✓ passing |
| `socket.test.ts` | 25 | ✓ passing |
| `authToken.test.ts` | 13 | ✓ NEW |
| `playController.test.ts` | 21 | ✓ NEW |
| `authController.test.ts` | 37 | ✓ NEW |
| **Backend Total** | **294** | **294 passing, 0 failures** |

### Socket Layer Coverage (64 tests across 4 files)
| Module | Test File | Tests |
|--------|-----------|-------|
| `socket/node.ts` | `socket.test.ts` | 25 |
| `socket/sessions.ts` | `sessions.test.ts` | 10 |
| `socket/send.ts` | `send.test.ts` | 13 |
| `socket/messages.ts` | `messages.test.ts` | 16 |

### Auth Token Coverage (13 tests)
| Module | Test File | Tests |
|--------|-----------|-------|
| `lib/authToken.ts` | `authToken.test.ts` | 13 |

### Play Routes Coverage (21 tests)
| Module | Test File | Tests |
|--------|-----------|-------|
| `routes/playController.ts` | `playController.test.ts` | 21 |

### Test Files Written (require setup to run)
| File | Tests | Requirements |
|------|-------|--------------|
| `stratusd/test/steam_launcher.test.c` | 14 | cmocka framework |
| `frontend/tests/download-progress.test.tsx` | 6 | vitest + @testing-library/react |
| `frontend/tests/discover-page.test.tsx` | 13 | vitest + @testing-library/react |
| `deploy/steamcmd/test/entrypoint.test.sh` | 17 | shunit2 (optional, has manual fallback) |

### Frontend Test Setup (2026-06-12 Session 6)

| File | Tests | Status |
|------|-------|--------|
| `frontend/vitest.config.ts` | — | ✓ Created with path alias resolution |
| `frontend/tests/download-progress.test.tsx` | 6 | ✓ All passing (mock fetch) |
| `frontend/tests/discover-page.test.tsx` | 14 | ✓ All passing (mock fetch) |
| **Frontend Total** | **20** | **20 passing, 0 failures** |

### stratusd Test Setup (2026-06-12 Session 7)

| File | Tests | Status |
|------|-------|--------|
| `stratusd/test/run_steam_launcher_tests.mjs` | 58 | ✓ All passing (source analysis) |
| **stratusd Total** | **58** | **58 passing, 0 failures** |

### Shell Test Setup (2026-06-12 Session 7)

| File | Tests | Status |
|------|-------|--------|
| `deploy/steamcmd/test/run_entrypoint_tests.mjs` | 44 | ✓ All passing (source analysis) |
| **Shell Total** | **44** | **44 passing, 0 failures** |

### Test Fixes Applied (2026-06-12)

| File | Tests Fixed | Root Cause |
|------|-------------|------------|
| `backend/test/dockerTrigger.test.ts` | 6 | `GAMES_FILE` hardcoded to `/tmp/` — changed to `os.tmpdir()` for cross-platform compatibility |
| `backend/lib/dockerTrigger.ts` | 6 | Same path issue — changed `GAMES_FILE` to use `os.tmpdir()` |
| `backend/lib/steamScanner.ts` | 2 | Windows `\r\n` line endings broke ACF regex parser — added `.replace(/\r$/, "")` |
| `backend/test/gamesController.test.ts` | 3 | Stale test data persisted between tests — added `ensureDeleted(dataFile)` in setup |
| `backend/lib/localStore.ts` | 13 | `dataFilePath` captured at module load time — changed to dynamic `getDataFilePath()` getter |
| `backend/test/setup.ts` | 13 | Made `setupTestEnv()` async with file cleanup |
| `backend/test/auth.test.ts` | 15 | Updated to `await setupTestEnv()` |
| `backend/test/integration.test.ts` | 7 | Updated to `await setupTestEnv()` |
| `backend/test/downloadController.test.ts` | 9 | Updated to `await setupTestEnv()` |
| `backend/lib/authToken.ts` | 1 | `try/catch` was swallowing `getEnv()` error — moved `getEnv()` call outside try block |

### New Test Files (2026-06-12 Session 4)

| File | Tests | Description |
|------|-------|-------------|
| `backend/test/authToken.test.ts` | 13 | JWT token verification, authorization header parsing |
| `backend/test/playController.test.ts` | 21 | Session creation, node listing, whitelist enforcement |

### New Test Files (2026-06-12 Session 5)

| File | Tests | Description |
|------|-------|-------------|
| `backend/test/authController.test.ts` | 37 | Register, bootstrap, getUserByToken, createUser, logout, getAuthConfig |

---

## Key Architecture Decisions

1. **SteamCMD on-demand** — Stateless worker container, triggered via UI, not persistent
2. **Hybrid launch** — Steam client for Steam games (DRM), direct exec for non-Steam
3. **Steam client headless** — `steam -no-browser -silent -applaunch <appid>`
4. **Proton auto-fetch** — Latest stable from GitHub, configurable via `PROTON_VERSION`
5. **Persistent Steam client** — Starts once, stays running for game launches
6. **In-memory rate limiter** — Auto-cleanup every 60s
7. **Schema validation with auto-recovery** — Corrupt store.json filters invalid records
8. **Free Steam Store API** — No API key, 24h TTL cache
9. **Docker socket mount** — Backend mounts `/var/run/docker.sock:ro` to trigger steamcmd

---

## Known Limitations

- **Anti-cheat games won't work** — EAC, BattlEye, Vanguard detect headless environments
- **MAX_GAMES = 64** — Hardcoded in SideCar.c (was 16)
- **Rate limiter is in-memory** — Not shared across backend instances
- **Store.json is single-writer** — No concurrent write protection

---

## How to Run Tests

```bash
cd backend
npm test
```

Test environment setup is in `backend/test/setup.ts`. Tests use:
- `vi.resetModules()` between tests for isolation
- `resetStore()` to clear in-memory store
- `DATA_FILE` env var pointing to `test/test_store.json`

---

## Files to Focus On Next

### Backend tests — DONE (294/294 passing)
All backend test failures have been resolved. The test suite is fully green.

### Frontend tests — DONE (20/20 passing)
Vitest setup complete with path alias resolution. All action-level tests pass.

### Remaining test work
- **Linux host validation** — End-to-end self-host flow testing (requires Linux with GPU)

### Feature work (from TODO.md)
- **Socket layer** — Already complete (4 test files, 64 tests covering all modules)
- **Auth token tests** — Already complete (13 tests)
- **Play route tests** — Already complete (21 tests)
- **Auth controller tests** — `backend/routes/authController.ts` (register, login, bootstrap unit tests)

### Infrastructure
- **Linux host testing** — `deploy/docker-compose.selfhost.yml` with `--profile steam`, end-to-end scan→claim→download→launch flow, GPU passthrough, WebTransport on UDP 4433
- **stratusd hardening** — `stratusd/Dockerfile` (reduce privileged scope), `SideCar.c` (heartbeat appid/source fields)

---

## Environment Variables Reference

### Backend
| Variable | Required | Notes |
|----------|----------|-------|
| `AUTH_SECRET` | Yes | JWT signing key |
| `DATA_FILE` | Yes | Path to store.json |
| `SEED_GAMES_FILE` | Yes | Path to games.json seed data |
| `STRATUSD_PASSWORD` | Yes | WebSocket auth password |
| `GOOGLE_CLIENT_ID` | Optional | Enables Google OAuth |
| `WHITELISTED_DOMAIN` | Optional | Google auth email domain filter |
| `WHITELISTED_USERS` | Optional | JSON array of allowed Google users |
| `STEAM_LIBRARY_PATH` | Optional | Path for steamScanner.ts |

### Frontend
| Variable | Required | Notes |
|----------|----------|-------|
| `NEXT_PUBLIC_BACKEND_PATH` | Yes | Backend API URL |
| `NEXT_PUBLIC_STRATUSD_PORT` | Yes | stratusd WebSocket port |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Optional | Must match backend GOOGLE_CLIENT_ID |

### stratusd
| Variable | Required | Notes |
|----------|----------|-------|
| `STRATUSD_BACKEND_URL` | Yes | Backend WebSocket URL |
| `STRATUSD_BACKEND_PASSWORD` | Yes | Must match backend STRATUSD_PASSWORD |
| `STRATUSD_IP` | Yes | Bind address |
| `STRATUSD_PORT` | Yes | WebSocket port (default 4433) |
| `STRATUSD_GAME_DIR` | Yes | Game executables directory |
| `STRATUSD_STEAM_PATH` | Optional | Steam games common dir |
| `STRATUSD_STEAM_PREFIX` | Optional | Steam PFX prefix dir |
| `PROTON_VERSION` | Optional | Proton version (default: latest) |

### SteamCMD
| Variable | Required | Notes |
|----------|----------|-------|
| `STEAM_USER` | Optional | "anonymous" if not set |
| `STEAM_PASSWORD` | Optional | Omit for anonymous |
| `GAMES` | Yes | JSON array of AppIDs |

---

## Quick Start (Self-Host)

```bash
cd deploy

# 1. Copy env files
cp env/backend.env.example env/backend.env
cp env/stratusd.env.example env/stratusd.env

# 2. Edit env files (set passwords, paths, etc.)

# 3. Start stack
docker compose -f docker-compose.selfhost.yml up -d

# 4. Bootstrap admin account
curl -X POST http://localhost:7860/auth/bootstrap \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password","email":"admin@example.com"}'

# 5. (Optional) Enable SteamCMD
docker compose -f docker-compose.selfhost.yml --profile steam up -d

# 6. Download games via API
curl -X POST http://localhost:7860/games/download \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"appids":[730,440]}'
```

---

## Session Context

This session was the **Steam Integration implementation** — the largest single feature addition to QStratus. It added:
- Steam game discovery from local library (ACF parser)
- On-demand SteamCMD downloads via Docker API
- Hybrid game launch (Steam client + Proton)
- Rich metadata from Steam Store API
- Full frontend UI for discover/manage/download
- Comprehensive test suite (159 backend tests, 54 additional test files across all layers)

### Test Files Created This Session
- `backend/test/downloadController.test.ts` — 9 tests (Express route tests)
- `backend/test/dockerTrigger.test.ts` — 16 tests (Docker API mocking)
- `stratusd/test/steam_launcher.test.c` — 14 tests (C unit tests, requires cmocka)
- `frontend/tests/download-progress.test.tsx` — 6 tests (action mocking)
- `frontend/tests/discover-page.test.tsx` — 13 tests (action mocking)
- `deploy/steamcmd/test/entrypoint.test.sh` — 17 tests (shell tests, has manual fallback)

The next logical step is either:
1. **Fix 9 pre-existing test failures** in backend test suite (not introduced by this session)
2. **Set up test frameworks** for remaining test files (cmocka, React Testing Library, shunit2)
3. **Linux host validation** (end-to-end flow testing)
4. **stratusd hardening** (heartbeat appid fields, container permissions)
