# CLAUDE.md

Context for Claude Code sessions in this repo. The longer docs are linked below. Read the ones that touch your task before changing anything non-trivial.

## Working with the user

- **Never commit, and don't offer to.** The user makes every commit themselves ("leave it to me to do the commits"). Leave changes in the working tree and say what changed.
- Work happens on the `wip` branch.
- The user tests client changes on the real iPads, with Safari Web Inspector on a Mac. The dev container has no browser and no Node, so say plainly when a client change hasn't been run.
- Keep the docs in step with the code (see [Docs](#docs)).

## What this is

"In between us." is an art installation. Two iPads, **station A** and **station B**, run the same web page as a home-screen app (PWA). A visitor types a name and is paired with the visitor at the other iPad, and they chat. The server rewrites every message with OpenAI in the tone the sender picked on a slider (e.g. Formal ↔ Informal). The partner only sees the rewritten text. In the same call, OpenAI picks the next pair of opposite tones for both sliders, never the pair they already show. If a visitor stays silent for 30–45 s, the AI writes a "ghost message" on their behalf.

**Stack.** Python 3.11, Flask 3.1, Flask-SocketIO 5.6 (python-socketio 5.17) in threading mode, served by gunicorn 26 in the image and by Werkzeug's development server for `make run`, OpenAI SDK 1.60 structured outputs, firebase-admin 7.7 (Firestore). Every Python package is pinned in `src/requirements.txt`, which pip-compile generates from `src/requirements.in`. The client is plain JS with p5.js 1.6 in global mode, p5.sound 1.0.1 and the Socket.IO 4.6.1 client, all vendored in `src/web/static/js/lib/`. There's no build step and no npm. It's deployed on Google Cloud Run as a single instance.

## Docs

| File | What's in it |
| --- | --- |
| [README.md](README.md) | Session flow, socket events, server notes |
| [architecture.md](architecture.md) | Pairing state machine, message pipeline, concurrency, client scenes, socket payloads, mermaid flows, use cases |
| [deployment.md](deployment.md) | Config and secrets, Cloud Run deploy, setting up the iPads, key rotation, local dev |
| [todo.md](todo.md) | Open problems with stable IDs and severities, "Where to start", and a Done section |

Conventions:

- todo.md IDs never change: **S** security, **P** sockets/protocol, **A** server architecture, **F** frontend, **D** deployment. Priorities right now: A3 (server-side history with message ids, which fixes P2, P3, P10, S5, F5).
- When you fix an item, move it to Done under the same ID, say what changed and why with file links, and write "Not committed yet". Once the user has committed it, a later session replaces that with "Fixed in `<hash>`" (check `git log`). Bugs fixed without an ID go in a "Fixed in `<hash>` (<commit message>):" list at the end of Done.
- A behaviour change updates README, architecture.md and deployment.md in the same change. Past fixes touched code, docs and todo.md together.
- Style: plain, short, declarative sentences that explain why. Links are relative markdown links with `#L` line anchors. The anchors drift, so refresh the ones near what you change.

## Layout

```
src/
  main.py          Flask app, Socket.IO handlers, in-memory pairing, OpenAI and Firestore calls
  config.py        Reads env vars / config.toml, STATIONS, the tone table (TONES_WC, TONES_BY_NAME) and its pairs (TONE_PAIRS, TONE_PAIR_OF)
  models.py        Dataclasses for payloads (User, Room, MessageInput…), Pydantic models for OpenAI outputs
  utils/json.py    snake_case <-> camelCase for payloads
  config.toml      Local secrets only. Gitignored, never in the image
  Dockerfile       python:3.11-slim, runs gunicorn as the unprivileged user app
  requirements.in  What the code imports. requirements.txt is generated from it by pip-compile, never edited by hand
  .dockerignore, .gcloudignore, requirements.txt
  web/templates/index.html   The only page: one <section id="<name>-scene"> per scene, then the script tags
  web/static/js/             One file per scene, plus main.js, scene.js, sockets.js, message.js, tone.js, constants.js, sounds.js
  web/static/stylesheets/index.css
  web/static/manifest.json   PWA manifest
.devcontainer/     Python 3.11 container with the gcloud CLI. Sets DEBUG=1 and publishes port 8080
Makefile           run, secrets, station-key, deploy, domain. Every gcloud call uses the in-between-us configuration
```

## Running locally

- `make run` from the repo root, or `python3 src/main.py` from any directory. It listens on 0.0.0.0:8080, so the iPads can open `http://<host IP>:8080` on the same network.
- `src/config.toml` needs `openai_api_key` and `station_key`. The env vars `OPENAI_API_KEY` and `STATION_KEY` win over it. The server won't start without a station key.
- Firestore uses Application Default Credentials (`gcloud auth application-default login`). A failed color write is only logged as `could not save color`.
- To test both stations in one browser, open `http://localhost:8080/#station=A&key=<station_key>` and the same with `station=B` in two tabs.
- `DEBUG=1` (set by the dev container) turns on the reloader and template reloading. Werkzeug logs every request either way. Never pass `debug=True` to `socketio.run`: it serves Werkzeug's Python console at `/console`.
- `make run` needs a terminal: Flask-SocketIO refuses to start Werkzeug when stdin isn't a tty. From a script, use `docker exec -t` into the dev container.
- Any iPad or browser tab that's open reconnects to whatever runs on port 8080, and a test socket for the same station sends it to the Closed scene. Test on another port, e.g. `PORT=8090`.
- There are no tests. Available here: python3, pytest, black, pylint, gcloud. Not available: node or any JS runtime. `python3 -m py_compile src/*.py` is a quick syntax check.
- Sessions on the Mac, outside the dev container, have Docker. They can build `src/Dockerfile` and run the image, with OpenAI faked through `OPENAI_BASE_URL`. firebase-admin needs credentials even then: a throwaway service-account JSON with any RSA key in `GOOGLE_APPLICATION_CREDENTIALS`, plus `FIRESTORE_EMULATOR_HOST` pointed at a port that accepts and never answers, makes each color write time out after 5 s. The dev container publishes 8080 on the Mac, so map the image to another port. D1 and A2 were tested that way.
- Dependencies: change `src/requirements.in`, then regenerate `requirements.txt` and run pip-audit, on Python 3.11 (deployment.md, "Updating dependencies").
- Formatting (from devcontainer.json): black with line length 120, isort with the black profile, 2-space indent in JS and JSON. Code comments are full sentences that explain why.

## Server rules

- **One process, one instance.** Pairing state lives in memory in main.py: `waiting_user`, `partners`, `rooms`, `stations`, `station_sessions`, and `room_tones` for each room's current tone pair. A second instance would have its own waiting slot. Cloud Run runs with `--max-instances=1 --timeout=3600`. gunicorn runs one worker, with its control socket off (`--no-control-socket`), so nothing can add workers at runtime.
- **Threading mode (A2).** gunicorn gives each connection a thread (one worker, 100 threads, in the Dockerfile), and python-socketio runs each event in a thread of its own. Blocking calls are made directly from the handler. OpenAI: 20 s timeout, 1 retry, output capped at `MAX_COMPLETION_TOKENS` (4000). Firestore: 5 s timeout, no retry, run after the emit. Don't bring back eventlet or gevent: both need monkey-patching for blocking calls, which breaks the gRPC library Firestore uses.
- **Shared state changes under a lock.** A thread can be switched out between any two lines. `pairing_lock` guards the pairing state and `room_tones`, and `request_times_lock` the rate limit. Both are plain `threading.Lock`s, which aren't reentrant. Nothing inside `pairing_lock` may call a Socket.IO function: `disconnect()` runs `on_disconnect` in the same thread, which takes the lock again and deadlocks. The existing code changes state inside the lock and emits, joins rooms or disconnects after it. Anything new kept in memory (A3's history) needs a lock too.
- **Auth.** The socket handshake carries `auth: {station, key}`. The station must be in `("A", "B")`, and the key is compared with `hmac.compare_digest`. The newest socket for a station wins and the old one is disconnected (that client shows the Closed scene). Only A pairs with B. CORS stays at its same-origin default: don't set `cors_allowed_origins`.
- **`respond()`** handles both `send-message` and `send-ghost-message`. It makes one OpenAI call (A4), whose `MessageResponse` holds the rewritten text and `next_tones`, the name of the next pair. It drops the reply if the sender's room changed meanwhile, emits `response-message` to the room, and then writes the color to Firestore.
- **Model.** `parse_completion` in main.py uses `model="gpt-6.1-sol"` with `store=True`. If you change it, update the diagram in architecture.md §1 and the server notes in the README.
- **Tone pairs (A4, A6).** OpenAI picks the next pair by its name in `TONE_PAIRS` (`"Informal / Formal"`), from an enum that `message_response_format` in models.py builds for each call. So it can't return a tone that doesn't exist, or mix two pairs.
  - The enum leaves out the pair on the sender's slider and the room's last pair in `room_tones`, so the sliders change with every message. The two differ when the slider carried over from the previous chat (F3) or the partner's reply changed it after the visitor pressed send.
  - If the partner's reply brought the same pair while OpenAI was answering, `respond()` takes a random other pair from the enum, under `pairing_lock`.
  - `MessageResponse` lists `message` before `next_tones` on purpose: structured outputs write keys in schema order, so the tones are picked after the message is written.
  - `message_response_format` is cached per set of pairs, so OpenAI keeps seeing the same few schemas. A new schema can take longer on its first call.
- **The tone table exists twice:** `TONES_WC` in config.py and `Constants.tones` in constants.js. Change both (A5). `TONE_PAIRS` and `TONE_PAIR_OF` are built from `TONES_WC`. `TONES` in config.py is unused.
- The inputs' `maxlength` comes from main.py, so it can't drift from the server's limits: `route_home` passes `MAX_NAME_LENGTH` (40) and `MAX_MESSAGE_LENGTH` (500) to the template as `max_name_length` and `max_message_length`, for `#name-input` and `.chat-input`.
- **Spend limits (S4).** `read_message` in main.py checks every `send-message` and `send-ghost-message` before OpenAI sees it.
  - It drops a message from a socket with no station, and one over the station's `MAX_REQUESTS_PER_MINUTE` (20, counted per station in `request_times`, so a reconnect doesn't reset it).
  - It drops a message over `MAX_MESSAGE_LENGTH`, or with a tone name not in `TONES_BY_NAME`.
  - It cuts names to 40 characters, and keeps the last `MAX_HISTORY_ITEMS` (10) history entries, each cut to `MAX_HISTORY_ITEM_LENGTH` (1000).
  - Anything new that the client sends into a prompt needs a limit there too.
  - `parse_completion` passes `max_completion_tokens=MAX_COMPLETION_TOKENS`. `gpt-6.1-sol` always reasons, and reasoning counts against the cap, so don't set it near the length of a reply. A reply that hits it raises `LengthFinishReasonError`, which `parse_completion` turns into `None`. `respond()` then answers `NOT_DELIVERED`.
  - Every drop answers the sender's ack with `NOT_DELIVERED` (see the next bullet).
