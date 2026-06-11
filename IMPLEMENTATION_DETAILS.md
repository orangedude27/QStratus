# Steam Integration Implementation Details

This document contains the detailed technical specifications for the SteamCMD + hybrid game launch feature. See `TODO.md` for the high-level task list.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  docker-compose.selfhost.yml                                    │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐              │
│  │ Frontend │  │ Backend  │  │ SteamCMD Worker  │              │
│  │ (Next.js)│  │(Express) │  │ (optional)       │              │
│  └──────────┘  └──────────┘  └────────┬─────────┘              │
│                                        │                        │
│                              ┌─────────▼─────────┐              │
│                              │  /data/steam      │              │
│                              │  ├─ steamapps/    │              │
│                              │  │  ├─ common/     │              │
│                              │  │  └─ appmanifest │              │
│                              │  └─ userdata/     │              │
│                              │     └─ <appid>/pfx│              │
│                              └─────────┬─────────┘              │
│                                        │                        │
│  ┌─────────────────────────────────────┤                        │
│  │  ┌──────────┐                       │                        │
│  │  │ stratusd │◄──── Steam games      │                        │
│  │  │ (C/C++)  │◄──── Non-Steam games  │                        │
│  │  └──────────┘                       │                        │
│  └─────────────────────────────────────┘                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: SteamCMD Worker

### Purpose
Download user-owned Steam games on-demand to a shared volume.

### Files
- `deploy/steamcmd/Dockerfile`
- `deploy/steamcmd/entrypoint.sh`

### Dockerfile
- Base image: `linuxserver/steamcmd:latest`
- Installs `jq` for JSON parsing
- Copies entrypoint script

### Entrypoint Script (`entrypoint.sh`)
```bash
#!/bin/bash
set -e

# Required env vars:
#   STEAM_USER      - Steam username (or "anonymous" for free-to-play)
#   STEAM_PASSWORD  - Steam password (omit for anonymous)
#   GAMES           - JSON array of AppIDs, e.g. [440,400000,220]

STEAM_APPS="/steamcmd/steamapps"
GAMES_JSON="${GAMES:-[]}"

# Login
if [ -n "$STEAM_USER" ] && [ -n "$STEAM_PASSWORD" ]; then
    steamcmd +login "$STEAM_USER" "$STEAM_PASSWORD" +quit
else
    steamcmd +login anonymous +quit
fi

# Download each game
echo "$GAMES_JSON" | jq -r '.[]' | while read -r appid; do
    echo "Downloading AppID $appid..."
    steamcmd \
        +login "${STEAM_USER:-anonymous}" "${STEAM_PASSWORD:-}" \
        +app_update "$appid" validate \
        +quit
done

echo "All downloads complete."
```

### SteamCMD Behavior
- Downloads to `/steamcmd/steamapps/common/<installdir>/`
- Appmanifest files written to `/steamcmd/steamapps/appmanifest_<appid>.acf`
- Exits after all downloads complete (stateless, on-demand)

### Compose Integration
```yaml
steamcmd:
  build: ./deploy/steamcmd
  environment:
    - STEAM_USER=${STEAM_USER:-}
    - STEAM_PASSWORD=${STEAM_PASSWORD:-}
    - GAMES=${STEAMCMD_GAMES:-[]}
  volumes:
    - steam_data:/data/steam
  restart: "no"  # Never auto-restart
  profiles:
    - steam  # Only started with `docker compose --profile steam up`
```

### Triggering Downloads
Backend `POST /games/download` endpoint:
1. Validates user has permission
2. Sends download request to steamcmd service via internal Docker network
3. Since steamcmd is stateless, the backend triggers a `docker compose --profile steam up steamcmd` or calls an internal API
4. Returns download status

**Simpler approach:** Backend writes the AppIDs to a shared status file in `steam_data/`, and a separate lightweight watcher container polls for new downloads. Even simpler: the frontend directly triggers the download via a backend API that uses `docker exec` or `docker run` to start the steamcmd container.

