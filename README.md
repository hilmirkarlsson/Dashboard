# Dashboard

Personal glassmorphism dashboard (Health, Finance, Projects, Notes/Obsidian tabs).

## API server link

The working link for the local API server (`server.js`) on the home network:

```
http://192.168.8.163:9876
```

Start it with:

```
node server.js
```

`server.js` reads `PORT` from the environment (defaults to `9876`) and proxies
Google Drive-backed vault/health/workout data to the dashboard frontend.

## Note

`app.js` currently points `API` at a Railway deployment
(`https://dashboard-production-100b.up.railway.app`), which was not reachable
as of 2026-07-01. If the local link above is what's actually in use, `app.js`
should point back to `http://192.168.8.163:9876` instead.
