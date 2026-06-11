# QStratus Project TODO

Last updated: 2026-06-11

Status legend: `[ ]` not started · `[~]` in progress · `[x]` done · `[-]` deferred

---

## Milestone 1 — MVP Self-Host (Local Docker deployment working end-to-end)

| Status | Task | Notes |
|--------|------|-------|
| `[ ]` | Validate end-to-end self-host flow on a Linux host with GPU passthrough | Requires Linux host with `/dev/dri` |
| `[ ]` | Confirm browser WebTransport connectivity through firewall/NAT | UDP port 4433 must be open |
| `[ ]` | Add initial game catalog seed data in `backend/data/games.json` | At least one real game entry |
| `[ ]` | Verify local username/password auth in Docker deployment | Register → login → play session |
| `[ ]` | Verify optional Google auth with `GOOGLE_CLIENT_ID` + `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | End-to-end Google sign-in |
| `[ ]` | Add health checks for backend and stratusd in compose stack | `deploy/docker-compose.selfhost.yml` |
| `[ ]` | Add first-boot admin bootstrap (seed script or endpoint) | Create first local user without manual store edits |

---

## Milestone 2 — Hardening (Safe to expose on a home network)

| Status | Task | Notes |
|--------|------|-------|
| `[ ]` | Add rate-limiting and brute-force protections to local auth endpoints | `backend/routes/authController.ts` |
| `[ ]` | Remove `// @ts-nocheck` from `backend/lib/localStore.ts` | Run `npm install` first to pull `@types/node` |
| `[ ]` | Add schema validation for local store reads/writes | Prevent corrupt `store.json` from crashing backend |
| `[ ]` | Harden stratusd container permissions (reduce `privileged` scope) | Requires testing each device binding |
| `[ ]` | Add optional reverse proxy config examples (TLS + UDP) | Nginx/Caddy with QUIC/UDP pass-through notes |
| `[ ]` | Document vendor-specific GPU passthrough guidance (AMD/Intel/NVIDIA) | In `deploy/README.md` |
| `[ ]` | Add troubleshooting section for auth/session failures | |
| `[ ]` | Add troubleshooting section for WebTransport/UDP failures | |

---

## Milestone 3 — Polish (Better UX and developer experience)

| Status | Task | Notes |
|--------|------|-------|
| `[ ]` | Improve sign-in UX for dual-auth mode (local + optional Google) | Clear messaging when Google is unconfigured |
| `[ ]` | Add route-level tests for `/auth/local/register` and `/auth/local/login` | |
| `[ ]` | Add integration tests for local auth and Google auth fallback | |
| `[ ]` | Keep `deploy/README.md` in sync with env/compose changes | Update on every infra change |

---

## Backlog / Nice-to-Have

| Status | Task | Notes |
|--------|------|-------|
| `[-]` | Replace JSON file store with SQLite | Easier queries, same local-only footprint |
| `[-]` | Add multi-node scheduling for stratusd instances | Currently single-node only |
| `[-]` | Add keyboard/mouse input pipeline support | Controller-only for now by design |
