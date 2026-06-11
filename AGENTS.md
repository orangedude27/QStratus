# AGENTS Guide for QStratus

This file helps future AI coding agents quickly understand and work in this repository.

## Project Snapshot

QStratus is a web-based game streaming platform with three major components:

- Frontend app (Next.js, React, Tailwind)
- Backend coordination server (Express + WebSocket)
- Streaming daemon (stratusd, C/C++, WebTransport)

Recent architecture direction is self-host and local-first:

- Local backend persistence via JSON file store (no AWS required)
- Auth supports local username/password and optional Google OAuth
- Docker-based self-host workflow under `deploy/`

## High-Value Paths

- `frontend/`: web UI, auth UX, browse/play flows
- `backend/`: REST/WebSocket coordination APIs and auth/session logic
- `stratusd/`: native streaming daemon and transport pipeline
- `deploy/`: self-host compose stack and env templates
- `docs/`: architecture and subsystem documentation
- `TODO.md`: current work queue and priorities

## Primary Runtime Flows

1. Sign in
- Local auth: `POST /auth/local/register`, `POST /auth/local/login`
- Google auth: `POST /auth/google` (optional, env-gated)

2. Session start
- Frontend requests session from backend
- Backend selects node and sends start message over WebSocket
- Client connects directly to stratusd over WebTransport

3. Node management
- stratusd sends heartbeats
- Backend tracks active nodes and sessions

## Backend Data Model (Local Store)

File-backed store is implemented in `backend/lib/localStore.ts`.

- Users fields:
  - `UserID`
  - `Username`
  - `Email`
  - `AuthProvider` (`local` or `google`)
  - `PasswordHash` (local users only)

- Games fields:
  - `GameID`
  - `title`
  - `developer`
  - `sDescript`
  - `lDescript`
  - `genres`
  - `s3`

## Key Environment Variables

Backend:

- `AUTH_SECRET`
- `DATA_FILE`
- `SEED_GAMES_FILE`
- `STRATUSD_PASSWORD`
- `GOOGLE_CLIENT_ID` (optional)
- `WHITELISTED_DOMAIN` (optional)
- `WHITELISTED_USERS` (optional)

Frontend:

- `NEXT_PUBLIC_BACKEND_PATH`
- `NEXT_PUBLIC_STRATUSD_PORT`
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (optional)

stratusd:

- `STRATUSD_BACKEND_URL`
- `STRATUSD_BACKEND_PASSWORD`
- `STRATUSD_IP`
- `STRATUSD_PORT`
- `STRATUSD_GAME_DIR`

## Recommended Start Points for Common Tasks

Auth changes:

- Backend handlers: `backend/routes/authController.ts`
- Backend routes: `backend/routes/auth.ts`
- Frontend provider/state: `frontend/src/components/auth/AuthProvider.tsx`
- Sign-in UI: `frontend/src/app/signin/SignInButton.tsx`

Game catalog changes:

- Backend games API: `backend/routes/gamesController.ts`
- Seed data: `backend/data/games.json`
- Frontend game fetchers: `frontend/src/lib/actions/games.ts`

Session orchestration changes:

- Session API: `backend/routes/playController.ts`
- Socket message handling: `backend/socket/messages.ts`
- Node/session tracking: `backend/socket/node.ts`, `backend/socket/sessions.ts`
- Start-session dispatch: `backend/socket/send.ts`

Self-host infra changes:

- Compose stack: `deploy/docker-compose.selfhost.yml`
- Setup docs: `deploy/README.md`
- stratusd container build: `stratusd/Dockerfile`

## Agent Working Rules

- Prefer minimal, targeted patches over broad refactors.
- Preserve existing API contracts unless explicitly asked to break/change them.
- If touching auth/session behavior, verify both frontend and backend sides.
- Keep docs in sync when changing env vars, auth flows, or compose behavior.
- Update `TODO.md` when major work is completed or new blockers are discovered.

## Known Risks / Attention Areas

- Type tooling in backend may require cleanup around local store typing checks.
- stratusd container currently favors compatibility over least privilege.
- WebTransport behavior is sensitive to UDP networking and proxy configuration.
- Local auth currently needs hardening steps (rate limiting, lockouts, etc.).

## Suggested Agent Workflow

1. Read `TODO.md` and this file.
2. Read only the smallest set of files needed for the task.
3. Implement minimal code changes.
4. Run available checks/builds where possible.
5. Update docs and TODO entries as needed.
