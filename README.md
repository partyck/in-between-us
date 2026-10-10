# In Between us.

A chat between two installations, stations A and B. Each visitor types a name and is paired with whoever is waiting at the other installation. The server rewrites every message with OpenAI, in the tone chosen on the slider.

## Session flow

The client moves through four scenes ([scene.js](src/web/static/js/scene.js), switched by `changeScene` in [main.js](src/web/static/js/main.js)): Home → Login → Waiting → Chat. Two more, Setup and Closed, replace them when the server won't take the page.

1. **Connecting.** Each installation is set up once on the Setup scene ([setup.js](src/web/static/js/setup.js)): station A or B, and the station key. They're saved in `localStorage`, because the iPads run the page as a home-screen app, which always opens at `/`. The socket sends both in its handshake. If the server refuses them, the client goes back to Setup.
2. **Home.** Bubbles in the tone colors drift across the screen and move away from the visitor's finger ([home.js](src/web/static/js/home.js)). The "touch here to connect" button grows for 10 s, then its text comes into focus over 3 s. Only then does touching it work: the other bubbles fly off the screen, away from the touch, and Login opens once they're all gone.
3. **Login.** The visitor enters a name. The client emits `login` and shows the waiting screen.
4. **Pairing.** The server keeps a single waiting slot. If it's empty, or held by the same station, the new user takes it. If the other station is waiting, the two are paired and put in a Socket.IO room, and both receive `room`.
5. **Chat.** `send-message` goes through OpenAI and comes back to both clients as `response-message`. Each client tells its own messages from the partner's by the sender's station, not by name, since both visitors can type the same name. If the server can't deliver a message, its bubble fades out over 6 s and is removed. If a visitor doesn't send anything within 30–45 s of the partner's message, or of the start of the chat, the client sends `send-ghost-message` and the server writes a message on their behalf.
6. **Ending.**
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
| client → server | `send-message` | The visitor's message, the tone slider and recent history. The server's ack is `{delivered}`: `false` means it dropped the message, and the client fades the bubble out |
| client → server | `send-ghost-message` | The tone slider and recent history |
| server → client | `room` | `{userA, userB}`, each `{sessionId, userName, station}`: the two users are paired |
| server → client | `response-message` | The rewritten message, the sender's station, the next pair of tones and the color |
| server → client | `userdisconnect` | The partner left. Go back to waiting |
| server → client | `logout` | The partner pressed X. Reload |

## Server notes