- **Acks and errors (P1, S10).** The `send-message` and `send-ghost-message` handlers return `DELIVERED` or `NOT_DELIVERED`, which Socket.IO sends back as the ack. Only the ack for `send-message` is used, by the client. Any way out of `respond()` that doesn't emit `response-message` must return `NOT_DELIVERED`, or the bubble waits forever.
  - `on_error` (`@socketio.on_error_default`) logs the traceback and returns `NOT_DELIVERED`, and `False` when `request.event["message"]` is `connect`. Flask-SocketIO uses the error handler's return value in place of the handler's, so for the handshake anything but `False` would let a socket in without the station key. Keep that check.
  - `on_error` also catches a `TypeError` from a handler that Flask-SocketIO calls with arguments it doesn't take, and the handler then silently does nothing. That's why `on_disconnect` takes `reason` (D1). After upgrading Flask-SocketIO or python-socketio, read the server log for tracebacks.
- **Fixes not to undo:**
  - S1: visitor text goes into the DOM only through `textContent`, never p5's `.html()`.
  - S2: no Werkzeug debugger.
  - S3: `config.toml` and `.env` are left out by both `.dockerignore` and `.gcloudignore`. Keep the two files in sync.
  - S8: only sockets with the station key can connect.
  - S10: an exception in `on_connect` refuses the socket, through `on_error` returning `False`.
  - D1: the image runs as the user `app`, and sets `PYTHONUNBUFFERED=1` so `print` output reaches Cloud Run's logs straight away.
  - A2: threading mode under gunicorn, one worker, `--no-control-socket`. No eventlet and no `tpool`.

