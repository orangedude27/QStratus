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

Game catalog metadata is pre-seeded in `backend/data/games.json` with three
free-to-play games: AssaultCube, SuperTuxKart, and Freedoom. Add more games
by editing this file or using the frontend's game management UI.

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

Check health status:
```bash
curl http://YOUR_HOST_IP:4000/health  # Backend health
docker compose -f deploy/docker-compose.selfhost.yml ps  # Check health column
```

If `stratusd` heartbeats are reaching backend, frontend dashboard should show an active node.

## 5) Create your admin account

On first boot, no users exist. Create your admin account using the bootstrap endpoint:

```bash
curl -X POST http://YOUR_HOST_IP:4000/auth/bootstrap \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "your-strong-password", "email": "admin@example.com"}'
```

This endpoint only works when no users exist. After bootstrap, use the normal `/auth/local/register` and `/auth/local/login` endpoints.

## 6) Connect from browser

- Open `http://YOUR_HOST_IP:3000`
- Sign in with local username/password or Google (if configured), browse games, and start a stream
- For direct testing, use `/direct-connect` with `STRATUSD_IP` and `STRATUSD_PORT`

## Steam Games

QStratus supports both Steam games and non-Steam games with automatic detection:

- **Steam games** are launched through the Steam client (headless mode) which handles DRM authentication and Proton compatibility
- **Non-Steam games** are launched directly via Wine (existing behavior)

### Enabling Steam

1. Copy the SteamCMD environment file:
   ```bash
   cp deploy/env/steamcmd.env.example deploy/env/steamcmd.env
   ```

2. Edit `deploy/env/steamcmd.env`:
   - Set `STEAM_USER` and `STEAM_PASSWORD` for your Steam account (or leave empty for anonymous/free-to-play games)
   - Set `STEAMCMD_GAMES` to a JSON array of AppIDs if you want automatic downloads

3. Start the stack with the Steam profile:
   ```bash
   docker compose --profile steam -f deploy/docker-compose.selfhost.yml up -d --build
   ```

4. Use the "Discover" page in the frontend to scan your Steam library and claim games.

### Game Launch Behavior

- When you launch a **Steam game**, stratusd automatically uses the Steam client to authenticate and launch the game via Proton
- When you launch a **non-Steam game**, stratusd launches it directly via Wine (existing behavior)
- You don't need to configure anything — the system detects the game type automatically

### Anti-Cheat Limitations

Games with anti-cheat systems (Easy Anti-Cheat, BattlEye, Riot Vanguard) will **not work** in a streaming environment. This includes games like Apex Legends, Fortnite, Escape from Tarkov, Rust, etc.

