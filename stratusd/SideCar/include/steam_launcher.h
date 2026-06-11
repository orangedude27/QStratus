#ifndef STEAM_LAUNCHER_H
#define STEAM_LAUNCHER_H

typedef enum {
    GAME_SOURCE_NONE = 0,
    GAME_SOURCE_SEED = 1,
    GAME_SOURCE_STEAM = 2,
    GAME_SOURCE_NON_STEAM = 3,
    GAME_SOURCE_MANUAL = 4
} game_source_t;

typedef struct {
    char id[37];
    char title[128];
    game_source_t source;
    int appid;
    char installdir[256];
} game_entry_t;

int steam_launch_game(int appid, const char *steam_path, const char *steam_prefix);
int steam_is_running(void);
void steam_stop(void);
int steam_register_game(const char *id, const char *title, game_source_t source, int appid, const char *installdir);
game_entry_t *steam_find_game_by_id(const char *id);
int steam_get_game_count(void);

#endif
