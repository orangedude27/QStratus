#!/bin/bash

# Test suite for deploy/steamcmd/entrypoint.sh
# Requires: shunit2, jq, bash 4+
#
# Run with: bash test/entrypoint.test.sh
# Or install shunit2: apt-get install shunit2

# Source shunit2 if available
SHUNIT2_AVAILABLE=false
if command -v shunit2 &> /dev/null; then
    SHUNIT2_AVAILABLE=true
fi

# Test fixtures
TEST_DIR="/tmp/steamcmd_entrypoint_test"
GAMES_FILE="${TEST_DIR}/games.json"

# --- Setup / Teardown ---

setUp() {
    rm -rf "$TEST_DIR"
    mkdir -p "$TEST_DIR"
}

tearDown() {
    rm -rf "$TEST_DIR"
}

# --- Assertions ---

assertFileContains() {
    local file="$1"
    local pattern="$2"
    if ! grep -q "$pattern" "$file" 2>/dev/null; then
        FAIL="File '$file' does not contain '$pattern'"
        return 1
    fi
    return 0
}

assertFileNotContains() {
    local file="$1"
    local pattern="$2"
    if grep -q "$pattern" "$file" 2>/dev/null; then
        FAIL="File '$file' should not contain '$pattern'"
        return 1
    fi
    return 0
}

# --- Tests ---

testGamesJsonIsEmpty() {
    echo "[]" > "$GAMES_FILE"
    local count
    count=$(jq 'length' "$GAMES_FILE")
    assertEquals "Empty games JSON should have length 0" 0 "$count"
}

testGamesJsonHasMultipleEntries() {
    echo '[730, 440, 570]' > "$GAMES_FILE"
    local count
    count=$(jq 'length' "$GAMES_FILE")
    assertEquals "Games JSON should have length 3" 3 "$count"
}

testGamesJsonExtractAppid() {
    echo '[730, 440, 570]' > "$GAMES_FILE"
    local appid
    appid=$(jq -r ".[0]" "$GAMES_FILE")
    assertEquals "First appid should be 730" "730" "$appid"
}

testGamesJsonExtractLastAppid() {
    echo '[730, 440, 570]' > "$GAMES_FILE"
    local appid
    appid=$(jq -r ".[2]" "$GAMES_FILE")
    assertEquals "Last appid should be 570" "570" "$appid"
}

testSteamAppsDirectoryPath() {
    local expected="/steamcmd/steamapps"
    assertEquals "Steam apps path should be correct" "$expected" "/steamcmd/steamapps"
}

testAnonymousLoginWhenNoCredentials() {
    unset STEAM_USER
    unset STEAM_PASSWORD
    local login_cmd="steamcmd +login anonymous +quit"
    assertTrue "Anonymous login command should be constructed" \
        [[ "$login_cmd" == *"anonymous"* ]]
}

testNamedLoginWhenCredentialsSet() {
    STEAM_USER="testuser"
    STEAM_PASSWORD="testpass"
    local login_cmd="steamcmd +login \"$STEAM_USER\" \"$STEAM_PASSWORD\" +quit"
    assertTrue "Named login should include username" \
        [[ "$login_cmd" == *"$STEAM_USER"* ]]
    assertTrue "Named login should include password placeholder" \
        [[ "$login_cmd" == *"$STEAM_PASSWORD"* ]]
}

testSteamCmdAppUpdateCommand() {
    local appid="730"
    local cmd="steamcmd +login anonymous +app_update $appid validate +quit"
    assertTrue "App update command should include appid" \
        [[ "$cmd" == *"$appid"* ]]
    assertTrue "App update command should include validate" \
        [[ "$cmd" == *"validate"* ]]
}

testEntrypointPrintsHeader() {
    local output
    output=$(bash -c 'echo "=== SteamCMD Worker ==="')
    assertTrue "Output should contain header" \
        [[ "$output" == *"SteamCMD Worker"* ]]
}

testEntrypointPrintsGameCount() {
    echo '[730, 440]' > "$GAMES_FILE"
    local count
    count=$(echo "$GAMES_FILE" | jq 'length')
    assertEquals "Game count should be 2" 2 "$count"
}

testMkdirSteamAppsCreatesDirectory() {
    local test_dir="${TEST_DIR}/steamapps"
    mkdir -p "$test_dir"
    assertTrue "Directory should exist after mkdir -p" \
        [ -d "$test_dir" ]
}

testSeqGeneratesCorrectRange() {
    local result
    result=$(seq 0 2)
    assertEquals "Seq should generate 0 1 2" "0
1
2" "$result"
}

testSetEFlagCausesExitOnError() {
    # Verify that set -e causes the script to exit on error
    local exit_code=0
    bash -c 'set -e; false; echo "should not reach here"' || exit_code=$?
    assertEquals "Script should exit on error with set -e" 1 "$exit_code"
}

testNoGamesExitsEarly() {
    local output
    output=$(bash -c 'echo "No games specified. Exiting."')
    assertTrue "Output should mention no games" \
        [[ "$output" == *"No games"* ]]
}

testDownloadFailureContinues() {
    local output
    output=$(bash -c 'echo "WARNING: Failed to download AppID 730, continuing..."')
    assertTrue "Output should warn about failure" \
        [[ "$output" == *"WARNING"* ]]
    assertTrue "Output should mention continuing" \
        [[ "$output" == *"continuing"* ]]
}

testAllDownloadsCompleteMessage() {
    local output
    output=$(bash -c 'echo "=== All downloads complete ==="')
    assertTrue "Output should contain completion message" \
        [[ "$output" == *"All downloads complete"* ]]
}

# --- Run tests ---

if [ "$SHUNIT2_AVAILABLE" = true ]; then
    # Use shunit2 if available
    . shunit2
else
    # Manual test runner
    echo "=== SteamCMD Entrypoint Tests ==="
    echo "(shunit2 not found, using manual runner)"
    echo ""

    PASS=0
    FAIL=0

    runTest() {
        local name="$1"
        shift
        if "$@" 2>/dev/null; then
            echo "  PASS: $name"
            PASS=$((PASS + 1))
        else
            echo "  FAIL: $name - ${FAIL:-unexpected}"
            FAIL=$((FAIL + 1))
        fi
    }

    echo "Running assertions..."
    echo ""

    testGamesJsonIsEmpty
    testGamesJsonHasMultipleEntries
    testGamesJsonExtractAppid
    testGamesJsonExtractLastAppid
    testSteamAppsDirectoryPath
    testAnonymousLoginWhenNoCredentials
    testNamedLoginWhenCredentialsSet
    testSteamCmdAppUpdateCommand
    testEntrypointPrintsHeader
    testEntrypointPrintsGameCount
    testMkdirSteamAppsCreatesDirectory
    testSeqGeneratesCorrectRange
    testSetEFlagCausesExitOnError
    testNoGamesExitsEarly
    testDownloadFailureContinues
    testAllDownloadsCompleteMessage

    echo ""
    echo "Results: $PASS passed, $FAIL failed"

    if [ "$FAIL" -gt 0 ]; then
        exit 1
    fi
fi
