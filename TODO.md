# QStratus Project TODO

Last updated: 2026-06-11

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

**Status: 6/7 tasks done. 1 task requires actual Linux testing.**

| Status | Task | Notes |
|--------|------|-------|
| `[x]` | Add rate-limiting and brute-force protections to local auth endpoints | `backend/lib/rateLimiter.ts` — login: 20/15min, register: 5/hr, general: 100/15min |
| `[x]` | Remove `// @ts-nocheck` from `backend/lib/localStore.ts` | Done as part of Milestone 4 |
| `[x]` | Add schema validation for local store reads/writes | `backend/lib/storeValidation.ts` — validates on load, auto-recovers corrupt data |
| `[ ]` | Harden stratusd container permissions (reduce `privileged` scope) | Requires testing each device binding |
| `[x]` | Add optional reverse proxy config examples (TLS + UDP) | `deploy/nginx/qstratus.conf`, `deploy/caddy/Caddyfile`, `deploy/REVERSE_PROXY.md` |
| `[x]` | Document vendor-specific GPU passthrough guidance (AMD/Intel/NVIDIA) | In `deploy/README.md` |
| `[x]` | Add troubleshooting section for auth/session failures | In `deploy/README.md` — covers login, bootstrap, session, rate limiting |
| `[x]` | Add troubleshooting section for WebTransport/UDP failures | In `deploy/README.md` — covers QUIC, latency, audio, input issues |

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
| `[ ]` | Wire up SteamCMD download trigger from frontend | Backend API exists, needs Docker API integration |
| `[ ]` | Add download progress UI component | `frontend/src/components/download-progress.tsx` |
| `[ ]` | Add Steam game catalog to heartbeat (appid/source fields) | stratusd reports game IDs, backend needs to map to appids |
| `[ ]` | End-to-end test: scan → claim → download → launch | Requires full stack on Linux |

---

## Backlog / Nice-to-Have

| Status | Task | Notes |
|--------|------|-------|
| `[-]` | Replace JSON file store with SQLite | Easier queries, same local-only footprint |
| `[-]` | Add multi-node scheduling for stratusd instances | Currently single-node only |
| `[-]` | Add keyboard/mouse input pipeline support | Controller-only for now by design |
