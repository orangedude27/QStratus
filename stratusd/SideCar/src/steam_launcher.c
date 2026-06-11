/*
 * Steam game launcher module
 *
 * Handles launching Steam games via the Steam client (headless mode)
 * and manages the game catalog for Steam vs non-Steam games.
 */

#define _GNU_SOURCE

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/wait.h>
#include <time.h>

#include "steam_launcher.h"

#define MAX_GAMES_CATALOG 64
#define STEAM_CMD_MAX 512

static game_entry_t games_catalog[MAX_GAMES_CATALOG];
static int game_count = 0;
static int steam_client_pid = 0;

int steam_register_game(const char *id, const char *title, game_source_t source, int appid, const char *installdir) {
    if (game_count >= MAX_GAMES_CATALOG) {
        fprintf(stderr, "[SteamLauncher] Game catalog full (%d games)\n", MAX_GAMES_CATALOG);
        return -1;
    }

    game_entry_t *entry = &games_catalog[game_count];
    strncpy(entry->id, id, 36);
    entry->id[36] = '\0';
    strncpy(entry->title, title, 127);
    entry->title[127] = '\0';
    entry->source = source;
    entry->appid = appid;
    if (installdir) {
        strncpy(entry->installdir, installdir, 255);
        entry->installdir[255] = '\0';
    } else {
        entry->installdir[0] = '\0';
    }

    game_count++;
    return 0;
}

game_entry_t *steam_find_game_by_id(const char *id) {
    for (int i = 0; i < game_count; i++) {
        if (strcmp(games_catalog[i].id, id) == 0) {
            return &games_catalog[i];
        }
    }
    return NULL;
}

int steam_get_game_count(void) {
    return game_count;
}

int steam_is_running(void) {
    if (steam_client_pid == 0) return 0;
    return kill(steam_client_pid, 0) == 0;
}

int steam_launch_game(int appid, const char *steam_path, const char *steam_prefix) {
    char cmd[STEAM_CMD_MAX];
    char appid_str[16];
    char proton_path[512];
    char proton_prefix[512];
    int status;

    snprintf(appid_str, sizeof(appid_str), "%d", appid);

    // Set up environment for Proton
    if (steam_prefix) {
        snprintf(proton_prefix, sizeof(proton_prefix), "%s/pfx", steam_prefix);
        setenv("PROTON_PREFIX", proton_prefix, 1);
    }
    setenv("PROTON_LOG", "1", 1);

    // Build Steam launch command
    // steam -no-browser -silent -applaunch <appid>
    snprintf(cmd, sizeof(cmd),
        "steam -no-browser -silent -applaunch %s", appid_str);

    fprintf(stderr, "[SteamLauncher] Launching Steam game AppID %d: %s\n", appid, cmd);

    int pid = fork();
    if (pid < 0) {
        perror("[SteamLauncher] fork");
        return -1;
    }

    if (pid == 0) {
        // Child process
        setpgid(getpid(), 0);

        // Redirect output to null unless debugging
        if (getenv("STRATUSD_GAME_DEBUG") == NULL) {
            int devnull = open("/dev/null", O_WRONLY, 0);
            if (devnull >= 0) {
                dup2(devnull, 1);
                dup2(devnull, 2);
                close(devnull);
            }
        }

        execlp("steam", "steam", "-no-browser", "-silent",
               "-applaunch", appid_str, NULL);
        perror("[SteamLauncher] execlp steam");
        _exit(1);
    }

    // Parent process: wait for game to exit
    steam_client_pid = pid;
    fprintf(stderr, "[SteamLauncher] Steam game PID: %d\n", pid);

    if (waitpid(pid, &status, 0) < 0) {
        perror("[SteamLauncher] waitpid");
        steam_client_pid = 0;
        return -1;
    }

    steam_client_pid = 0;

    if (WIFEXITED(status)) {
        int exit_code = WEXITSTATUS(status);
        fprintf(stderr, "[SteamLauncher] Game exited with code %d\n", exit_code);
        return exit_code;
    }

    return -1;
}

void steam_stop(void) {
    if (steam_client_pid > 0) {
        fprintf(stderr, "[SteamLauncher] Stopping Steam client (PID %d)\n", steam_client_pid);
        kill(steam_client_pid, SIGTERM);
        usleep(500000);
        int status;
        int result = waitpid(steam_client_pid, &status, WNOHANG);
        if (result == 0) {
            kill(steam_client_pid, SIGKILL);
            waitpid(steam_client_pid, &status, 0);
        }
        steam_client_pid = 0;
    }
}
