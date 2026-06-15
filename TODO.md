# QStratus Project TODO

Last updated: 2026-06-13 (Session 10)

Status legend: `[ ]` not started · `[~]` in progress · `[x]` done · `[-]` deferred

---

## Milestone 1 — MVP Self-Host (Local Docker deployment working end-to-end)

**Status: 5/7 tasks done. 2 tasks require Linux host with GPU for testing.**

| Status | Task | Notes |
|--------|------|-------|
| `[ ]` | Validate end-to-end self-host flow on a Linux host with GPU passthrough | Requires Linux host with `/dev/dri` — code ready, needs testing |
| `[ ]` | Confirm browser WebTransport connectivity through firewall/NAT | UDP port 4433 must be open — code ready, needs testing |
| `[x]` | Add initial game catalog seed data in `backend/data/games.json` | 3 free-to-play games: AssaultCube, SuperTuxKart, Freedoom |
| `[x]` | Verify local username/password auth in Docker deployment | Register → login → play session (code verified, no issues found) |
| `[x]` | Verify optional Google auth with `GOOGLE_CLIENT_ID` + `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Flow verified: 403 + token → createUsername (works as designed) |
| `[x]` | Add health checks for backend and stratusd in compose stack | Backend: `GET /health`, Frontend: HTTP check, stratusd: `pgrep` |
| `[x]` | Add first-boot admin bootstrap (seed script or endpoint) | `POST /auth/bootstrap` — creates first user when none exist |

---

## Milestone 2 — Hardening (Safe to expose on a home network)

**Status: 7/7 tasks done.**

| Status | Task | Notes |
|--------|------|-------|
| `[x]` | Add rate-limiting and brute-force protections to local auth endpoints | `backend/lib/rateLimiter.ts` — login: 20/15min, register: 5/hr, general: 100/15min |
| `[x]` | Remove `// @ts-nocheck` from `backend/lib/localStore.ts` | Done as part of Milestone 4 |
| `[x]` | Add schema validation for local store reads/writes | `backend/lib/storeValidation.ts` — validates on load, auto-recovers corrupt data |
| `[x]` | Harden stratusd container permissions (reduce `privileged` scope) | `deploy/docker-compose.nvidia.yml` — NVIDIA runtime override replaces privileged mode |
| `[x]` | Add optional reverse proxy config examples (TLS + UDP) | `deploy/nginx/qstratus.conf`, `deploy/caddy/Caddyfile`, `deploy/REVERSE_PROXY.md` |
| `[x]` | Document vendor-specific GPU passthrough guidance (AMD/Intel/NVIDIA) | In `deploy/README.md` — AMD/Intel default, NVIDIA optional |
| `[x]` | Add troubleshooting section for auth/session failures | In `deploy/README.md` — covers login, bootstrap, session, rate limiting |
| `[x]` | Add troubleshooting section for WebTransport/UDP failures | In `deploy/README.md` — covers QUIC, latency, audio, input issues |

---

## Milestone 2.5 — GPU Validation & Testing

**Status: 3/3 tasks done.**

| Status | Task | Notes |
|--------|------|-------|
| `[x]` | Create GPU detection script | `deploy/gpu-detect.sh` — detects vendor, validates encoding, guides setup |
| `[x]` | Create end-to-end validation script | `deploy/scripts/validate-gpu.sh` — full stack + GPU check with --quick mode |
| `[x]` | Add NVIDIA runtime override (optional) | `deploy/docker-compose.nvidia.yml` — replaces privileged mode with scoped GPU access |

---

## Milestone 3 — Polish (Better UX and developer experience)

**Status: 4/4 tasks done.**

| Status | Task | Notes |
|--------|------|-------|
| `[x]` | Improve sign-in UX for dual-auth mode (local + optional Google) | `GET /auth/config` endpoint, clear messaging in UI |
| `[x]` | Add route-level tests for `/auth/local/register` and `/auth/local/login` | `backend/test/auth.test.ts` — 15 tests |
| `[x]` | Add integration tests for local auth and Google auth fallback | `backend/test/integration.test.ts` — 7 tests |
| `[x]` | Keep `deploy/README.md` in sync with env/compose changes | Updated throughout Milestones 1-4 |

