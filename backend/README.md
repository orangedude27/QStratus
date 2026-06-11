# Stratus Backend

The backend coordination server is written in TypeScript using express.js, and
uses a local JSON store for users and game metadata.


## Development Setup

1.  Set applicable options in a `.env` file:

    - `AUTH_SECRET`: the secret used to sign client JWT tokens (**required**)
    - `DATA_FILE`: path to local data file (defaults to `./storage/store.json`)
    - `SEED_GAMES_FILE`: optional JSON array of game entries used to initialize
      `games` in the data file on first startup
    - `FRONTEND_URL`: the base URL of the frontend (defaults to
      `http://localhost:3000`)
    - `PORT`: the TCP port to serve the backend on (defaults to 4000)
    - `GOOGLE_CLIENT_ID`: optional Google OAuth client ID (required only if
      using Google sign-in)
    - `STRATUSD_PASSWORD`: The password used to authenticate stratusd nodes (if
      left undefined, authentication is disabled)
    - `WHITELISTED_DOMAIN`: If specified, the email address domain to restrict
      signups to
    - `WHITELISTED_USERS`: If specified, the list of users to restrict stream
      access to

2.  Populate `backend/data/games.json` (or your `SEED_GAMES_FILE`) with game
    metadata if you want browse/play entries available on first run.

3.  Install the required dependencies with `npm install`

4.  Start development server with `npm run dev`

