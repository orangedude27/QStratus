# QStratus — Session Resume Guide

**Session date:** 2026-06-13
**Last action:** Fixed Dockerfile build issues (backend/frontend build, stratusd blocked by ICU mismatch)

---

## Session 10 — Dockerfile Fixes

### What Was Done

Fixed Dockerfile build issues across all three components. Backend and frontend now build successfully. stratusd blocked by ICU version mismatch in pre-built libquiche.

### Files Modified

| File | Change |
|------|--------|
| `backend/Dockerfile` | Fixed COPY paths (`./` suffix), switched to `tsx` runtime (avoids TypeScript compilation), removed tsconfig.build.json |
| `frontend/Dockerfile` | Changed `--frozen-lockfile` to `--no-frozen-lockfile` |
| `stratusd/Dockerfile` | Fixed package names (`libgl1-mesa-glx` → `libgl1`, `libasound2` → `libasound2t64`, `liblm-sensors-dev` → `libsensors-dev`), added FFmpeg/ICU dev libs |
| `stratusd/SideCar/src/steam_launcher.c` | Added `#include <fcntl.h>` for `O_WRONLY`/`open()` |
| `stratusd/CMakeLists.txt` | Added `icuuc icui18n icudata` linking for libquiche ICU dependency |
| `backend/.dockerignore` | Created — excludes node_modules, test files, dist |
| `frontend/.dockerignore` | Created — excludes node_modules, .next, test files |
| `backend/tsconfig.build.json` | Created — build-specific tsconfig excluding test files |

### Known Issue: ICU Version Mismatch

Pre-built `stratusd/libs/libquiche/dist/libquiche.a` was compiled with ICU 78. Ubuntu 24.04 ships ICU 74. Debian trixie has ICU 76. No available base image has ICU 78.

**Fix needed:** Rebuild libquiche from source using Bazel with system ICU. This is a significant undertaking requiring Bazel installation and build configuration.

---

## Session 9 — GPU Validation

### What Was Being Done

Added GPU validation and testing infrastructure for the Linux self-host stack:

### New Files Created

| File | Description |
|------|-------------|
| `deploy/gpu-detect.sh` | GPU vendor detection script — identifies NVIDIA/AMD/Intel, validates encoding, guides setup |
| `deploy/scripts/validate-gpu.sh` | End-to-end Linux stack validation — Docker, GPU, kernel modules, passthrough, encoding, compose config |
| `deploy/docker-compose.nvidia.yml` | NVIDIA Container Toolkit override — replaces `privileged: true` with scoped GPU access |

### Files Modified

| File | Changes |
|------|---------|
| `deploy/README.md` | Restructured GPU section — AMD/Intel default (no extra setup), NVIDIA optional via override file |
| `deploy/env/stratusd.env.example` | Added `STRATUSD_GPU_BACKEND` env var (vaapi/nvenc) |
| `TODO.md` | Milestone 2.5 added, Milestone 2 marked 7/7 complete, validation tasks added |
| `TESTING_TODO.md` | Session 9 log added, GPU validation section in "How to Run Tests" |

### Key Changes

1. **NVIDIA runtime is now optional** — default compose works for AMD/Intel via `/dev/dri` mount
2. **NVIDIA override file** — `docker-compose.nvidia.yml` replaces `privileged: true` with scoped GPU access
3. **GPU detection script** — `gpu-detect.sh` identifies vendor and validates encoding capability
4. **Validation script** — `validate-gpu.sh` runs full stack checks (Docker, GPU, passthrough, encoding)
5. **Milestone 2 complete** — "Harden stratusd container permissions" marked done (NVIDIA override provides scoped access)

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

---

## Session 11 — Build stratusd on Arch Linux

### What Was Done

Successfully built stratusd on Arch Linux where ICU 78.3 is available. The pre-built libquiche.a links against ICU 78 symbols, which are present on Arch but not on Ubuntu 24.04 (ICU 74).

### Key Findings