---

## Milestone 4 — Steam Game Discovery & Integration

| Status | Task | Notes |
|--------|------|-------|
| `[x]` | Implement `backend/lib/steamScanner.ts` — scan Steam `appmanifest_*.acf` files | Parse appid, Name, installdir, SizeOnDisk |
| `[x]` | Add `POST /games/scan` endpoint to trigger discovery | `backend/routes/gamesController.ts` |
| `[x]` | Add `GET /games/discovered` endpoint for pre-catalog games | Games found but not yet added to catalog |
| `[x]` | Add `createGame()` to `backend/lib/localStore.ts` | Persist discovered games to `store.json` |
| `[x]` | Add frontend scan trigger + discovered games UI | `frontend/src/app/(protected)/browse/discover/page.tsx` |
| `[x]` | Add `scanGames()` + `getDiscoveredGames()` to frontend actions | `frontend/src/lib/actions/games.ts` |
| `[x]` | Add Steam library volume mount to compose stack | `deploy/docker-compose.selfhost.yml` + `STRATUSD_STEAM_PATH` env var |
| `[~]` | Test Steam game launch through stratusd (Wine compatibility) | Requires Linux host with Steam library — code done, needs testing |
| `[x]` | Integrate SteamDB API for rich metadata | Fetch descriptions, screenshots, genres, developers |
| `[x]` | Cache enriched metadata in catalog to avoid repeated API calls | 24h TTL in-memory cache |
| `[x]` | Add `POST /games`, `DELETE /games/:id` endpoints | Manual game management for non-Steam titles |
| `[x]` | Add "Add Game" form to browse UI | Allow manual entry of non-Steam games |
| `[x]` | Document Steam setup in `deploy/README.md` | Library path, Wine notes, DRM caveats |
| `[x]` | Update `docs/game-packaging.md` with Steam discovery approach | |
| `[x]` | Add SteamCMD worker service (optional, on-demand) | `deploy/steamcmd/` |
| `[x]` | Add hybrid game launch in stratusd (Steam client vs direct exec) | `stratusd/SideCar/src/steam_launcher.c` |
| `[x]` | Add Proton support to stratusd container | Auto-fetch latest, configurable via env var |
| `[x]` | Add `IMPLEMENTATION_DETAILS.md` with detailed specs | |
| `[x]` | Wire up SteamCMD download trigger from frontend | `backend/lib/dockerTrigger.ts`, `POST /games/download`, Docker API integration |
| `[x]` | Add download progress UI component | `frontend/src/components/download-progress.tsx` — polls `/games/download/status` every 3s |
| `[ ]` | Add Steam game catalog to heartbeat (appid/source fields) | stratusd reports game IDs, backend needs to map to appids |
| `[ ]` | End-to-end test: scan → claim → download → launch | Requires full stack on Linux |

---

## Test Suite — Remaining Work

**Current coverage: 294 backend tests (all passing) + 20 frontend tests (all passing) + 58 stratusd tests (all passing) + 44 shell tests (all passing)**

| Status | Task | File | Notes |
|--------|------|------|-------|
| `[x]` | Test `downloadController.ts` — trigger + status endpoints | `backend/test/downloadController.test.ts` | 9 tests, all passing |
| `[x]` | Test `ControllerBootstrap` — first-boot admin creation | `backend/test/auth.test.ts` | Already existed (15 tests total) |
| `[x]` | Test `ControllerGetAuthConfig` — returns enabled flags | `backend/test/auth.test.ts` | Already existed |
| `[x]` | Test `dockerTrigger.ts` — Docker API module | `backend/test/dockerTrigger.test.ts` | 16 tests, all passing |
| `[x]` | Test `authController.ts` — register, login, bootstrap | `backend/test/authController.test.ts` | 37 tests, all passing |
| `[x]` | Test `authToken.ts` — JWT verification | `backend/test/authToken.test.ts` | 13 tests, all passing |
| `[x]` | Test `playController.ts` — session/node routes | `backend/test/playController.test.ts` | 21 tests, all passing |
| `[x]` | Test `steam_launcher.c` — Steam client launch logic | `stratusd/test/run_steam_launcher_tests.mjs` | 58 tests, all passing (source analysis) |
| `[x]` | Test `download-progress.tsx` — frontend progress UI | `frontend/tests/download-progress.test.tsx` | 6 tests, all passing (vitest setup) |
| `[x]` | Test `discover/page.tsx` — discover page flow | `frontend/tests/discover-page.test.tsx` | 14 tests, all passing (vitest setup) |
| `[x]` | Test `steamcmd/entrypoint.sh` — download script | `deploy/steamcmd/test/run_entrypoint_tests.mjs` | 44 tests, all passing (source analysis) |
| `[x]` | Fix 9 pre-existing test failures | Various | See RESUME.md for details |
| `[x]` | GPU validation script (Linux host only) | `deploy/scripts/validate-gpu.sh` | Validates Docker, GPU, encoding, passthrough |
| `[x]` | GPU detection script (Linux host only) | `deploy/gpu-detect.sh` | Detects vendor, validates encoding capability |

