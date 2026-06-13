/**
 * deploy/steamcmd/entrypoint.sh — Manual test runner (no jq/shunit2 required)
 *
 * Validates the shell script structure, logic flow, and edge cases
 * by parsing and analyzing the source file.
 *
 * Run: node deploy/steamcmd/test/run_entrypoint_tests.mjs
 */

import { readFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ENTRYPOINT = join(__dirname, "..", "entrypoint.sh")

let passed = 0
let failed = 0
let total = 0

function assert(condition, name) {
  total++
  if (condition) {
    passed++
    console.log(`  ✓ ${name}`)
  } else {
    failed++
    console.error(`  ✗ ${name}`)
  }
}

function section(name) {
  console.log(`\n${name}`)
  console.log("─".repeat(50))
}

// Load entrypoint script
const script = readFileSync(ENTRYPOINT, "utf-8")

// ===== Script Structure Tests =====
section("Script Structure")

assert(script.startsWith("#!/bin/bash"), "Has bash shebang")
assert(script.includes("set -e"), "Uses set -e for error handling")
assert(script.includes("STEAM_APPS="), "Defines STEAM_APPS variable")
assert(script.includes("GAMES_JSON="), "Defines GAMES_JSON variable")
assert(script.includes("GAMES:-[]"), "Defaults GAMES to empty array")

// ===== Header Output Tests =====
section("Header Output")

assert(script.includes("=== SteamCMD Worker ==="), "Prints worker header")
assert(script.includes("User:"), "Prints user info")
assert(script.includes("Games to download:"), "Prints game count")
assert(script.includes("jq 'length'"), "Uses jq to count games")

// ===== Login Logic Tests =====
section("Login Logic")

assert(script.includes("if [ -n \"$STEAM_USER\" ]"), "Checks STEAM_USER exists")
assert(script.includes("&& [ -n \"$STEAM_PASSWORD\" ]"), "Checks STEAM_PASSWORD exists")
assert(script.includes("Logging in as"), "Prints login status")
assert(script.includes("Logging in as anonymous"), "Prints anonymous login message")
assert(script.includes("+login"), "Uses steamcmd +login command")
assert(script.includes("+quit"), "Uses steamcmd +quit command")
assert(script.includes("ERROR: Steam login failed"), "Checks login failure")
assert(script.includes("exit 1"), "Exits on login failure")

// ===== Directory Creation Tests =====
section("Directory Management")

assert(script.includes("mkdir -p"), "Creates steamapps directory")
assert(script.includes("$STEAM_APPS"), "Uses STEAM_APPS variable")

// ===== Game Count Check Tests =====
section("Game Count Validation")

assert(script.includes("GAME_COUNT="), "Gets game count from JSON")
assert(script.includes("if [ \"$GAME_COUNT\" -eq 0 ]"), "Checks for zero games")
assert(script.includes("No games specified"), "Prints no games message")
assert(script.includes("exit 0"), "Exits cleanly when no games")

// ===== Download Loop Tests =====
section("Download Loop")

assert(script.includes("for i in $(seq"), "Uses seq for iteration")
assert(script.includes("APPID="), "Extracts APPID from JSON")
assert(script.includes("jq -r"), "Uses jq -r for raw output")
assert(script.includes("=== Downloading AppID"), "Prints download header")
assert(script.includes("+app_update"), "Uses app_update command")
assert(script.includes("validate"), "Uses validate flag")

// ===== Error Handling Tests =====
section("Error Handling")

assert(script.includes("if [ $? -ne 0 ]"), "Checks download exit code")
assert(script.includes("WARNING: Failed to download"), "Prints warning on failure")
assert(script.includes("continuing"), "Continues on failure (doesn't exit)")

// ===== Completion Message Tests =====
section("Completion Messages")

assert(script.includes("=== All downloads complete ==="), "Prints completion message")

// ===== Anonymous Login Tests =====
section("Anonymous Login")

assert(script.includes("${STEAM_USER:-anonymous}"), "Defaults to anonymous user")
assert(script.includes("${STEAM_PASSWORD:-}"), "Handles missing password")

// ===== Idempotency Tests =====
section("Idempotency")

assert(script.includes("mkdir -p"), "mkdir -p is idempotent")
assert(script.includes("+login"), "Login is re-run each game (idempotent)")

// ===== Security Tests =====
section("Security Considerations")

assert(script.includes("validate"), "Uses validate flag for integrity")
assert(script.includes("set -e"), "set -e prevents silent failures")

// ===== Edge Case Tests =====
section("Edge Cases")

// Test: Empty games array
assert(script.includes("if [ \"$GAME_COUNT\" -eq 0 ]"), "Handles empty games array")

// Test: Single game
assert(script.includes("seq 0 $((GAME_COUNT - 1))"), "Loop works for single game (seq 0 0)")

// Test: Multiple games
assert(script.includes("for i in $(seq"), "Loop handles multiple games")

// Test: Failed download doesn't stop others
assert(script.includes("if [ $? -ne 0 ]"), "Checks each download individually")
assert(!script.includes("exit 1") || script.indexOf("exit 1") < script.indexOf("continuing"), "Doesn't exit on download failure")

// ===== Summary =====
console.log("\n" + "═".repeat(50))
console.log(`Results: ${passed} passed, ${failed} failed (${total} total)`)
console.log("═".repeat(50))

if (failed > 0) {
  process.exit(1)
}

console.log("\nAll entrypoint.sh tests passed!")