- **Pairing state lives in memory** (`waiting_user`, `partners`, `rooms`, `stations`, `station_sessions` and `room_tones` in [main.py](src/main.py)). With only two installations there's nothing to share, and a restart just clears the state; clients log in again when they reconnect. Firestore only stores the current `color` document.
- **Run exactly one server process and one instance.** A second instance keeps its own pairing state and can leave the two installations unable to reach each other. On Cloud Run, deploy with `--max-instances=1`, and keep gunicorn at one worker (see [deployment.md](deployment.md)).
- **Every connection and every socket event runs in its own thread** (Flask-SocketIO's threading mode), so a blocking OpenAI or Firestore call only holds up its own handler. The image runs the app with gunicorn, one worker and 100 threads ([src/Dockerfile](src/Dockerfile)), and `make run` with Werkzeug's development server. Shared state changes under a lock: `pairing_lock`, and `request_times_lock` for the rate limit. OpenAI calls time out after 20 s and retry once. The Firestore color write happens after the message is sent, times out after 5 s with no retry, and a failure is only logged.
- **Each message costs one OpenAI call**, to the model set in `parse_completion` ([main.py](src/main.py)), currently `gpt-6.1-sol`. It rewrites the message, or writes a ghost message, and picks the next pair of tones for both sliders.
- **The sliders get a new pair with every message.** OpenAI picks the pair by name from a list that leaves out the pair on the sender's slider and the room's last one, so it can't pick the pair the sliders already show, or a tone that doesn't exist. If the partner's reply brought the same pair while OpenAI was answering, the server takes another one at random.
- **OpenAI spend is limited** ([`read_message`](src/main.py#L193-L218)), because everything the client sends ends up in that prompt.
  - **Rate.** Each station can send 20 messages a minute, and more are dropped. The count is per station, so reconnecting doesn't reset it.
  - **Size.** A message over 500 characters, or with a tone name that isn't in the tone table, is dropped. The chat input's `maxlength` comes from the same constant, `MAX_MESSAGE_LENGTH`, so the iPads never send one. The sender's name is cut to 40 characters, and only the last 10 history entries are kept, each cut to 1000 characters.
  - **Output.** Each OpenAI reply is capped at 4000 tokens, reasoning included (`MAX_COMPLETION_TOKENS`). A reply that hits the cap is dropped and logged.
  - A dropped message is logged, and its ack says it wasn't delivered. The OpenAI project's budget limit caps the total (see [deployment.md](deployment.md#one-time-setup)).
- A reply is dropped if the sender is no longer paired, or is paired with someone else, by the time OpenAI answers.
- **Every `send-message` gets an ack** ([`respond`](src/main.py#L254-L317)): `{delivered: true}` once `response-message` is out, and `{delivered: false}` whenever the message is dropped, whether by a limit, an OpenAI refusal, the output cap, a pairing that changed or an exception. The client then fades the bubble out instead of leaving it waiting.
- **Handler errors go to [`on_error`](src/main.py#L168-L176)**, which logs the traceback and answers with `{delivered: false}`. For the handshake it returns `False`, so a check that throws refuses the socket. Flask-SocketIO uses its return value in place of the handler's, so anything else would let the socket in without the station key. It also catches the `TypeError` from a handler called with an argument it doesn't take, which is why `on_disconnect` accepts the `reason` Flask-SocketIO passes.
- **Python packages are pinned** in [requirements.txt](src/requirements.txt), which pip-compile generates from [requirements.in](src/requirements.in), the packages the code imports and the server that runs it. See [deployment.md](deployment.md#updating-dependencies) for updating them and checking them with pip-audit.
- **Development mode is on only when `DEBUG=1`.** It restarts the server on code changes and reloads templates. The dev container sets it, and the Docker image doesn't, so don't set it on Cloud Run. Werkzeug's development server logs every request either way, and gunicorn in the image logs none. Werkzeug's interactive debugger is never used, because it serves a Python console at `/console`.
- **The OpenAI key comes from `OPENAI_API_KEY`**, set from Secret Manager on Cloud Run. For local development it can go in `src/config.toml` as `openai_api_key` instead. That file never goes into the image. See [deployment.md](deployment.md) for building, deploying and rotating the key.
- **The station key comes from `STATION_KEY`**, also from Secret Manager on Cloud Run, or `station_key` in `src/config.toml` locally. The server doesn't start without it. See [deployment.md](deployment.md#setting-up-the-installations) for the installation URLs.
- **Sockets are same-origin only.** `cors_allowed_origins` is left at its default, so only pages served by this server can connect.
- **The dev server is reachable from the local network** at `http://<your machine's IP>:8080`, so the installation devices can be tested against it.

## Client notes

- **An error in `draw()` stops the whole sketch.** p5 only asks for the next frame once `draw()` returns, so the screen freezes on a half-drawn frame. On a kiosk nobody sees the console.
- **Per-frame maths on the Home scene uses plain `Math`, not p5's helpers.** On the iPads, Safari's JavaScript engine once turned the p5 version of the bubble maths into `NaN`, which froze the sketch (the frozen-iPad fix under Done in [todo.md](todo.md)). Keep any value that carries over between frames, like a position, away from p5's math helpers.
- **Time things with the clock, not by counting frames.** The iPads' frame rate varies, and the first frame after waking up is slow. Use `deltaTime`, `millis()` or `performance.now()`, as the Home animations and the ghost timer do. The idle reload timer still counts frames (F7 in [todo.md](todo.md)).
- **Safari ignores canvas filters.** The Home button's text comes into focus through a blurred shadow instead (`BubbleM.displayText`).
- **To debug an iPad,** connect it to a Mac and use Safari's Web Inspector. The inspector attaches after the app has started, so it can miss errors from the launch.

## Known limitations

Open problems and their planned fixes are tracked in [todo.md](todo.md).