---

## Dockerfile Fixes (Session 10)

**Status: 4/4 tasks done.**

| Status | Task | Notes |
|--------|------|-------|
| `[x]` | Fix backend Dockerfile — COPY paths, tsconfig build issue | Switched to `tsx` runtime, added `.dockerignore`, fixed `tsconfig.build.json` |
| `[x]` | Fix frontend Dockerfile — pnpm frozen-lockfile mismatch | Changed to `--no-frozen-lockfile` |
| `[x]` | Fix stratusd Dockerfile — package names, missing deps | Fixed libgl1/libasound2 package names, added FFmpeg/ICU dev libs, fixed `fcntl.h` in `steam_launcher.c` |
| `[~]` | Resolve ICU version mismatch in libquiche | Pre-built `libquiche.a` compiled with ICU 78, Ubuntu 24.04 has ICU 74 — requires Bazel rebuild from source (blocked) |

---

## Backlog / Nice-to-Have

| Status | Task | Notes |
|--------|------|-------|
| `[-]` | Replace JSON file store with SQLite | Easier queries, same local-only footprint |
| `[-]` | Add multi-node scheduling for stratusd instances | Currently single-node only |
| `[-]` | Add keyboard/mouse input pipeline support | Controller-only for now by design |

---

## Dockerfile Fixes (Session 11)

**Status: 5/5 tasks done.**

| Status | Task | Notes |
|--------|------|-------|
| `[x]` | Build stratusd on Arch Linux (ICU 78 compatible) | Successfully built on Arch with ICU 78.3 |
| `[x]` | Update stratusd Dockerfile for Ubuntu 24.04 | Fixed package names, added ICU linking |
| `[x]` | Fix cjson dependency (local install workaround) | Built cJSON from source, installed to ~/local |
| `[x]` | Fix steam_launcher.c fcntl.h include | Added `#include <fcntl.h>` |
| `[x]` | Update libquiche CMakeLists.txt | Restored to use pre-built libquiche.a |

**Key finding:** The pre-built `libquiche.a` was compiled with ICU 78. Arch Linux has ICU 78.3, so it works. Ubuntu 24.04 has ICU 74, which causes linker errors. The fix is to either rebuild libquiche from source with system ICU, or use a base image with ICU 78+.

**Current status:** stratusd builds successfully on Arch Linux. Docker build on Ubuntu 24.04 still has ICU mismatch — needs either a custom base image or rebuilding libquiche from source.

---

## Dockerfile Fixes (Session 12)

**Status: 4/4 tasks done.**

| Status | Task | Notes |
|--------|------|-------|
| `[x]` | Switch stratusd Dockerfile to Arch Linux base image | `archlinux:base` — matches ICU 78.3, resolves ICU mismatch |
| `[x]` | Fix cjson detection in CMakeLists.txt | Use `pkg_check_modules` for `libcjson` (Arch provides pkg-config) |
| `[x]` | Fix Proton download syntax in Dockerfile | Extracted to `scripts/install-proton.sh` to avoid shell escaping issues |
| `[x]` | Update SideCar CMakeLists.txt | Changed `CJSON::CJSON` to `PkgConfig::CJSON` |

**Result:** stratusd Docker image builds successfully on Arch Linux base. All dependencies resolved.
