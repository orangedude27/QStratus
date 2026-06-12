# QStratus — Session Resume Guide

**Session date:** 2026-06-11
**Last action:** Writing test TODO items and this resume file (session was interrupted before writing tests)

---

## What Was Being Done

The session was building out the **Steam Integration** feature (Milestones 1-4) and writing a comprehensive test suite. All code implementation is complete. The test suite has 134 passing tests across 8 files, but 8 test files are still missing (listed in TODO.md).

**The session was interrupted before writing these remaining tests:**
1. `backend/test/downloadController.test.ts` — download trigger/status endpoints
2. `backend/test/auth.test.ts` (append) — bootstrap + auth config endpoints
3. `backend/test/dockerTrigger.test.ts` — Docker API module
4. `stratusd/test/steam_launcher.test.c` — C-level Steam launcher tests
5. `frontend/tests/download-progress.test.tsx` — React component tests
6. `frontend/tests/discover-page.test.tsx` — React page tests
7. `deploy/steamcmd/test/entrypoint.test.sh` — shell script tests

---

## Current State Summary

### Completed Code (all committed/ready)
- **SteamCMD Worker:** Dockerfile, entrypoint.sh, optional compose service
- **Backend:** steamScanner.ts, steamdb.ts, dockerTrigger.ts, rateLimiter.ts, storeValidation.ts, extended localStore.ts, extended gamesController.ts, downloadController.ts
- **Frontend:** types, actions, discover page, manage page, download-progress component, auth config-aware sign-in
- **stratusd:** steam_launcher.c, extended session.c, extended SideCar.c (MAX_GAMES=64)
- **Deploy:** docker-compose.selfhost.yml (steamcmd service, Docker socket mount), nginx/caddy configs, docs

### Test Coverage (134 tests, all passing)
| File | Tests |
|------|-------|
| `storeValidation.test.ts` | 29 |
| `localStore.test.ts` | 30 |
| `auth.test.ts` | 15 |
| `integration.test.ts` | 7 |
| `gamesController.test.ts` | 17 |
| `steamScanner.test.ts` | 13 |
| `steamdb.test.ts` | 10 |
| `rateLimiter.test.ts` | 13 |
| **Total** | **134** |

### Missing Tests (8 files)
See TODO.md "Test Suite — Remaining Work" section for details.

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

If continuing with **tests** (what was in progress):
- `backend/test/downloadController.test.ts` — Start here, most straightforward
- `backend/test/dockerTrigger.test.ts` — Mock Docker API calls
- Append bootstrap/auth config tests to existing `backend/test/auth.test.ts`

If continuing with **Linux host testing**:
- `deploy/docker-compose.selfhost.yml` — Start stack with `--profile steam`
- Test: scan → claim → download → launch flow end-to-end
- Test GPU passthrough with `/dev/dri`
- Test WebTransport connectivity on UDP port 4433

If continuing with **stratusd hardening**:
- `stratusd/Dockerfile` — Reduce `privileged` scope, add device bindings
- `stratusd/SideCar/src/SideCar.c` — Add heartbeat appid/source fields

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
- Comprehensive test suite (134 tests)

The next logical step is either:
1. **Finish the test suite** (8 missing test files, ~80 more tests)
2. **Linux host validation** (end-to-end flow testing)
3. **stratusd hardening** (heartbeat appid fields, container permissions)