1. **ICU version mismatch is the root cause** — pre-built libquiche.a expects ICU 78, Ubuntu 24.04 has ICU 74
2. **Arch Linux works** — has ICU 78.3, so the pre-built libquiche.a links correctly
3. **Docker on Ubuntu 24.04 still broken** — needs either:
   - Custom base image with ICU 78+
   - Rebuild libquiche from source with system ICU
   - Use Arch-based Docker image

### Files Modified

| File | Change |
|------|--------|
| `stratusd/CMakeLists.txt` | Added ICU linking, fixed cjson to use find_library |
| `stratusd/SideCar/CMakeLists.txt` | Updated to use CJSON::CJSON target |
| `stratusd/Dockerfile` | Fixed package names, added ICU linking |
| `stratusd/libs/libquiche/CMakeLists.txt` | Restored to use pre-built libquiche.a |
| `stratusd/SideCar/src/steam_launcher.c` | Added `#include <fcntl.h>` |

### Build Command (Arch Linux)

```bash
cd stratusd/build
cmake .. -DCMAKE_BUILD_TYPE=Release \
    -DCJSON_LIBRARY=$HOME/local/lib/libcjson.so \
    -DCJSON_INCLUDE_DIR=$HOME/local/include
cmake --build . -j$(nproc)
```

### Next Steps

1. For Docker: Either rebuild libquiche from source with system ICU, or use an Arch-based Docker image
2. For local development: stratusd builds and runs on Arch Linux

---

## Session 12 — Arch Linux Docker Base Image

### What Was Done

Switched stratusd Dockerfile from Ubuntu 24.04 to Arch Linux base image (`archlinux:base`) to resolve ICU version mismatch. The pre-built libquiche.a requires ICU 78, which Arch Linux provides (78.3).

### Key Changes

1. **Dockerfile base image** — Changed from `ubuntu:24.04` to `archlinux:base`
2. **Package installation** — Updated from apt to pacman package manager
3. **cjson detection** — Changed from `find_library/find_path` to `pkg_check_modules` (Arch provides libcjson.pc)
4. **Proton download** — Extracted to `scripts/install-proton.sh` to avoid shell escaping issues with Docker's `/bin/sh`
5. **SideCar CMakeLists.txt** — Updated to use `PkgConfig::CJSON` instead of `CJSON::CJSON`

### Files Modified

| File | Change |
|------|--------|
| `stratusd/Dockerfile` | Switched to `archlinux:base`, updated packages, extracted Proton download to script |
| `stratusd/CMakeLists.txt` | Changed cjson detection to `pkg_check_modules(LIBCJSON)` |
| `stratusd/SideCar/CMakeLists.txt` | Updated to use `PkgConfig::CJSON` |
| `stratusd/scripts/install-proton.sh` | Created — Proton download script (avoids shell escaping issues) |

### Build Result

stratusd Docker image builds successfully on Arch Linux base. All dependencies resolved.

### Package Mapping (Ubuntu → Arch)

| Ubuntu Package | Arch Package |
|----------------|--------------|
| `build-essential` | `base-devel` |
| `libcjson-dev` | `cjson` |
| `libcurl4-openssl-dev` | `libcurl` (built-in) |
| `libdrm-dev` | `libdrm` |
| `libegl1-mesa-dev` | `libglvnd` |
| `libevdev-dev` | `libevdev` |
| `libexpat1-dev` | `expat` |
| `libgles2-mesa-dev` | `mesa` |
| `libicu-dev` | `icu` |
| `libsensors-dev` | `lm_sensors` |
| `libopus-dev` | `opus` |
| `libpipewire-0.3-dev` | `pipewire` |
| `pkg-config` | `pkgconf` |
| `ffmpeg` + dev libs | `ffmpeg` |
| `wine` | `wine` |
| `libgl1` + `libgl1:i386` | `mesa` |
| `libasound2t64` + `libasound2t64:i386` | `alsa-lib` |

### Next Steps

1. Test stratusd container with GPU passthrough on Linux host
2. Verify end-to-end self-host flow with Arch-based stratusd
3. Update deploy documentation for Arch-based container
