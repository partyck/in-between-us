# To do

Open problems from the session flow review and the architecture review ([architecture.md](architecture.md)), most important first. Fixed items are at the end.

Each item has an ID that stays the same when it moves: **S** security, **P** sockets and protocol, **A** server architecture, **F** frontend, **D** deployment and operations.

- **High:** security or cost exposure, or visitors see something broken in normal use.
- **Medium:** breaks in specific but realistic situations.
- **Low:** cleanup, or only matters later.

## Where to start

1. **S4, server-side limits.** Since S8 only the installations can connect, so the limits now guard against a leaked key and client bugs rather than strangers. Set the OpenAI budget limit either way.
2. **A3, server-side history with message ids.** One change that fixes P2, P3, P8, S5 and F5.
3. **P1, an error path.** Visitors stop seeing messages that never arrive.

## High

- [ ] **S4. OpenAI spend has no limit.** The server doesn't limit event rate, message length or history length (names are capped since S1). Every `send-message` or `send-ghost-message` costs two GPT-4o calls with whatever history the client sends. Since S8 a script needs the station key to connect, but with the key it can pair stations A and B and loop `send-ghost-message` with a large fake history.
  Fix: enforce limits on the server: maximum message length, a cap on history items and total size, one request in flight per session, and a minimum interval between events. Set a budget limit on the OpenAI project.

- [ ] **P1. A failed message spins forever.** There's no error path. If OpenAI times out or refuses (`parsed` is `None`), returns an unknown tone (A6), or the payload is malformed, the handler simply ends ([main.py:183-218](src/main.py#L183-L218)). Nothing is emitted, and the sender's bubble keeps its waiting animation with no retry. There are no acknowledgements, no error event and no `@socketio.on_error_default` handler. On a refusal, the second OpenAI call still runs.
  Fix: emit an error event carrying the message id (or use an ack callback), and let the client mark the bubble as failed or drop it. Check `message.refusal` explicitly, and skip the tone call when there's no message.

