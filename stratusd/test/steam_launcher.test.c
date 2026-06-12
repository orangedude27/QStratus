/*
 * Tests for steam_launcher.c
 *
 * Requires: cmocka framework
 * Install: apt-get install cmake cmocka libcmocka-dev
 *
 * Build:
 *   mkdir -p build && cd build
 *   cmake -DWITH_TESTS=ON ..
 *   make steam_launcher_test
 *   ./steam_launcher_test
 */

#include <stdarg.h>
#include <stddef.h>
#include <setjmp.h>
#include <cmocka.h>
#include <string.h>
#include <stdio.h>

/* Include the header under test */
#include "../SideCar/src/steam_launcher.h"

/* --- Mocks for system calls --- */

static int mock_fork_called = 0;
static pid_t mock_fork_return = 0;

static int mock_waitpid_called = 0;
static int mock_waitpid_status = 0;

static int mock_kill_called = 0;
static int mock_kill_pid = 0;
static int mock_kill_return = 0;

/* --- Fixtures --- */

static void steam_launcher_setup(void **state) {
    (void) state;
    mock_fork_called = 0;
    mock_waitpid_called = 0;
    mock_kill_called = 0;
}

static void steam_launcher_teardown(void **state) {
    (void) state;
    mock_fork_called = 0;
    mock_waitpid_called = 0;
    mock_kill_called = 0;
}

/* --- Test: steam_register_game adds a game --- */

static void test_register_game(void **state) {
    (void) state;

    int result = steam_register_game(
        "game-001",
        "Test Game",
        GAME_SOURCE_STEAM,
        730,
        "csgo"
    );

    assert_int_equal(result, 0);
    assert_int_equal(steam_get_game_count(), 1);
}

/* --- Test: steam_register_game fills catalog --- */

static void test_register_game_catalog_full(void **state) {
    (void) state;

    /* Register MAX_GAMES_CATALOG games */
    for (int i = 0; i < 64; i++) {
        char id[16];
        char title[32];
        snprintf(id, sizeof(id), "game-%03d", i);
        snprintf(title, sizeof(title), "Game %d", i);
        steam_register_game(id, title, GAME_SOURCE_STEAM, 1000 + i, "dir");
    }

    assert_int_equal(steam_get_game_count(), 64);

    /* Next registration should fail */
    int result = steam_register_game(
        "overflow",
        "Too Many",
        GAME_SOURCE_STEAM,
        9999,
        "overflow"
    );

    assert_int_equal(result, -1);
}

/* --- Test: steam_find_game_by_id finds existing game --- */

static void test_find_game_by_id(void **state) {
    (void) state;

    steam_register_game("game-001", "Test Game", GAME_SOURCE_STEAM, 730, "csgo");

    game_entry_t *found = steam_find_game_by_id("game-001");

    assert_non_null(found);
    assert_string_equal(found->title, "Test Game");
    assert_int_equal(found->appid, 730);
    assert_int_equal(found->source, GAME_SOURCE_STEAM);
}

/* --- Test: steam_find_game_by_id returns NULL for missing game --- */

static void test_find_game_not_found(void **state) {
    (void) state;

    steam_register_game("game-001", "Test Game", GAME_SOURCE_STEAM, 730, "csgo");

    game_entry_t *found = steam_find_game_by_id("nonexistent");

    assert_null(found);
}

/* --- Test: steam_register_game with NULL installdir --- */

static void test_register_game_null_installdir(void **state) {
    (void) state;

    int result = steam_register_game(
        "game-002",
        "Direct Exec",
        GAME_SOURCE_DIRECT,
        0,
        NULL
    );

    assert_int_equal(result, 0);

    game_entry_t *found = steam_find_game_by_id("game-002");
    assert_non_null(found);
    assert_string_equal(found->installdir, "");
    assert_int_equal(found->source, GAME_SOURCE_DIRECT);
}

/* --- Test: steam_register_game truncates long strings --- */

static void test_register_game_truncation(void **state) {
    (void) state;

    char long_id[100];
    char long_title[200];
    memset(long_id, 'A', sizeof(long_id) - 1);
    long_id[sizeof(long_id) - 1] = '\0';
    memset(long_title, 'B', sizeof(long_title) - 1);
    long_title[sizeof(long_title) - 1] = '\0';

    int result = steam_register_game(
        long_id,
        long_title,
        GAME_SOURCE_STEAM,
        730,
        "dir"
    );

    assert_int_equal(result, 0);

    game_entry_t *found = steam_find_game_by_id(long_id);
    assert_non_null(found);
    /* ID should be truncated to 36 chars */
    assert_memory_equal(found->id, long_id, 36);
    /* Title should be truncated to 127 chars */
    assert_memory_equal(found->title, long_title, 127);
}

/* --- Test: steam_get_game_count returns correct count --- */

static void test_game_count(void **state) {
    (void) state;

    assert_int_equal(steam_get_game_count(), 0);

    steam_register_game("g1", "Game 1", GAME_SOURCE_STEAM, 730, "d1");
    assert_int_equal(steam_get_game_count(), 1);

    steam_register_game("g2", "Game 2", GAME_SOURCE_DIRECT, 0, NULL);
    assert_int_equal(steam_get_game_count(), 2);

    steam_register_game("g3", "Game 3", GAME_SOURCE_STEAM, 440, "d2");
    assert_int_equal(steam_get_game_count(), 3);
}

