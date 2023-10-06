# Walter Clarinet

## Requirements
1. NodeJS
2. NPM packages: `discord.js-selfbot-v13 expresss socket.io axios dotenv cors`
3. Common sense

## Instructions

### Without Spotify & Tenor GIF API

1. Meet requirements 1 and 3
2. Meet requirement #2 by doing: `npm init -y && discord.js-selfbot-v13 expresss socket.io axios dotenv cors`
3. Rename `.env.sample` to `.env`
4. Paste your Discord token in `DISCORD_TOKEN`
5. Do `node index.js`
6. Enjoy!

### With Spotify & Tenor API integration

1. Do all the steps without Spotify integration
2. Go to `https://developer.spotify.com/dashboard` and create a new application (**Make sure its URI is localhost:3000 and redirect URI `localhost:3000/callback`**)
3. Copy the Client ID, Client Secret, and Redirect URI (must be `localhost:3000/callback`) and paste them in the `.env` file in their respective places.
4. Start the server by doing `node .` or `node index.js`
5. Go to `localhost:3000/spotify` for integration with Spotify
6. Enjoy the Spotify bar.

### Misc. Info

UI might not be good, but after each commit, I hope it gets better.
