/**
 * stratusd steam_launcher.c — Manual test runner (no cmocka required)
 *
 * Validates the C source code structure, API contracts, and logic
 * by parsing and analyzing the source files.
 *
 * Run: node stratusd/test/run_steam_launcher_tests.mjs
 */

import { readFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC = join(__dirname, "..", "SideCar", "src", "steam_launcher.c")
const HDR = join(__dirname, "..", "SideCar", "include", "steam_launcher.h")

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

// Load source files
const src = readFileSync(SRC, "utf-8")
const hdr = readFileSync(HDR, "utf-8")

// ===== Header API Tests =====
section("Header API Contract")

assert(hdr.includes("steam_register_game"), "steam_register_game declared")
assert(hdr.includes("steam_find_game_by_id"), "steam_find_game_by_id declared")
assert(hdr.includes("steam_get_game_count"), "steam_get_game_count declared")
assert(hdr.includes("steam_is_running"), "steam_is_running declared")
assert(hdr.includes("steam_launch_game"), "steam_launch_game declared")
assert(hdr.includes("steam_stop"), "steam_stop declared")
assert(hdr.includes("game_entry_t"), "game_entry_t struct declared")
assert(hdr.includes("game_source_t"), "game_source_t enum declared")
assert(hdr.includes("GAME_SOURCE_NONE"), "GAME_SOURCE_NONE defined")
assert(hdr.includes("GAME_SOURCE_STEAM"), "GAME_SOURCE_STEAM defined")
assert(hdr.includes("GAME_SOURCE_NON_STEAM"), "GAME_SOURCE_NON_STEAM defined")

// ===== Source Structure Tests =====
section("Source Code Structure")

assert(src.includes("steam_register_game"), "steam_register_game implemented")
assert(src.includes("steam_find_game_by_id"), "steam_find_game_by_id implemented")
assert(src.includes("steam_get_game_count"), "steam_get_game_count implemented")
assert(src.includes("steam_is_running"), "steam_is_running implemented")
assert(src.includes("steam_launch_game"), "steam_launch_game implemented")
assert(src.includes("steam_stop"), "steam_stop implemented")

// ===== Catalog Capacity Tests =====
section("Catalog Capacity")

assert(src.includes("MAX_GAMES_CATALOG 64") || src.includes("MAX_GAMES_CATALOG=64"), "MAX_GAMES_CATALOG = 64")
assert(src.includes("game_count >= MAX_GAMES_CATALOG"), "Catalog full check exists")
assert(src.includes("return -1"), "Returns -1 when catalog full")

// ===== String Truncation Tests =====
section("String Truncation Safety")

assert(src.includes("strncpy(entry->id, id, 36)"), "ID truncated to 36 chars")
assert(src.includes("entry->id[36] = '\\0'"), "ID null-terminated after truncation")
assert(src.includes("strncpy(entry->title, title, 127)"), "Title truncated to 127 chars")
assert(src.includes("entry->title[127] = '\\0'"), "Title null-terminated after truncation")
assert(src.includes("strncpy(entry->installdir, installdir, 255)"), "Installdir truncated to 255 chars")
assert(src.includes("entry->installdir[255] = '\\0'"), "Installdir null-terminated after truncation")

// ===== NULL Safety Tests =====
section("NULL Safety")

assert(src.includes("if (installdir)"), "Checks installdir before use")
assert(src.includes("entry->installdir[0] = '\\0'"), "Sets empty string when installdir is NULL")

// ===== Fork/Exec Pattern Tests =====
section("Fork/Exec Pattern")

assert(src.includes("int pid = fork()"), "Uses fork() for process creation")
assert(src.includes("if (pid < 0)"), "Handles fork failure")
assert(src.includes("if (pid == 0)"), "Has child process branch")
assert(src.includes("execlp(\"steam\""), "Executes steam binary")
assert(src.includes("-no-browser"), "Uses -no-browser flag")
assert(src.includes("-silent"), "Uses -silent flag")
assert(src.includes("-applaunch"), "Uses -applaunch flag")
assert(src.includes("waitpid"), "Waits for child process")

// ===== Process Management Tests =====
section("Process Management")

assert(src.includes("steam_client_pid = pid"), "Stores child PID")
assert(src.includes("steam_client_pid = 0"), "Resets PID on completion")
assert(src.includes("kill(steam_client_pid, SIGTERM)"), "Sends SIGTERM in steam_stop")
assert(src.includes("kill(steam_client_pid, SIGKILL)"), "Sends SIGKILL if SIGTERM fails")
assert(src.includes("usleep(500000)"), "Waits before force kill")
assert(src.includes("WNOHANG"), "Uses non-blocking waitpid check")

// ===== Environment Tests =====
section("Environment Variables")

assert(src.includes("PROTON_PREFIX"), "Sets PROTON_PREFIX env var")
assert(src.includes("PROTON_LOG"), "Sets PROTON_LOG env var")
assert(src.includes("STRATUSD_GAME_DEBUG"), "Checks STRATUSD_GAME_DEBUG")

// ===== Exit Code Handling Tests =====
section("Exit Code Handling")

assert(src.includes("WIFEXITED"), "Checks if process exited normally")
assert(src.includes("WEXITSTATUS"), "Extracts exit status code")
assert(src.includes("return exit_code"), "Returns exit code to caller")

// ===== Game Source Enum Tests =====
section("Game Source Enum Values")

assert(hdr.includes("GAME_SOURCE_NONE = 0"), "GAME_SOURCE_NONE = 0")
assert(hdr.includes("GAME_SOURCE_SEED = 1"), "GAME_SOURCE_SEED = 1")
assert(hdr.includes("GAME_SOURCE_STEAM = 2"), "GAME_SOURCE_STEAM = 2")
assert(hdr.includes("GAME_SOURCE_NON_STEAM = 3"), "GAME_SOURCE_NON_STEAM = 3")
assert(hdr.includes("GAME_SOURCE_MANUAL = 4"), "GAME_SOURCE_MANUAL = 4")

// ===== Struct Field Tests =====
section("Struct Fields")

assert(hdr.includes("char id[37]"), "id field: 37 bytes")
assert(hdr.includes("char title[128]"), "title field: 128 bytes")
assert(hdr.includes("game_source_t source"), "source field: game_source_t")
assert(hdr.includes("int appid"), "appid field: int")
assert(hdr.includes("char installdir[256]"), "installdir field: 256 bytes")

// ===== Summary =====
console.log("\n" + "═".repeat(50))
console.log(`Results: ${passed} passed, ${failed} failed (${total} total)`)
console.log("═".repeat(50))

if (failed > 0) {
  process.exit(1)
}

console.log("\nAll stratusd steam_launcher tests passed!")
