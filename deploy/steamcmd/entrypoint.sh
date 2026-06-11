#!/bin/bash
set -e

STEAM_APPS="/steamcmd/steamapps"
GAMES_JSON="${GAMES:-[]}"

echo "=== SteamCMD Worker ==="
echo "User: ${STEAM_USER:-anonymous}"
echo "Games to download: $(echo "$GAMES_JSON" | jq 'length')"

# Login
if [ -n "$STEAM_USER" ] && [ -n "$STEAM_PASSWORD" ]; then
    echo "Logging in as $STEAM_USER..."
    steamcmd \
        +login "$STEAM_USER" "$STEAM_PASSWORD" \
        +quit || {
        echo "ERROR: Steam login failed"
        exit 1
    }
else
    echo "Logging in as anonymous..."
    steamcmd +login anonymous +quit
fi

# Ensure steamapps directory exists
mkdir -p "$STEAM_APPS"

# Download each game
GAME_COUNT=$(echo "$GAMES_JSON" | jq 'length')
if [ "$GAME_COUNT" -eq 0 ]; then
    echo "No games specified. Exiting."
    exit 0
fi

for i in $(seq 0 $((GAME_COUNT - 1))); do
    APPID=$(echo "$GAMES_JSON" | jq -r ".[$i]")
    echo ""
    echo "=== Downloading AppID $APPID ==="
    
    steamcmd \
        +login "${STEAM_USER:-anonymous}" "${STEAM_PASSWORD:-}" \
        +app_update "$APPID" validate \
        +quit
    
    if [ $? -ne 0 ]; then
        echo "WARNING: Failed to download AppID $APPID, continuing..."
    fi
done

echo ""
echo "=== All downloads complete ==="