**Recommended:** Backend exposes `POST /games/download` which:
1. Validates the request
2. Uses Docker API (or `docker run`) to start the steamcmd container with the requested AppID
3. Streams progress back via WebSocket or returns a status ID

---

## Phase 2: Backend

### steamScanner.ts

Scans the Steam library directory for `appmanifest_*.acf` files.

**Valve ACF format:**
```
"AppData"
{
    "appid"    "440"
    "name"     "Team Fortress 2"
    "installdir"    "Team Fortress 2"
    "SizeOnDisk"    "1234567890"
    "LastUpdated"    "1234567890"
    "StateFlags"    "4"  // 4 = installed
}
```

**Parser logic:**
1. Read all `appmanifest_*.acf` files from `STEAM_LIBRARY_PATH`
2. Parse each file (simple key-value parser, no need for full ACF library)
3. Filter to installed games (`StateFlags == 4`)
4. Return array of `DiscoveredGame` objects

**DiscoveredGame type:**
```typescript
type DiscoveredGame = {
  appid: number
  name: string
  installdir: string
  sizeOnDisk: number
  lastUpdated: number
  stateFlags: number
}
```

### steamdb.ts

Fetches rich metadata from SteamDB API.

**API endpoint:**
```
GET https://store.steampowered.com/api/appdetails?appids=<appid>
```

This is the free Steam Store API (no key required).

**Response parsing:**
```typescript
type SteamDBMetadata = {
  title: string
  description: string
  shortDescription: string
  genres: string[]
  developer: string
  publisher: string
  releaseDate: string
  screenshots: string[]
  headerImage: string
  isFreeToPlay: boolean
  hasDrm: boolean  // derived from response
}
```

**Caching:**
- In-memory cache with 24-hour TTL
- Key: `steamdb_<appid>`
- Fallback: use ACF data if API fails

### localStore.ts Extensions

**New types:**
```typescript
export type GameRecord = {
  GameID: string
  appid?: number
  source: 'steam' | 'non-steam' | 'manual' | 'seed'
  installdir?: string
  developer: string
  genres: string[]
  lDescript: string
  s3: string[]
  sDescript: string
  title: string
}
```

**New functions:**
```typescript
export async function createGame(input: Partial<GameRecord>): Promise<GameRecord>
export async function addGameToCatalog(discovered: DiscoveredGame, metadata?: SteamDBMetadata): Promise<GameRecord>
export async function getAllGamesWithSource(): Promise<GameRecord[]>
export async function deleteGame(gameId: string): Promise<boolean>
export async function getGameByAppId(appid: number): Promise<GameRecord | undefined>
```

**`createGame()` logic:**
1. Generate UUID for `GameID`
2. Set `source` field
3. Add to `storeData.games`
4. Persist to `store.json`

**`addGameToCatalog()` logic:**
1. Check if game with same `appid` already exists
2. If not, create new `GameRecord` with enriched metadata
3. Set `source: 'steam'`
4. Persist

### gamesController.ts Extensions

**New endpoints:**

```
POST /games/scan
  → Scans Steam library, returns discovered games
  → Response: { discovered: DiscoveredGame[], existing: GameRecord[] }

GET /games/discovered
  → Returns games found on disk but not in catalog
  → Response: DiscoveredGame[]

POST /games/discovered/:appid/claim
  → Adds discovered game to catalog
  → Enriches with SteamDB metadata
  → Response: GameRecord

POST /games
  → Manual game creation (non-Steam)
  → Body: { title, developer, executable, source: 'manual', ... }
  → Response: GameRecord

DELETE /games/:id
  → Removes game from catalog
  → Does NOT delete game files
  → Response: { success: boolean }

GET /games/steam/status
  → Returns SteamCMD download status
  → Response: { downloading: boolean, appid: number, progress: number }
```

### games.ts Route Updates

```typescript
router.post('/scan', ControllerScanSteam)
router.get('/discovered', ControllerGetDiscovered)
router.post('/discovered/:appid/claim', ControllerClaimGame)
router.post('/', ControllerCreateGame)
router.delete('/:id', ControllerDeleteGame)
```

---

## Phase 3: stratusd

### Dockerfile Changes