/* --- Test: steam_is_running returns 0 when no PID --- */

static void test_is_running_no_pid(void **state) {
    (void) state;

    int running = steam_is_running();
    assert_int_equal(running, 0);
}

/* --- Test: steam_stop with no running client --- */

static void test_stop_no_client(void **state) {
    (void) state;

    /* Should not crash or error */
    steam_stop();
    assert_int_equal(mock_kill_called, 0);
}

/* --- Test: Multiple games with different sources --- */

static void test_mixed_game_sources(void **state) {
    (void) state;

    steam_register_game("steam-1", "Steam Game", GAME_SOURCE_STEAM, 730, "csgo");
    steam_register_game("direct-1", "Direct Game", GAME_SOURCE_DIRECT, 0, NULL);
    steam_register_game("steam-2", "Another Steam", GAME_SOURCE_STEAM, 440, "tf2");

    assert_int_equal(steam_get_game_count(), 3);

    game_entry_t *steam1 = steam_find_game_by_id("steam-1");
    assert_non_null(steam1);
    assert_int_equal(steam1->source, GAME_SOURCE_STEAM);

    game_entry_t *direct1 = steam_find_game_by_id("direct-1");
    assert_non_null(direct1);
    assert_int_equal(direct1->source, GAME_SOURCE_DIRECT);
}

/* --- Test: Duplicate ID handling (allows duplicates) --- */

static void test_duplicate_ids_allowed(void **state) {
    (void) state;

    /* The implementation allows duplicate IDs (finds first match) */
    steam_register_game("dup", "First", GAME_SOURCE_STEAM, 730, "dir1");
    steam_register_game("dup", "Second", GAME_SOURCE_DIRECT, 0, NULL);

    assert_int_equal(steam_get_game_count(), 2);

    game_entry_t *found = steam_find_game_by_id("dup");
    assert_non_null(found);
    assert_string_equal(found->title, "First");
}

/* --- Test: Empty title and ID --- */

static void test_empty_strings(void **state) {
    (void) state;

    int result = steam_register_game("", "", GAME_SOURCE_STEAM, 0, "");
    assert_int_equal(result, 0);

    game_entry_t *found = steam_find_game_by_id("");
    assert_non_null(found);
    assert_string_equal(found->title, "");
    assert_int_equal(found->appid, 0);
}

/* --- Test: AppID zero for non-Steam games --- */

static void test_zero_appid(void **state) {
    (void) state;

    steam_register_game("nonsteam", "My Game", GAME_SOURCE_DIRECT, 0, NULL);

    game_entry_t *found = steam_find_game_by_id("nonsteam");
    assert_non_null(found);
    assert_int_equal(found->appid, 0);
    assert_int_equal(found->source, GAME_SOURCE_DIRECT);
}

/* --- Test: Install directory stored correctly --- */

static void test_installdir_stored(void **state) {
    (void) state;

    steam_register_game("game-003", "Test", GAME_SOURCE_STEAM, 570, "dota 2 beta");

    game_entry_t *found = steam_find_game_by_id("game-003");
    assert_non_null(found);
    assert_string_equal(found->installdir, "dota 2 beta");
}

/* --- Main --- */

int main(void) {
    const struct CMUnitTest tests[] = {
        cmocka_unit_test_setup_teardown(test_register_game,
            steam_launcher_setup, steam_launcher_teardown),
        cmocka_unit_test_setup_teardown(test_register_game_catalog_full,
            steam_launcher_setup, steam_launcher_teardown),
        cmocka_unit_test_setup_teardown(test_find_game_by_id,
            steam_launcher_setup, steam_launcher_teardown),
        cmocka_unit_test_setup_teardown(test_find_game_not_found,
            steam_launcher_setup, steam_launcher_teardown),
        cmocka_unit_test_setup_teardown(test_register_game_null_installdir,
            steam_launcher_setup, steam_launcher_teardown),
        cmocka_unit_test_setup_teardown(test_register_game_truncation,
            steam_launcher_setup, steam_launcher_teardown),
        cmocka_unit_test_setup_teardown(test_game_count,
            steam_launcher_setup, steam_launcher_teardown),
        cmocka_unit_test_setup_teardown(test_is_running_no_pid,
            steam_launcher_setup, steam_launcher_teardown),
        cmocka_unit_test_setup_teardown(test_stop_no_client,
            steam_launcher_setup, steam_launcher_teardown),
        cmocka_unit_test_setup_teardown(test_mixed_game_sources,
            steam_launcher_setup, steam_launcher_teardown),
        cmocka_unit_test_setup_teardown(test_duplicate_ids_allowed,
            steam_launcher_setup, steam_launcher_teardown),
        cmocka_unit_test_setup_teardown(test_empty_strings,
            steam_launcher_setup, steam_launcher_teardown),
        cmocka_unit_test_setup_teardown(test_zero_appid,
            steam_launcher_setup, steam_launcher_teardown),
        cmocka_unit_test_setup_teardown(test_installdir_stored,
            steam_launcher_setup, steam_launcher_teardown),
    };

    return cmocka_run_group_tests(tests, NULL, NULL);
}