## Client

- **p5 global mode.** p5 calls `setup()`, which calls `init()` in main.js. `init()` creates `c = new Constants()`, `socketService`, and one instance of each scene, as globals: `home`, `login`, `waiting`, `chat`, `closed`, `setupScene`. p5 functions (`color`, `width`, `random`, `select`…) don't exist before `setup()`, so no script may call them at top level. `Constants` must be created before the scenes, because `Bubble` reads `c.tones`.
- **Scenes** extend `Scene` (scene.js). The constructor takes the root element's id. `enter()` and `exit()` toggle the `hidden` class. `draw()` runs every frame between `push()` and `pop()` (main.js), so drawing state can't leak between scenes. Switch with `changeScene(scene)`, which also resets the idle timer.
- **Flow:** Setup (when no station is saved) → Home → Login → Waiting → Chat. Closed appears when another screen takes the station. The diagram is in architecture.md §3.
- **Socket events** go through `SocketService` (sockets.js), which forwards them to optional hooks on the current scene: `onConnect`, `onReconnect`, `onRoom`, `onMessage`, `onPartnerLeft`. A `logout` from the server always reloads the page. A `connect_error` on an inactive socket (key refused) shows Setup. The disconnect reason `io server disconnect` shows Closed.
- **Adding a scene:**
  1. Add `<section id="x-scene" class="hidden">` to index.html.
  2. Write a class that extends `Scene`.
  3. Add its `<script>` tag after `scene.js`, because a class declaration needs its base class loaded first. App scripts load before the p5 libs on purpose: p5 calls `setup()` on window load.
  4. Create it in `init()`.