**Install Steam client (headless):**
```dockerfile
# Steam client for game launch
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx:amd64 \
    libgl1-mesa-glx:i386 \
    libgl1:amd64 \
    libgl1:i386 \
    && rm -rf /var/lib/apt/lists/*

# Download and install Steam client (headless)
RUN mkdir -p /root/.steam/steam \
    && curl -sSL https://steamcdn-a.akamaihd.net/client/installer/steam.deb -o /tmp/steam.deb \
    && dpkg -i /tmp/steam.deb --force-depends 2>/dev/null || true \
    && apt-get install -f -y \
    && rm /tmp/steam.deb
```

**Install Proton:**
```dockerfile
# Install Proton (latest stable, configurable via PROTON_VERSION env var)
ARG PROTON_VERSION=latest
RUN mkdir -p /opt/steamcmd/Proton \
    && if [ "$PROTON_VERSION" = "latest" ]; then \
        PROTON_VERSION=$(curl -s https://api.github.com/repos/ValveSoftware/Proton/releases/latest | grep tag_name | cut -d'"' -f4 | sed 's/^proton-//'); \
    fi \
    && curl -L "https://github.com/ValveSoftware/Proton/releases/download/v${PROTON_VERSION}/proton-${PROTON_VERSION}.tar.gz" \
    | tar xz -C /opt/steamcmd/Proton --strip-components=1
```

**Keep existing Wine:**
```dockerfile
# Wine for non-Steam games
RUN apt-get install -y wine wine64 wine32 winetricks \
    && rm -rf /var/lib/apt/lists/*
```

### steam_launcher.c

New module for Steam client game launch.

**Header (`steam_launcher.h`):**
```c
#ifndef STEAM_LAUNCHER_H
#define STEAM_LAUNCHER_H

int steam_launch_game(int appid, const char *steam_path, const char *steam_prefix);
int steam_is_running(void);
void steam_stop(void);

#endif
```

**Implementation (`steam_launcher.c`):**

```c
#include "steam_launcher.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/wait.h>

static int steam_pid = 0;

int steam_is_running(void) {
    if (steam_pid == 0) return 0;
    return kill(steam_pid, 0) == 0;
}

int steam_launch_game(int appid, const char *steam_path, const char *steam_prefix) {
    char cmd[512];
    char appid_str[16];
    int status;

    snprintf(appid_str, sizeof(appid_str), "%d", appid);

    // Set up environment for Proton
    setenv("STEAM_RUNTIME", "0", 1);
    setenv("PROTON_PREFIX", steam_prefix, 1);
    setenv("PROTON_LOG", "1", 1);

    // Launch game via Steam client
    // steam -no-browser -silent -applaunch <appid>
    snprintf(cmd, sizeof(cmd),
        "steam -no-browser -silent -applaunch %s", appid_str);

    int pid = fork();
    if (pid < 0) return -1;
    if (pid == 0) {
        // Child: exec steam
        execlp("steam", "steam", "-no-browser", "-silent",
               "-applaunch", appid_str, NULL);
        perror("execlp steam");
        _exit(1);
    }

    // Parent: wait for game to exit
    steam_pid = pid;
    waitpid(pid, &status, 0);
    steam_pid = 0;

    return WIFEXITED(status) ? WEXITSTATUS(status) : -1;
}

void steam_stop(void) {
    if (steam_pid > 0) {
        kill(steam_pid, SIGTERM);
        waitpid(steam_pid, NULL, 0);
        steam_pid = 0;
    }
}
```

### session.c Changes

**Modified `session_launch_game()`:**

