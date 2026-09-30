# In Between us.

A chat between two installations, stations A and B. Each visitor types a name and is paired with whoever is waiting at the other installation. The server rewrites every message with OpenAI, in the tone chosen on the slider.

## Session flow

The client moves through four scenes ([scene.js](src/web/static/js/scene.js), switched by `changeScene` in [main.js](src/web/static/js/main.js)): Home → Login → Waiting → Chat. Two more, Setup and Closed, replace them when the server won't take the page.

1. **Connecting.** Each installation is set up once on the Setup scene ([setup.js](src/web/static/js/setup.js)): station A or B, and the station key. They're saved in `localStorage`, because the iPads run the page as a home-screen app, which always opens at `/`. The socket sends both in its handshake. If the server refuses them, the client goes back to Setup.
2. **Login.** The visitor enters a name. The client emits `login` and shows the waiting screen.
3. **Pairing.** The server keeps a single waiting slot. If it's empty, or held by the same station, the new user takes it. If the other station is waiting, the two are paired and put in a Socket.IO room, and both receive `room`.
4. **Chat.** `send-message` goes through OpenAI and comes back to both clients as `response-message`. If a visitor doesn't reply within 30–45 s of the partner's message, the client sends `send-ghost-message` and the server writes a reply on their behalf.
5. **Ending.**
   - **X button:** the client emits `logout`. The partner receives `logout` and reloads to the home screen.
   - **Page closed or connection lost:** the partner receives `userdisconnect`, returns to the waiting screen and logs in again.
   - **Client dies without closing (e.g. power loss):** the server only notices after the Socket.IO heartbeat times out, about 45 s later. The partner is then handled as above.
   - **Reconnect:** a client that reconnects gets a new session id, which isn't paired. It returns to the waiting screen and logs in again. Its new socket replaces the station's old one at once, so the partner doesn't wait for the heartbeat.
   - **Same station opened twice:** the newest page takes the station. The older one is disconnected and goes to Closed, with "Use this screen" and "Change station" buttons. It never reloads by itself, so the two pages don't keep taking the station from each other.
   - **Idle timeout:** a client left on the login or waiting screen reloads to the home screen after 3600 frames (about a minute at 60 fps).

## Socket events

| Direction | Event | Meaning |
| --- | --- | --- |
| client → server | handshake | `auth: {station, key}`: refused unless the station is `A` or `B` and the key is right |
| client → server | `login` | `{userName}`: take the waiting slot, or pair with whoever holds it |
| client → server | `logout` | End the chat. The partner receives `logout` |
| client → server | `send-message` | The visitor's message, the tone slider and recent history |
| client → server | `send-ghost-message` | The tone slider and recent history |
| server → client | `room` | `{userA, userB}`, each `{sessionId, userName, station}`: the two users are paired |
| server → client | `response-message` | The rewritten message, the next pair of tones and the color |
| server → client | `userdisconnect` | The partner left. Go back to waiting |
| server → client | `logout` | The partner pressed X. Reload |

## Server notes

- **Pairing state lives in memory** (`waiting_user`, `partners`, `rooms`, `stations` and `station_sessions` in [main.py](src/main.py)). With only two installations there's nothing to share, and a restart just clears the state; clients log in again when they reconnect. Firestore only stores the current `color` document.
- **Run exactly one server process and one instance.** A second instance keeps its own pairing state and can leave the two installations unable to reach each other. On Cloud Run, deploy with `--max-instances=1` (see [deployment.md](deployment.md)).
- **OpenAI and Firestore calls run in `eventlet.tpool`.** The server runs in eventlet mode without monkey-patching, so a blocking call on the main thread would freeze every client. Don't add `eventlet.monkey_patch()`: it's known to break the gRPC library Firestore uses. OpenAI calls time out after 20 s and retry once. The Firestore color write happens after the message is sent, times out after 5 s with no retry, and a failure is only logged.
- A reply is dropped if the sender is no longer paired, or is paired with someone else, by the time OpenAI answers.
- **Development mode is on only when `DEBUG=1`.** It restarts the server on code changes, logs requests and reloads templates. The dev container sets it, and the Docker image doesn't, so don't set it on Cloud Run. Werkzeug's interactive debugger is never used, because in eventlet mode it serves a Python console at `/console`.
- **The OpenAI key comes from `OPENAI_API_KEY`**, set from Secret Manager on Cloud Run. For local development it can go in `src/config.toml` as `openai_api_key` instead. That file never goes into the image. See [deployment.md](deployment.md) for building, deploying and rotating the key.
- **The station key comes from `STATION_KEY`**, also from Secret Manager on Cloud Run, or `station_key` in `src/config.toml` locally. The server doesn't start without it. See [deployment.md](deployment.md#setting-up-the-installations) for the installation URLs.
- **Sockets are same-origin only.** `cors_allowed_origins` is left at its default, so only pages served by this server can connect.
- **The dev server is reachable from the local network** at `http://<your machine's IP>:8080`, so the installation devices can be tested against it.

## Known limitations

Open problems and their planned fixes are tracked in [todo.md](todo.md).