- **Adding a socket event:** add the handler in main.py and a listener in `SocketService.listenSockets` that calls a `currentScene.onX?.()` hook. Update the event tables in README.md and architecture.md §4.
- The station and key are saved in `localStorage` under the key `station`. A `#station=…&key=…` URL fragment overrides them.
- **Whose message (P8).** The client tells its own messages from the partner's by station, never by display name, since both visitors can type the same name. `room` carries each user's station, `response-message` carries the sender's (set by the server from the socket), and `socketService.station` is the one this screen connected as. Only A pairs with B, so a station names one side of the room. `Message` takes the sender's station as its third argument and picks its side from it.
- Pending bubbles are still matched by text (`content === prompt`), a known flaw (P2). A bubble that's fading out is skipped by both the matching and `messageHistory`.
- **Bubble layout.** `Chat.layout()` places every bubble from its index in `messages` and its height, newest at the bottom, via `Message.placeAbove`. Call it after anything that adds, rewrites or removes a bubble, and don't move bubbles by offsets: a rewrite can come back after the partner's next message, and offsets put it on top of that bubble (P3).
- **Failed messages (P1).** `sendMessage` takes an `onAck` callback. When the ack is `{delivered: false}`, Chat calls `fadeOut()` on that exact bubble. It stops pulsing (the pulse's 50 stacked layers would hide a fade), fades with `drawingContext.globalAlpha` inside `push()`/`pop()` over `MESSAGE_FADE_MS` (6000), and `Chat.removeFadedMessage` then removes it and calls `layout()`, which moves the older bubbles down. p5's `pop()` resyncs its cached fill, so `globalAlpha` doesn't leak into other bubbles.

## iPad and Safari lessons

- **The frozen iPad bug** (fixed 2026-10-01 in bd03d89 and 93fb279). On a cold launch of the home-screen app, the Home sketch froze half-drawn with no console error.
  - Cause: once Safari's JIT optimized `repelFromPointer`, which then used p5's `dist`, `atan2`, `map`, `cos` and `sin`, it returned `NaN` for every bubble it pushed, from ordinary inputs. A bubble at `NaN` makes `createRadialGradient` throw.
  - **Any exception in `draw()` stops p5 for good**, because p5 only schedules the next frame after `draw()` returns.
  - Fix: the per-frame maths in home.js uses plain `Math` (`wander()`, `repelFromPointer()`, a hand-written lerp). Keep it that way. The comment at the top of home.js explains why.
- **Per-frame maths:** prefer plain `Math` to p5's helpers wherever a `NaN` would stay in state (positions, timers). Where a `NaN` would only spoil one frame's fill color (`lerpColor` and `sin` in message.js and tone.js), it's harmless, and those calls were left alone.
- **Time with the clock, not with frames.** The iPad's frame rate varies, and the first frame after waking is slow. Use `deltaTime`, `performance.now()` or `millis()`, as the ghost timer and the Home animations do. The idle reload timer still counts frames (`timerToRefresh = 60 * 60` in main.js, F7).
- Write time checks so that a `NaN` waits instead of firing: `if (!(elapsed >= limit)) return;`.
- **Blur:** Safari ignores `drawingContext.filter`. `BubbleM.displayText` draws the text a canvas width off screen and shifts its blurred shadow (`shadowBlur`) back into place. Shadow offsets and blur are in device pixels, so they're multiplied by `pixelDensity()`.
- **Direct canvas calls:** wrap direct `drawingContext` drawing in `save()`/`restore()`, so p5's cached fill doesn't go out of sync.
- **Home-screen app:** it always opens at the manifest's `start_url` (`./`), and its `localStorage` is separate from Safari's. Set up the station from inside the app.
- **Debugging on the device:** use Safari Web Inspector on a Mac. It can attach after a launch error has already happened, so an empty console proves nothing. A previous session caught launch-time problems with a temporary trap that saved reports in `localStorage` across launches. The iPad viewport in the logs was 1180×788, landscape.
- There's no `windowResized()`, so the canvas keeps the size it had at launch.

## Home scene (home.js)

- About `width * height * 0.0002` `Bubble`s drift on a random walk (`wander`) and are pushed away from the pointer. Each bubble is a single radial-gradient fill that looks like stacked low-alpha circles.
- `BubbleM` is the "touch here to connect" button. It grows for 10 s (`BUBBLE_M_GROW_MS`), then its text comes into focus over 3 s (`BUBBLE_M_FOCUS_MS`). It only responds once `isReady() && isHovered()`. Its hit box is centered, because it's drawn with `rectMode(CENTER)`. Hovering, not tapping, triggers it, on purpose.
- **Exit animation** (13de701): `leave()` sends every other bubble straight away from the touch point at `BUBBLE_FLEE_SPEED` px/ms. The speed is deltaTime-based and the direction is fixed when the animation starts. Once all of them are off screen, the scene changes to Login. The button keeps drifting meanwhile.
- The hidden "In between us." logo was removed in fb1c62f.

## Deployment

- Cloud Run service `in-between-us` in `europe-west1`, project `chat-ai-2025`. `make deploy` builds `src/Dockerfile` with Cloud Build (`--source=src`). The region is `europe-west1` because Cloud Run domain mappings don't exist in `europe-central2`, and the plan is a subdomain of `porpatrick.com` (DNS in Cloudflare, `make domain DOMAIN=…`).
- Every gcloud command in the Makefile uses the gcloud configuration `in-between-us` (the private Google account) and the project `chat-ai-2025`, never the active ones, because on the dev Mac those are a work account (`default`, project `colinewo-staging`). Run manual gcloud commands with `CLOUDSDK_ACTIVE_CONFIG_NAME=in-between-us`.
- Secrets `openai-api-key` and `station-key` in Secret Manager become `OPENAI_API_KEY` and `STATION_KEY`. `make secrets` creates the station key, `make station-key` prints it.
- Flags: `--allow-unauthenticated --cpu=1 --memory=512Mi --max-instances=1 --timeout=3600`. Never set `DEBUG` on Cloud Run.
- The old service `chat-ai1` and the Artifact Registry repository `chat-ai-repo`, both in `europe-central2`, were deleted on 2026-10-08, with the old Cloud Build uploads. The OpenAI key that had leaked into them (S3) was revoked and replaced.
- The full commands are in [deployment.md](deployment.md). Ask before running any gcloud command that changes cloud resources, `make secrets`, `make deploy` and `make domain` included.

## Git

- `wip` is the working branch, 27 commits ahead of `main`. `origin/slovenia` and `origin/stand-by` are older branches from 2025. The tip of `slovenia` was merged into `wip` in 8824748.
- The user writes short, lowercase commit messages ("fix frozen ipad", "home animation").
- `git push` doesn't work inside the dev container. The remote is `git@github.com-personal:partyck/in-between-us.git`, and that SSH alias only exists on the host, so push from the host.

## State of the docs

README.md, architecture.md and todo.md were brought up to date with `13de701` on 2026-10-07, and every line link in them was checked. architecture.md says which commit it describes, so bump that when you update it. The `main.py` and `models.py` line links in every doc were refreshed for A4 on 2026-10-10.

The local `src/config.toml` still has a `dever` key that nothing reads.