DRM-free Steam games and games with only Steam DRM (Half-Life 2, Portal, Garry's Mod, Left 4 Dead 2, Team Fortress 2, etc.) work without issues.

## Health Checks

All services have health checks configured:
- **Backend**: `GET /health` returns `{"status": "ok"}`
- **Frontend**: HTTP check on port 3000
- **stratusd**: Process check via `pgrep -f stratusd`

Check status with:
```bash
docker compose -f deploy/docker-compose.selfhost.yml ps
```

## GPU Passthrough Guide

stratusd requires GPU access for video encoding. The compose file passes `/dev/dri` to the container. Here's vendor-specific guidance:

### NVIDIA

1. Install NVIDIA drivers on the host:
   ```bash
   sudo apt install nvidia-driver-550  # or latest stable
   ```

2. Install NVIDIA Container Toolkit:
   ```bash
   curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
   curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
   sudo apt update
   sudo apt install nvidia-container-toolkit
   sudo nvidia-ctk runtime configure --runtime=docker
   sudo systemctl restart docker
   ```

3. Verify GPU access:
   ```bash
   docker run --rm --gpus all nvidia/cuda:12.0.0-base-ubuntu22.04 nvidia-smi
   ```

4. The compose file already includes `/dev/dri` — no changes needed.

### AMD

1. Install AMD drivers (usually pre-installed on modern Linux distros):
   ```bash
   sudo apt install mesa-vulkan-drivers amdgpu-core
   ```

2. Verify GPU access:
   ```bash
   ls -la /dev/dri/
   # Should show: card0, renderD128, etc.
   ```

3. Add your user to the `video` and `render` groups:
   ```bash
   sudo usermod -aG video,youruser $USER
   sudo usermod -aG render,youruser $USER
   ```

4. The compose file already includes `/dev/dri` — no changes needed.

### Intel

1. Install Intel GPU drivers:
   ```bash
   sudo apt install intel-media-va-driver-non-free vainfo
   ```

2. Verify GPU access:
   ```bash
   vainfo
   # Should show supported VA APIs
   ```

3. The compose file already includes `/dev/dri` — no changes needed.

### Testing GPU Acceleration

Before running the full stack, test GPU encoding:

```bash
# Test with a simple FFmpeg encode
docker run --rm -v /dev/dri:/dev/dri --device /dev/dri ubuntu:24.04 \
  ffmpeg -f lavfi -i testsrc=duration=5:size=320x240:rate=30 \
  -c:v h264_v4l2m2m -f null -
```

If this fails, check:
- Host GPU drivers are installed and working
- `/dev/dri` has correct permissions
- You're using a compatible GPU (see compatibility notes below)

### GPU Compatibility Notes

| GPU Type | Status | Notes |
|----------|--------|-------|
| NVIDIA GTX 10xx+ | Supported | Requires NVIDIA Container Toolkit |
| NVIDIA RTX 20xx/30xx/40xx | Supported | Full hardware encoding support |
| AMD RX 4xx+ | Supported | Uses VAAPI/MediaCodec |
| AMD APU (Ryzen) | Supported | Integrated graphics work |
| Intel HD 630+ | Supported | Uses QSV/MediaCodec |
| Intel UHD 630+ | Supported | Full hardware encoding |
| Older GPUs (pre-2016) | Limited | May lack hardware encoding |

### Troubleshooting GPU Issues

```bash
# Check if GPU is accessible from host
ls -la /dev/dri/
vainfo  # AMD/Intel
nvidia-smi  # NVIDIA

# Check Docker GPU access
docker run --rm --device /dev/dri nvidia/cuda:12.0.0-base-ubuntu22.04 nvidia-smi

# Check stratusd logs for encoding errors
docker compose -f deploy/docker-compose.selfhost.yml logs -f stratusd
```

## Troubleshooting: Auth & Session Failures

### "Invalid username or password" on login

- Verify the user exists by checking the bootstrap was completed
- Check backend logs: `docker compose logs backend`
- Ensure `AUTH_SECRET` is set in `backend.env`
- Passwords must be at least 8 characters

### "User not found" after Google sign-in

- Google auth returns a 403 with a token if the user doesn't exist in the local store
- You must create the user first via `/auth/create` with the Google token
- Or use local auth (`/auth/local/register`) for self-hosted deployments

### "Bootstrap already completed" error

- The bootstrap endpoint only works when no users exist
- After creating the first user, use normal login/register endpoints
- To reset, delete the store file: `rm backend_data/store.json` (or remove the Docker volume)

### Session fails to start / "No node available"

- Check that stratusd is running: `docker compose ps`
- Verify stratusd heartbeats are reaching backend: `docker compose logs stratusd`
- Check that the game exists in `/games/build` on the host
- Verify the game is listed in the catalog: `curl http://localhost:4000/games`

### "Session timed out" error

- stratusd has a 10-second timeout waiting for node confirmation
- Check network connectivity between backend and stratusd
- Verify `STRATUSD_BACKEND_URL` in `stratusd.env` is correct
- Check stratusd logs for errors: `docker compose logs stratusd`

### Rate limiting errors (429 Too Many Requests)

- Login: 20 attempts per 15 minutes per username
- Registration: 5 attempts per hour per username
- Other endpoints: 100 requests per 15 minutes
- Wait for the retry-after time specified in the response headers

## Troubleshooting: WebTransport & UDP Failures

### Browser shows "Connection failed" or "Timeout"

1. **Check firewall**: UDP port 4433 must be open
   ```bash
   # Check if port is open
   sudo ufw status | grep 4433
   # Or test from another machine
   nc -uvz YOUR_HOST_IP 4433
   ```

2. **Verify stratusd is listening**:
   ```bash
   docker compose -f deploy/docker-compose.selfhost.yml logs stratusd | grep "Listening"
   ```

3. **Check NAT/Router**: If accessing from outside your LAN, you need port forwarding for UDP 4433

4. **Test WebTransport connectivity**:
   - Open browser DevTools (F12)
   - Go to Console tab
   - Look for WebTransport errors
   - Check Network tab for failed connections

### "QUIC connection failed"

- Ensure your browser supports WebTransport (Chrome 107+, Edge 107+, Firefox with flags)
- Check that UDP 4433 is not blocked by ISP or firewall
- Try accessing from localhost first to rule out network issues

### High latency or poor video quality

1. **Check bandwidth**:
   ```bash
   # Test download speed
   speedtest-cli
   # Or use browser devtools Network tab
   ```

2. **Check GPU encoding**:
   ```bash
   docker compose -f deploy/docker-compose.selfhost.yml logs stratusd | grep -i "encode\|error"
   ```

3. **Reduce resolution**: Try lower dimensions in the play page

4. **Check CPU load**: High CPU can cause encoding bottlenecks
   ```bash
   docker stats stratusd
   ```

### Video plays but no audio

- Check browser audio permissions
- Verify PipeWire is running on the host
- Check stratusd logs for audio encoding errors

### Input not working (controller/mouse)

- Verify `/dev/uinput` is accessible: `ls -la /dev/uinput`
- Check browser gamepad API support: `navigator.getGamepads()`
- Ensure controller is connected and recognized: `jstest /dev/input/js0`

### General Debugging Commands

```bash
# View all logs
docker compose -f deploy/docker-compose.selfhost.yml logs

# View specific service logs
docker compose -f deploy/docker-compose.selfhost.yml logs -f backend
docker compose -f deploy/docker-compose.selfhost.yml logs -f stratusd

# Check service status
docker compose -f deploy/docker-compose.selfhost.yml ps

# Restart all services
docker compose -f deploy/docker-compose.selfhost.yml restart

# Rebuild and restart
docker compose -f deploy/docker-compose.selfhost.yml up -d --build

# Check container resource usage
docker stats
```

## Notes and current limitations

- `stratusd` is currently configured for one concurrent stream session per node.
- For internet exposure, put frontend/backend behind TLS reverse proxy and open UDP for stratusd.
- GPU setup differs by vendor and driver; validate host GPU acceleration before containerizing.