```c
static int session_launch_game(char *game_id, int width, int height) {
    // ... existing setup code ...

    // Check if this is a Steam game
    // Look up game_id in the catalog (populated from heartbeat data)
    game_entry *entry = find_game_by_id(game_id);

    if (entry && entry->source == GAME_SOURCE_STEAM && entry->appid > 0) {
        // Steam game: launch via Steam client
        const char *steam_path = getenv("STRATUSD_STEAM_PATH");
        const char *steam_prefix = getenv("STRATUSD_STEAM_PREFIX");
        if (!steam_path) steam_path = "/data/steam/steamapps/common";
        if (!steam_prefix) steam_prefix = "/data/steam/userdata";

        int exit_code = steam_launch_game(entry->appid, steam_path, steam_prefix);
        if (exit_code != 0) {
            fprintf(stderr, "[Sidecar] Steam game exited with code %d\n", exit_code);
            // Return -1 to trigger session_error
            return -1;
        }
        // Steam handles the PID tracking, return a placeholder
        return 1;  // Non-zero placeholder
    }

    // Non-Steam game: existing direct exec behavior
    // ... (unchanged)
}
```

### SideCar.c Changes

**Increase MAX_GAMES:**
```c
#define MAX_GAMES 64
```

**Extended heartbeat scanning:**
```c
// Scan non-Steam games (existing)
// Scan Steam games from STRATUSD_STEAM_PATH
// Report both with source info
```

**Game catalog structure:**
```c
typedef enum {
    GAME_SOURCE_NONE = 0,
    GAME_SOURCE_SEED = 1,
    GAME_SOURCE_STEAM = 2,
    GAME_SOURCE_NON_STEAM = 3,
    GAME_SOURCE_MANUAL = 4
} game_source_t;

typedef struct {
    char id[UUID_LEN];
    char title[128];
    game_source_t source;
    int appid;
    char installdir[256];
} game_entry_t;
```

### Environment Variables

```
STRATUSD_STEAM_PATH=/data/steam/steamapps/common
STRATUSD_STEAM_PREFIX=/data/steam/userdata
STRATUSD_STEAM_CLIENT=1  # Enable Steam client mode (default: 1)
PROTON_VERSION=latest   # Proton version (default: latest, or specific like "9-11")
```

---

## Phase 4: Frontend

### Types

```typescript
export type GameType = {
  GameID: string
  appid?: number
  source: 'steam' | 'non-steam' | 'manual' | 'seed'
  installdir?: string
  developer: string
  genres: string[]
  lDescript: string
  s3: string[]
  sDescript: string
  title: string
}

export type DiscoveredGameType = {
  appid: number
  name: string
  installdir: string
  sizeOnDisk: number
  lastUpdated: number
  stateFlags: number
  metadata?: SteamDBMetadata
}

export type SteamDBMetadata = {
  title: string
  description: string
  shortDescription: string
  genres: string[]
  developer: string
  publisher: string
  releaseDate: string
  screenshots: string[]
  headerImage: string
  isFreeToPlay: boolean
}
```

### Actions

```typescript
// games.ts
export async function scanSteamGames(): Promise<{
  discovered: DiscoveredGameType[]
  existing: GameType[]
}>

export async function getDiscoveredGames(): Promise<DiscoveredGameType[]>

export async function claimGame(appid: string): Promise<GameType>

export async function downloadGame(appid: string): Promise<{
  status: 'queued' | 'downloading' | 'complete' | 'error'
  progress: number
}>

export async function createManualGame(gameData: Partial<GameType>): Promise<GameType>

export async function deleteGame(gameId: string): Promise<boolean>
```

### Pages

**`browse/discover/page.tsx`:**
- Tab-based navigation (Browse / Discover)
- "Scan Library" button triggers `POST /games/scan`
- Grid of discovered games (not yet in catalog)
- Each card shows: name, AppID, size, "Claim" button
- Clicking "Claim" calls `POST /games/discovered/:appid/claim`
- After claiming, game appears in "Browse" tab

**`browse/manage/page.tsx`:**
- "My Games" view of all cataloged games
- Source badge on each card (Steam/Manual/Seed)
- "Download" button for Steam games (triggers SteamCMD)
- "Add Game" button opens modal/form for manual entry
- "Remove" button removes from catalog

### Components

**`game-source-badge.tsx`:**
```tsx
export function GameSourceBadge({ source }: { source: GameType['source'] }) {
  const colors = {
    steam: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    'non-steam': 'bg-green-500/20 text-green-400 border-green-500/30',
    manual: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    seed: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  }
  // ... render badge with label
}
```