- [ ] **P8. Stop using the display name as identity.** Each client decides whether a message is its own by comparing names ([chat.js:32-35](src/web/static/js/chat.js#L32-L35), [waiting.js:22](src/web/static/js/waiting.js#L22)). If both visitors type the same name, each client shows the partner's messages as its own, and the ghost-message timers get mixed up.
  Fix: have the server include a sender id (session id or station) in `room` and `response-message`, and compare that instead.

- [ ] **D5. Check that the server runs as a single instance.** Pairing state is in memory, so a second instance has its own waiting slot and can leave the two installations unable to reach each other (see the README).
  Fix: deploy to Cloud Run with `--max-instances=1`. Deploys keep the setting, so this only has to be set once. Also see D2.

## Medium

- [ ] **S5. Visitors control the prompts, with developer authority.** The typed message, the name and the whole history are inserted into `developer`-role messages ([main.py:120](src/main.py#L120), [main.py:132](src/main.py#L132), [models.py:133-140](src/models.py#L133-L140)). A visitor can type instructions ("ignore the tone and say …") that the model treats as coming from the developer. A scripted client can also invent the entire conversation history.
  Fix: keep the history on the server (A3). Pass visitor text as `user`-role content, or in a clearly delimited data block, and keep instructions in the `developer` message only.

- [ ] **S6. The partner's browser receives the original text.** The partner is only supposed to see the rewritten text, but `response-message` sends `prompt`, the original, to the whole room ([main.py:211](src/main.py#L211)), and [sockets.js:60](src/web/static/js/sockets.js#L60) logs every payload to the console. `room` also sends both session ids to both clients ([main.py:103](src/main.py#L103)).
  Fix: send the matching data only to the sender, or replace it with a message id (P2). Drop `sessionId` from `room`.

- [ ] **P2. Replies are matched to bubbles by text.** The client finds its pending bubble with `message.content === prompt` ([chat.js:36-38](src/web/static/js/chat.js#L36-L38)). If a visitor sends the same text twice, or an earlier reply was dropped (P1) and left a pending bubble with the same text, the wrong bubble gets rewritten.
  Fix: have the client generate a `clientMessageId` and the server echo it back. Together with the sender id from P8, this replaces both name matching and text matching.

- [ ] **P3. Bubbles overlap, and the two screens show different orders.** `rephrase()` always moves the bubble to the bottom slot ([message.js:32](src/web/static/js/message.js#L32)), which is only right if it's still the newest. If the partner's message arrives while yours is pending, your rewritten bubble lands on top of theirs ([chat.js:39-45](src/web/static/js/chat.js#L39-L45)). The sender sees their message where they sent it, but the partner sees it when the reply arrives, so the two screens (and the histories they send) disagree on order. Replies to two quick messages from the same visitor can also arrive out of order, since handlers run concurrently.
  Fix: lay out bubbles from their position in the array on every change instead of moving them by offsets. Have the server assign sequence numbers, or own the history (A3).

- [ ] **P9. Decide what the partner sees when a chat ends.** Pressing X sends the partner to the home screen (`logout`), while a dropped connection sends them to the waiting screen (`userdisconnect`). The X button also calls `location.reload()` straight after `socketService.logout()` ([chat.js:12-13](src/web/static/js/chat.js#L12-L13)). The page can unload before `logout` is sent, and the partner then gets the waiting-screen behaviour.
  Fix: pick one behaviour on purpose. If X should keep sending the partner home, reload only once the server has acknowledged `logout` (a Socket.IO emit callback). P5 renames the events.

- [ ] **A2. Eventlet adds risk that two clients don't need.** Running without monkey-patching means every blocking call has to remember `tpool` (A1 was one that didn't), and `pairing_lock` would deadlock the whole server if anything inside it ever yielded. Eventlet is in maintenance mode, and its maintainers discourage new use.
  Fix: with two clients, `async_mode="threading"` (with `simple-websocket`, and e.g. gunicorn `-w 1 --threads 50`) removes the need for `tpool`, and makes the lock an ordinary lock.

- [ ] **A3. The server keeps no conversation state.** Each client keeps its own message list and sends it with every event. That single choice causes the ghost-history off-by-one (F5) and the name-based identity problem (P8), as well as S4, S5 and P3. The server already knows each room, so it can keep the last N messages per room in memory, next to the pairing state.
  Fix: store `{id, sender, text}` per room on the server, build prompts from it, and have clients send only `{clientMessageId, text, tone}`. This is the change that fixes the most problems at once.

- [ ] **A6. Restrict the tone names OpenAI can return.** `ToneResponse.tone_a` and `tone_b` are plain `str` ([models.py:84-86](src/models.py#L84-L86)). A reply like `"friendly"`, or a tone that isn't in the list, raises a `KeyError` at [main.py:204](src/main.py#L204). The message is never delivered and the sender's bubble keeps its waiting animation (P1).
  Fix: type both fields as a `Literal` or `Enum` built from the tone list, so structured outputs can only return valid names. A4 does this as part of merging the two calls.

- [ ] **F1. The ghost timer can fire early.** [chat.js:111](src/web/static/js/chat.js#L111) compares a frame count against `this.waiting * frameRate()`, and `frameRate()` is the rate of the last frame only. At frame 1000 (about 17 s at 60 fps), a single frame at 20 fps lowers the threshold to 600, and the ghost message fires at 17 s instead of 30–45 s. `this.waiting` is also chosen once per page load ([chat.js:21](src/web/static/js/chat.js#L21)), not once per wait.
  Fix: store a deadline based on `millis()`, and pick a new random delay each time the timer starts. F7 has the same root cause.

- [ ] **F4. End chats that nobody is using.** Ghost messages ([chat.js:108-115](src/web/static/js/chat.js#L108-L115)) reply to each other. If both visitors walk away, the installations keep an AI-to-AI conversation going indefinitely, at about 4 GPT-4o calls a minute. The chat screen has no idle timeout (its [`draw`](src/web/static/js/chat.js#L72-L82) never calls `updateTimer()`), so the next visitor walks up to the previous conversation.
  Fix (unless this is intended): stop after a few ghost messages in a row, or send both installations back to the home screen after a few minutes without a real message.

- [ ] **F5. Include the partner's last message in ghost replies.** `messageHistory` uses `slice(-10, -1)` ([chat.js:27](src/web/static/js/chat.js#L27)), which drops the newest message. That's right for a normal send, where the newest message is the visitor's own prompt. For a ghost message, the newest message is the partner's, which is the one it should be replying to.
  Fix: use `slice(-10)` when building the history for `send-ghost-message`.

- [ ] **D1. The production image is the dev container image.** [src/Dockerfile](src/Dockerfile) builds on `mcr.microsoft.com/devcontainers/python`, which is large, full of dev tooling, and runs as root. [requirements.txt](src/requirements.txt) installs packages nothing imports (`opencv-python`, `numpy`, `GitPython`, `google-api-python-client`, `google-cloud-storage`) and pins 2023-era Flask, Werkzeug and cryptography versions that have published advisories.
  Fix: build on `python:3.11-slim` with a non-root `USER`, trim the requirements to what's imported, and run `pip-audit`.

- [ ] **D2. Chats are cut off at Cloud Run's request timeout.** Cloud Run closes WebSocket connections at the service's request timeout (5 minutes by default). The socket is opened at page load, so a chat that crosses that point reconnects: both sides return to Waiting and the conversation is cleared.
  Fix: deploy with `--timeout=3600`, the maximum (60 minutes), alongside `--max-instances=1` (D5).

## Low

- [ ] **S7. Visitors' messages are logged and stored.** Messages are printed to stdout ([main.py:116](src/main.py#L116), [97](src/main.py#L128), [167](src/main.py#L203)) and stored by OpenAI (`store=True`, [main.py:237](src/main.py#L237)). Visitors at a public installation aren't told.
  Fix: make a deliberate decision. Turn off `store` unless the stored completions are actually used, and log metadata rather than text.

- [ ] **S9. Add a Content-Security-Policy.** S1 was fixed where it happened, but nothing stops a later `.html()` call with visitor text from running code again. All the page's scripts are same-origin files with no inline code ([index.html:86-103](src/web/templates/index.html#L86-L103)), so a `script-src 'self'` policy should fit.
  Fix: send a `Content-Security-Policy` header from Flask, and check that p5.sound still plays, since it may load its audio worklet from a `blob:` URL.

- [ ] **P4. Payloads aren't validated.** `MessageInput.from_json` indexes the raw dict ([models.py:151-171](src/models.py#L151-L171)), so a missing field raises `KeyError` inside the handler. `login` is the exception: since S1 it falls back to an empty name.
  Fix: Pydantic is already a dependency. Define inbound models for each event and reject invalid payloads with an error event.

- [ ] **P5. Event names are confusing, and some fields are unused.** `logout` means "I'm leaving" from the client and "your partner left" from the server. Naming mixes `userdisconnect` with kebab-case events. `room.active` and `response-message.color` are leftovers that no client reads.
  Fix: rename the server events to `partner-left` with a `reason` (`logout` or `disconnect`), and drop the unused fields.

- [ ] **P6. A dead client is detected slowly.** With the default heartbeat, a partner that dies silently is noticed after about 45 s. Until then a dead socket can hold the waiting slot, and a new visitor is "paired" with nobody before bouncing back to Waiting. If the dead installation comes back sooner, its new socket replaces the old one at once (S8).
  Fix: for two kiosks on a stable network, pass shorter values to `SocketIO(...)`, e.g. `ping_interval=5, ping_timeout=5`.

- [ ] **P7. The client has no offline state.** The `disconnect` handler only reacts when the server closes the socket (S8), not to a lost connection ([sockets.js:36-42](src/web/static/js/sockets.js#L36-L42)). During an outage the chat looks alive. Messages typed then are buffered and sent after reconnect under the new session id, which isn't paired, so the server drops them.
  Fix: show "reconnecting…" and disable the input while disconnected.

- [ ] **A4. Two OpenAI calls per message, one after the other.** The rewrite and the tone choice run in sequence ([main.py:175-196](src/main.py#L175-L196)), which roughly doubles the time a visitor waits.
  Fix: use one structured output with `{message, tone_a, tone_b}`, with the tones typed as a `Literal` of valid names. That halves latency and calls, and fixes A6.

- [ ] **A5. The tone list is defined twice.** The same names and colors live in [config.py:33-69](src/config.py#L33-L69) and [constants.js:7-48](src/web/static/js/constants.js#L7-L48), plus an unused `TONES` list in `config.py`. A change to one has to be copied to the other.
  Fix: keep one source, e.g. render it into the template or serve it as JSON.

- [ ] **A7. Find out whether anything reads the Firestore color.** Every delivered message overwrites `color/color` with the sender's slider color ([`save_color`](src/main.py#L221)), but nothing in this repo reads it back.
  Fix: check whether anything outside the repo does. If nothing does, remove Firebase entirely.

- [ ] **F3. Small fixes.**
  - The slider starts with its labels swapped relative to its colors: "Formal" on the left in Informal's green ([tone.js:5-8](src/web/static/js/tone.js#L5-L8)).
  - `stroke('0015ff')` is missing the `#` ([tone.js:29](src/web/static/js/tone.js#L29)).
  - The slider's tones and position carry over into the next chat.
  - [manifest.json](src/web/static/manifest.json) lists `icons/icon-512x512.png`, which doesn't exist. [index.html:10-11](src/web/templates/index.html#L10-L11) still has placeholder `path/to/your/...` icon links.
  - Dead code: [backend.js](src/web/static/js/backend.js) (empty), `rgbToHsl`, `colorRGB`, `Room`/`User`/`Color.from_json`, `Color.to_hex`, `json_to_dict_convention`.

- [ ] **F6. Reset the ghost timer when going back to waiting.** [`Chat.exit`](src/web/static/js/chat.js#L67) clears the messages but not `count` or `isWaiting`, so a ghost message can fire soon after the next chat starts.
  Fix: reset both to their constructor values there.

- [ ] **F7. Count the refresh timer in seconds, not frames.** `timerToRefresh = 60 * 60` ([main.js:12](src/web/static/js/main.js#L12)) is 3600 frames. That's about a minute at 60 fps, but longer on a slow device.
  Fix: store a deadline based on `millis()` and compare against it, as in F1.

- [ ] **D4. Nothing shows whether the installations are online.** There are no health checks or presence tracking. If a kiosk's browser crashes, nobody finds out until a visitor waits in vain.
  Fix: add a `/health` endpoint, and log or expose how many sockets are connected.

## Dev environment

- [ ] **Make pushing work from inside the dev container.** The remote uses the SSH alias `github.com-personal`, which only exists in `~/.ssh/config` on the host. The SSH agent forwarded into the container also has no keys.
  Fix: run `ssh-add` for the personal key on the host, and create the `github.com-personal` alias in the container from [postCreateCommand.sh](.devcontainer/postCreateCommand.sh) so it survives rebuilds. Until then, push from a terminal on the host.

## Done

- [x] **S1. A visitor's name could run code on the other installation.** The chat header was set with p5's `.html()`, so a name like `<img src=x onerror="…">` ran as script on the partner's installation. The header now uses `textContent` ([chat.js:63](src/web/static/js/chat.js#L63)), the server trims names and cuts them to 40 characters ([main.py:82-83](src/main.py#L82-L83)), and the name input has `maxlength="40"`. The client trims the name too ([loginScene.js:10](src/web/static/js/loginScene.js#L10)), because pairing compares it with the name the server returns. Fixed in `29e0bc0`.
- [x] **S2. Debug mode could expose a Python console.** With `debug=True`, Flask-SocketIO wraps the app in Werkzeug's `DebuggedApplication(evalex=True)` in eventlet mode, which serves a PIN-protected Python console at `/console`. Debug was hard-coded on, and then followed `dever` in config.toml, which the image copies from the local checkout. Now `debug=True` is never passed ([main.py:246-248](src/main.py#L246-L248)), so there's no console in any environment. Development mode (`DEBUG=1`, [config.py:18-20](src/config.py#L18-L20)) turns on only the reloader, request logs and template reloading. The dev container sets it ([devcontainer.json](.devcontainer/devcontainer.json)), and the Docker image and Cloud Run don't, so a deploy needs no config change. The dev server stays reachable from the local network for testing with the installation devices. `/console` returns 404 with and without `DEBUG=1`. Fixed in `37d4748`.
- [x] **S3. The OpenAI key was baked into the Docker image.** The Dockerfile runs `COPY . .` with no `.dockerignore`, so `config.toml`, and the key in it, ended up in an image layer. gcloud also uploaded it to Cloud Build. [.dockerignore](src/.dockerignore) and [.gcloudignore](src/.gcloudignore) now leave out `config.toml`, `.env` and `__pycache__`. The key is read from `OPENAI_API_KEY` ([config.py:11-13](src/config.py#L11-L13)), set on Cloud Run with `--set-secrets=OPENAI_API_KEY=<secret-name>:latest`. config.toml is now optional and only for local development, and is found next to config.py, so the server starts from any directory. Images built before this fix still contain the key. Not committed yet.
- [x] **S8. Anyone with the URL could take an installation's waiting slot.** Pairing was first come, first served, and CORS allowed any origin. Now each installation is set up once as station A or B, with the station key, on a new Setup scene ([setup.js](src/web/static/js/setup.js)). The iPads run the page as a home-screen app, which always opens at `/`, so the choice is kept in `localStorage`, and the page sends it in the Socket.IO handshake ([sockets.js:9-14](src/web/static/js/sockets.js#L9-L14)). [`on_connect`](src/main.py#L46) refuses any socket without a known station and the right `STATION_KEY`, compared in constant time, and a refused page goes back to Setup. Only station A pairs with station B ([main.py:90-92](src/main.py#L90-L92)). When a station connects again, the newest socket wins and the old one is disconnected, so a reconnecting installation replaces its stale socket at once. A replaced page goes to the new Closed scene ([closed.js](src/web/static/js/closed.js)), with buttons to take the station back or change it. It never reloads by itself: otherwise two screens set up as the same station would keep taking the connection from each other. The server doesn't start without `STATION_KEY`. CORS is back to the same-origin default, which also accepts Cloud Run's `https` origin through `X-Forwarded-Proto`. Not committed yet.
- [x] **D3. Configuration leftovers.** `DB_ROOMS`, which nothing used, and the `dever` key it needed are gone. The key is spelled `OPENAI_API_KEY` / `openai_api_key` now. Not committed yet.
- [x] **A1. The Firestore write blocked the server and held up delivery.** It was a synchronous gRPC call on eventlet's main thread, made before the emit. With expired credentials it froze the server for up to 60 s, long enough for both clients to time out and reconnect. Fixed in `3e9c18f`: [`save_color`](src/main.py#L221) runs after the emit, in `tpool`, with a 5 s timeout and no retry, and only logs a failure.
- [x] **F2. The Home button's hit box was off-center.** It tested `x..x+w`, while the button is drawn centered on `x` (`rectMode(CENTER)`), so only its lower-right quarter responded. `BubbleM.isHovered()` ([home.js:146](src/web/static/js/home.js#L146)) now tests `x ± w/2`, `y ± h/2`. Hovering still opens Login once the text is in focus, on purpose. Not committed yet. Before that, `fb1c62f` removed the hidden "In between us." logo: its "no bubble covers the logo" check measured a 0×0 box at the top-left corner, so the button only worked while no bubble was there.

Fixed in `adf4272` (fix matching):

- [x] The partner check on disconnect and logout picked the leaving user, so the partner was never removed from the room.
- [x] The room lookup ignored whether rooms were active. After one rematch, a client's messages were silently dropped.
- [x] Waiting rooms were left behind pointing at closed connections, which split the two installations.
- [x] Login added the new user to every incomplete room (`continue` instead of `break`).
- [x] After an automatic reconnect, the client stayed on a dead chat screen.
- [x] Matching wasn't atomic: it read, then wrote, with no transaction.
- [x] One slow OpenAI call froze the whole server. Calls now run in a thread pool with a 20 s timeout.
