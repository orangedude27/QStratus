# Self-Hosted Stratus (Docker + GPU passthrough)

This setup runs Stratus in containers for fully remote gameplay in the browser:

- `frontend` (Next.js): website + streaming client
- `backend` (Express + WebSocket): auth/session orchestration
- `stratusd` (C/C++): game execution + stream transport

The backend persists users and games in a local JSON file volume.

## What this profile targets

- Single-node self-host deployment
- GPU and input device passthrough to `stratusd`
- Browser clients connecting to your host over HTTP + UDP WebTransport

## Host prerequisites (Linux host)

1. Docker Engine + Compose plugin installed
2. GPU drivers available on host and GPU device exposed at `/dev/dri`
3. `/dev/uinput` available and writable by container (compose uses privileged mode)
4. Firewall allows:
   - TCP `3000` (frontend)
   - TCP `4000` (backend)
   - UDP `4433` (stratusd WebTransport default)

## 1) Prepare env files

From repository root:

```bash
cp deploy/env/backend.env.example deploy/env/backend.env
cp deploy/env/frontend.env.example deploy/env/frontend.env
cp deploy/env/stratusd.env.example deploy/env/stratusd.env
```

Then edit values:

- `deploy/env/backend.env`
  - `AUTH_SECRET`: set a long random value
  - `DATA_FILE`: local persistence file path (`/app/storage/store.json` in compose)
  - `SEED_GAMES_FILE`: startup game seed file (`/app/data/games.json`)
  - `STRATUSD_PASSWORD`: shared secret used by backend + stratusd
  - `GOOGLE_CLIENT_ID`: optional, only for Google sign-in
- `deploy/env/frontend.env`
  - `NEXT_PUBLIC_BACKEND_PATH`: URL users can reach, e.g. `http://YOUR_HOST_IP:4000`
  - `NEXT_PUBLIC_GOOGLE_CLIENT_ID`: same as backend `GOOGLE_CLIENT_ID` if you want Google sign-in
  - `NEXT_PUBLIC_STRATUSD_PORT`: match `STRATUSD_PORT`
- `deploy/env/stratusd.env`
  - `STRATUSD_BACKEND_URL`: usually `ws://localhost:4000`
  - `STRATUSD_BACKEND_PASSWORD`: same as backend
  - `STRATUSD_IP`: public/LAN IP users should connect to
  - `STRATUSD_PORT`: UDP listen port

## 2) Ensure game payloads exist

The compose profile mounts `games/build` into the streaming daemon as `/games`.
At minimum, put one packaged game there using scripts in `games/`.

Also seed game catalog metadata in `backend/data/games.json` so browse/play pages
can list your games.

## 3) Bring up the stack

```bash
docker compose -f deploy/docker-compose.selfhost.yml up -d --build
```

## 4) Verify services

```bash
docker compose -f deploy/docker-compose.selfhost.yml ps
docker compose -f deploy/docker-compose.selfhost.yml logs -f backend
docker compose -f deploy/docker-compose.selfhost.yml logs -f stratusd
```

If `stratusd` heartbeats are reaching backend, frontend dashboard should show an active node.

## 5) Connect from browser

- Open `http://YOUR_HOST_IP:3000`
- Sign in with local username/password or Google (if configured), browse games, and start a stream
- For direct testing, use `/direct-connect` with `STRATUSD_IP` and `STRATUSD_PORT`

## Notes and current limitations

- `stratusd` is currently configured for one concurrent stream session per node.
- For internet exposure, put frontend/backend behind TLS reverse proxy and open UDP for stratusd.
- GPU setup differs by vendor and driver; validate host GPU acceleration before containerizing.