**`download-progress.tsx`:**
```tsx
export function DownloadProgress({ progress, appid }: {
  progress: number
  appid: number
}) {
  return (
    <div className="w-full">
      <div className="text-sm text-muted-foreground">
        Downloading AppID {appid}: {progress}%
      </div>
      <Progress value={progress} className="h-2" />
    </div>
  )
}
```

---

## Phase 5: Integration

### docker-compose.selfhost.yml

```yaml
services:
  # ... existing services ...

  steamcmd:
    build:
      context: ../deploy/steamcmd
      dockerfile: Dockerfile
    environment:
      - STEAM_USER=${STEAM_USER:-}
      - STEAM_PASSWORD=${STEAM_PASSWORD:-}
      - GAMES=${STEAMCMD_GAMES:-[]}
    volumes:
      - steam_data:/data/steam
    restart: "no"
    profiles:
      - steam

  stratusd:
    # ... existing config ...
    volumes:
      - ../games/build:/games:ro
      - steam_data:/data/steam    # NEW
      - /run/udev:/run/udev:ro
      - /tmp/.X11-unix:/tmp/.X11-unix

volumes:
  backend_data:
  steam_data:                    # NEW
```

### Environment Files

**`deploy/env/stratusd.env.example`:**
```
# Steam paths
STRATUSD_STEAM_PATH=/data/steam/steamapps/common
STRATUSD_STEAM_PREFIX=/data/steam/userdata
STRATUSD_STEAM_CLIENT=1

# Proton version (default: latest)
# PROTON_VERSION=9-11
```

**`deploy/env/backend.env.example`:**
```
# Steam library path for scanner
STEAM_LIBRARY_PATH=/data/steam/steamapps
```

**New: `deploy/env/steamcmd.env.example`:**
```
STEAM_USER=
STEAM_PASSWORD=
STEAMCMD_GAMES=[]
```

### README Updates

**`deploy/README.md`:**
- Add "Steam Games" section
- Explain how to enable SteamCMD worker
- Document Steam credentials setup
- Explain hybrid launch behavior
- Note anti-cheat limitations

**`docs/game-packaging.md`:**
- Add "Steam Game Discovery" section
- Explain SteamCMD download process
- Explain Steam client vs direct launch
- Document Proton integration

---

## Anti-Cheat Limitations

The following anti-cheat systems will **not work** in a headless/streaming environment:

| Anti-Cheat | Games Affected |
|------------|---------------|
| Easy Anti-Cheat (EAC) | Apex Legends, Fortnite, GTA V, etc. |
| BattlEye | Escape from Tarkov, Rust, DayZ, etc. |
| Vanguard (Riot) | Valorant |
| FaceIT | FaceIT-managed games |

These detect virtualized/headless environments and refuse to launch.

---

## Error Handling

### Steam Client Failures
- Steam client not running → auto-start on first Steam game launch
- Steam authentication fails → return `session_error` with description
- Game not owned → Steam returns error code → show "Game not owned" message

### SteamCMD Failures
- Invalid credentials → return error to frontend
- Game not found → return error to frontend
- Download interrupted → allow retry from frontend

### Proton Failures
- Proton not installed → fall back to vanilla Wine (if available)
- Game incompatible → show "Game may not be compatible" warning

---

## Testing Checklist

- [ ] SteamCMD downloads a game successfully (anonymous login)
- [ ] SteamCMD downloads a game with credentials
- [ ] Backend scans Steam library and discovers games
- [ ] Backend enriches metadata via SteamDB API
- [ ] Discovered games appear in frontend "Discover" tab
- [ ] Claiming a game adds it to catalog
- [ ] Non-Steam game launches via direct exec (existing behavior)
- [ ] Steam game launches via Steam client
- [ ] Steam client starts automatically on first Steam game
- [ ] Game exit is detected and session ends cleanly
- [ ] Multiple Steam games can be claimed and launched
- [ ] Manual game creation works
- [ ] Game deletion removes from catalog (not files)
- [ ] Docker compose starts with `--profile steam`
- [ ] Docker compose starts without Steam (optional)
