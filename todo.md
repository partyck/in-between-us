# To do

Open problems from the session flow review, the architecture review ([architecture.md](architecture.md)) and a test of the server with OpenAI and Firestore faked, most important first. Fixed items are at the end.

Each item has an ID that stays the same when it moves: **S** security, **P** sockets and protocol, **A** server architecture, **F** frontend, **D** deployment and operations.

- **High:** security or cost exposure, or visitors see something broken in normal use.
- **Medium:** breaks in specific but realistic situations.
- **Low:** cleanup, or only matters later.

## Where to start

1. **A3, server-side history with message ids.** One change that fixes P2, P3, P8, P10, S5 and F5.
2. **P1, an error path.** Visitors stop seeing messages that never arrive.

## High

- [ ] **P1. A failed message spins forever.** There's no error path. If OpenAI times out, refuses (`parsed` is `None`), hits the output cap or returns an unknown tone (A6), if the payload is malformed, or if the server drops the message for its size or rate (S4), the handler simply ends ([main.py:241-278](src/main.py#L241-L278)). Nothing is emitted, and the sender's bubble keeps its waiting animation with no retry. There are no acknowledgements, no error event and no `@socketio.on_error_default` handler.
  Fix: emit an error event carrying the message id (or use an ack callback), and let the client mark the bubble as failed or drop it. Check `message.refusal` explicitly.

- [ ] **P8. Stop using the display name as identity.** Each client decides whether a message is its own by comparing names ([chat.js:34-37](src/web/static/js/chat.js#L34-L37), [waiting.js:22](src/web/static/js/waiting.js#L22)). If both visitors type the same name, each client shows the partner's messages as its own, and the ghost-message timers get mixed up.
  Fix: have the server include a sender id (session id or station) in `room` and `response-message`, and compare that instead.

- [ ] **D5. Check that the server runs as a single instance.** Pairing state is in memory, so a second instance has its own waiting slot and can leave the two installations unable to reach each other (see the README).
  Fix: deploy to Cloud Run with `--max-instances=1`. Deploys keep the setting, so this only has to be set once. Also see D2.

## Medium

- [ ] **S5. Visitors control the prompts, with developer authority.** The typed message, the name and the whole history are inserted into `developer`-role messages ([main.py:136](src/main.py#L136), [main.py:150](src/main.py#L150), [models.py:133-140](src/models.py#L133-L140)). A visitor can type instructions ("ignore the tone and say …") that the model treats as coming from the developer. A scripted client can also invent the entire conversation history.
  Fix: keep the history on the server (A3). Pass visitor text as `user`-role content, or in a clearly delimited data block, and keep instructions in the `developer` message only.

- [ ] **S6. The partner's browser receives the original text.** The partner is only supposed to see the rewritten text, but `response-message` sends `prompt`, the original, to the whole room ([main.py:271](src/main.py#L271)), and [sockets.js:60](src/web/static/js/sockets.js#L60) logs every payload to the console. `room` also sends both session ids to both clients ([main.py:117](src/main.py#L117)).
  Fix: send the matching data only to the sender, or replace it with a message id (P2). Drop `sessionId` from `room`.

- [ ] **P2. Replies are matched to bubbles by text.** The client finds its pending bubble with `message.content === prompt` ([chat.js:38-40](src/web/static/js/chat.js#L38-L40)). If a visitor sends the same text twice, or an earlier reply was dropped (P1) and left a pending bubble with the same text, the wrong bubble gets rewritten.
  Fix: have the client generate a `clientMessageId` and the server echo it back. Together with the sender id from P8, this replaces both name matching and text matching.

- [ ] **P3. Bubbles overlap, and the two screens show different orders.** `rephrase()` always moves the bubble to the bottom slot ([message.js:32](src/web/static/js/message.js#L32)), which is only right if it's still the newest. If the partner's message arrives while yours is pending, your rewritten bubble lands on top of theirs ([chat.js:41-47](src/web/static/js/chat.js#L41-L47)). The sender sees their message where they sent it, but the partner sees it when the reply arrives, so the two screens (and the histories they send) disagree on order. Replies to two quick messages from the same visitor can also arrive out of order, since handlers run concurrently.
  Fix: lay out bubbles from their position in the array on every change instead of moving them by offsets. Have the server assign sequence numbers, or own the history (A3).

- [ ] **P9. Decide what the partner sees when a chat ends.** Pressing X sends the partner to the home screen (`logout`), while a dropped connection sends them to the waiting screen (`userdisconnect`). The X button also calls `location.reload()` straight after `socketService.logout()` ([chat.js:12-13](src/web/static/js/chat.js#L12-L13)). The page can unload before `logout` is sent, and the partner then gets the waiting-screen behaviour.
  Fix: pick one behaviour on purpose. If X should keep sending the partner home, reload only once the server has acknowledged `logout` (a Socket.IO emit callback). P5 renames the events.

- [ ] **A2. Eventlet adds risk that two clients don't need.** Running without monkey-patching means every blocking call has to remember `tpool` (A1 was one that didn't), and `pairing_lock` would deadlock the whole server if anything inside it ever yielded. Eventlet is in maintenance mode, and its maintainers discourage new use.
  Fix: with two clients, `async_mode="threading"` (with `simple-websocket`, and e.g. gunicorn `-w 1 --threads 50`) removes the need for `tpool`, and makes the lock an ordinary lock.

- [ ] **A3. The server keeps no conversation state.** Each client keeps its own message list and sends it with every event. That single choice causes the ghost-history off-by-one (F5) and the name-based identity problems (P8, P10), as well as S5 and P3. It would also make S4's history limits unnecessary. The server already knows each room, so it can keep the last N messages per room in memory, next to the pairing state.
  Fix: store `{id, sender, text}` per room on the server, build prompts from it, and have clients send only `{clientMessageId, text, tone}`. This is the change that fixes the most problems at once.

- [ ] **A6. Restrict the tone names OpenAI can return.** `ToneResponse.tone_a` and `tone_b` are plain `str` ([models.py:84-86](src/models.py#L84-L86)). A reply like `"friendly"`, or a tone that isn't in the list, raises a `KeyError` at [main.py:264](src/main.py#L264). The message is never delivered and the sender's bubble keeps its waiting animation (P1).
  Fix: type both fields as a `Literal` or `Enum` built from the tone list, so structured outputs can only return valid names. A4 does this as part of merging the two calls.

- [ ] **F4. End chats that nobody is using.** Ghost messages ([chat.js:112-121](src/web/static/js/chat.js#L112-L121)) reply to each other. If both visitors walk away, the installations keep an AI-to-AI conversation going indefinitely, at about 4 OpenAI calls a minute. The chat screen has no idle timeout (its [`draw`](src/web/static/js/chat.js#L76-L86) never calls `updateTimer()`), so the next visitor walks up to the previous conversation.
  Fix (unless this is intended): stop after a few ghost messages in a row, or send both installations back to the home screen after a few minutes without a real message.

- [ ] **F5. Include the partner's last message in ghost replies.** `messageHistory` uses `slice(-10, -1)` ([chat.js:29](src/web/static/js/chat.js#L29)), which drops the newest message. That's right for a normal send, where the newest message is the visitor's own prompt. For a ghost message, the newest message is the partner's, which is the one it should be replying to.
  Fix: use `slice(-10)` when building the history for `send-ghost-message`.

- [ ] **D1. The production image is the dev container image.** [src/Dockerfile](src/Dockerfile) builds on `mcr.microsoft.com/devcontainers/python`, which is large, full of dev tooling, and runs as root. [requirements.txt](src/requirements.txt) installs packages nothing imports (`opencv-python`, `numpy`, `GitPython`, `google-api-python-client`, `google-cloud-storage`) and pins 2023-era Flask, Werkzeug and cryptography versions that have published advisories.
  Fix: build on `python:3.11-slim` with a non-root `USER`, trim the requirements to what's imported, and run `pip-audit`.

- [ ] **D2. Chats are cut off at Cloud Run's request timeout.** Cloud Run closes WebSocket connections at the service's request timeout (5 minutes by default). The socket is opened at page load, so a chat that crosses that point reconnects: both sides return to Waiting and the conversation is cleared.
  Fix: deploy with `--timeout=3600`, the maximum (60 minutes), alongside `--max-instances=1` (D5).

## Low

- [ ] **S7. Visitors' messages are logged and stored.** Messages are printed to stdout ([main.py:132](src/main.py#L132), [146](src/main.py#L146), [263](src/main.py#L263)) and stored by OpenAI (`store=True`, [main.py:299](src/main.py#L299)). Visitors at a public installation aren't told.
  Fix: make a deliberate decision. Turn off `store` unless the stored completions are actually used, and log metadata rather than text.

- [ ] **S9. Add a Content-Security-Policy.** S1 was fixed where it happened, but nothing stops a later `.html()` call with visitor text from running code again. All the page's scripts are same-origin files with no inline code ([index.html:86-103](src/web/templates/index.html#L86-L103)), so a `script-src 'self'` policy should fit.
  Fix: send a `Content-Security-Policy` header from Flask, and check that p5.sound still plays, since it may load its audio worklet from a `blob:` URL.

- [ ] **S10. An error in `on_connect` leaves the socket connected.** [`is_station_key`](src/main.py#L164-L166) calls `key.encode()`, which raises if the key holds a lone UTF-16 surrogate (`"\ud800"` in the handshake's JSON). When `on_connect` raises instead of returning `False`, python-socketio 5.7 sends no reply, but keeps the socket registered and passes its events to the handlers. The test confirmed it: a `login` from such a socket reached `on_login`. Nothing happens today, because every handler stops when the socket isn't in `stations` ([main.py:98-100](src/main.py#L98-L100)) or `rooms` ([main.py:229-231](src/main.py#L229-L231)). Those dicts are the real gate, not the handshake. A future handler that skips the check, like P1's error event or D4's health data, would be reachable without the key. An installation that hits any exception in `on_connect` gets neither `connect` nor `connect_error`, so it can't pair and doesn't show Setup either.
  Fix: catch exceptions in `on_connect` and return `False`, so a check that fails refuses the socket. Add a small decorator that ignores events from sockets that aren't in `stations`, so the gate doesn't depend on each handler remembering it.

- [ ] **S11. Anyone with the station key can take over a station mid-chat.** Both stations share one key, and the newest socket for a station wins (S8). Someone with the key can connect as A, which sends the A installation to Closed and B's visitor back to Waiting, then log in and chat with B's visitor. To B's visitor that looks like an ordinary new partner.
  Fix: decide whether this is acceptable. A key for each station would limit a leaked key to one station, and logging each replaced socket (with D4) would show when it happens. Rotate the key if it may have leaked ([deployment.md](deployment.md#rotating-the-station-key)).

- [ ] **P4. Payloads aren't validated.** `MessageInput.from_json` indexes the raw dict ([models.py:151-171](src/models.py#L151-L171)), so a missing field raises `KeyError` inside the handler. `login` is the exception: since S1 it falls back to an empty name.
  Fix: Pydantic is already a dependency. Define inbound models for each event and reject invalid payloads with an error event.

- [ ] **P5. Event names are confusing, and some fields are unused.** `logout` means "I'm leaving" from the client and "your partner left" from the server. Naming mixes `userdisconnect` with kebab-case events. `room.active` and `response-message.color` are leftovers that no client reads.
  Fix: rename the server events to `partner-left` with a `reason` (`logout` or `disconnect`), and drop the unused fields.

- [ ] **P6. A dead client is detected slowly.** With the default heartbeat, a partner that dies silently is noticed after about 45 s. Until then a dead socket can hold the waiting slot, and a new visitor is "paired" with nobody before bouncing back to Waiting. If the dead installation comes back sooner, its new socket replaces the old one at once (S8).
  Fix: for two kiosks on a stable network, pass shorter values to `SocketIO(...)`, e.g. `ping_interval=5, ping_timeout=5`.

- [ ] **P7. The client has no offline state.** The `disconnect` handler only reacts when the server closes the socket (S8), not to a lost connection ([sockets.js:36-42](src/web/static/js/sockets.js#L36-L42)). During an outage the chat looks alive. Messages typed then are buffered and sent after reconnect under the new session id, which isn't paired, so the server drops them.
  Fix: show "reconnecting…" and disable the input while disconnected.

- [ ] **P10. The server takes the sender's name from each message.** `login` trims the name and cuts it to 40 characters, but `send-message` and `send-ghost-message` use the `userName` in their own payload, both in the prompt ([main.py:136](src/main.py#L136)) and in `response-message` ([main.py:270](src/main.py#L270)). In the test, A sent a message as "Ben", B's name, and B received it under that name, so B's screen would show it as B's own message (P8). Since S4's size limits the name is cut to 40 characters ([main.py:189](src/main.py#L189)), but what it says is still up to the client. It takes the station key, so this is about buggy or modified clients, not visitors.
  Fix: keep each session's `User` from `login` on the server and use its name. A3 does this as part of its change, and it fits with P8.

- [ ] **A4. Two OpenAI calls per message, one after the other.** The rewrite and the tone choice run in sequence ([main.py:233-256](src/main.py#L233-L256)), which roughly doubles the time a visitor waits.
  Fix: use one structured output with `{message, tone_a, tone_b}`, with the tones typed as a `Literal` of valid names. That halves latency and calls, and fixes A6.

- [ ] **A5. The tone list is defined twice.** The same names and colors live in [config.py:34-70](src/config.py#L34-L70) and [constants.js:7-48](src/web/static/js/constants.js#L7-L48), plus an unused `TONES` list in `config.py`. A change to one has to be copied to the other.
  Fix: keep one source, e.g. render it into the template or serve it as JSON.

- [ ] **A7. Find out whether anything reads the Firestore color.** Every delivered message overwrites `color/color` with the sender's slider color ([`save_color`](src/main.py#L281)), but nothing in this repo reads it back.
  Fix: check whether anything outside the repo does. If nothing does, remove Firebase entirely.

- [ ] **A8. The conversation history in the prompts is malformed.** [`message_history_prompt`](src/models.py#L133-L140) writes each entry as `Ben": "hi"`, with no quote before the name ([models.py:136](src/models.py#L136)). A quote typed in a message also breaks the format.
  Fix: JSON-encode the history (`json.dumps` of the `{name, content}` list). That fixes both, and makes it a little harder for a message to pass as instructions (S5).

- [ ] **F3. Small fixes.**
  - The slider starts with its labels swapped relative to its colors: "Formal" on the left in Informal's green ([tone.js:5-8](src/web/static/js/tone.js#L5-L8)).
  - `stroke('0015ff')` is missing the `#` ([tone.js:29](src/web/static/js/tone.js#L29)).
  - The slider's tones and position carry over into the next chat.
  - [manifest.json](src/web/static/manifest.json) lists `icons/icon-512x512.png`, which doesn't exist. [index.html:10-11](src/web/templates/index.html#L10-L11) still has placeholder `path/to/your/...` icon links.
  - Dead code: [backend.js](src/web/static/js/backend.js) (empty), `rgbToHsl`, `colorRGB`, `Room`/`User`/`Color.from_json`, `Color.to_hex`, `json_to_dict_convention`.

- [ ] **F6. Reset the ghost timer's state for each chat.** Since F1, [`Chat.enter`](src/web/static/js/chat.js#L63-L69) restarts the clock, but [`Chat.exit`](src/web/static/js/chat.js#L71-L74) still keeps `isWaiting`. If the visitor sent the last message of the previous chat, it stays `false`, and the next chat sends no ghost message until the partner writes. On the first chat after a page load it starts `true` ([chat.js:19](src/web/static/js/chat.js#L19)), so both sides send a ghost message after 30–45 s if nobody types. The 30–45 s delay is also chosen once per page load ([chat.js:23](src/web/static/js/chat.js#L23)), not once per wait.
  Fix: set `isWaiting` back to `true` when a chat starts, and pick a new random delay each time the timer starts.

- [ ] **F8. Sending a message doesn't stop the ghost timer.** [`newMessage`](src/web/static/js/chat.js#L88-L98) restarts the timer's clock but leaves `isWaiting` as it is. `isWaiting` only turns `false` when the rewritten message comes back ([chat.js:34](src/web/static/js/chat.js#L34)). If the partner spoke last and the visitor replies, the timer keeps running while OpenAI rewrites the reply. If that takes 30–45 s, or the reply never comes (P1), a ghost message goes out for a visitor who has already written.
  Fix: set `isWaiting = false` in `newMessage`. Do it together with F6, which sets the timer's state when a chat starts.

- [ ] **F7. Count the refresh timer in seconds, not frames.** `timerToRefresh = 60 * 60` ([main.js:13](src/web/static/js/main.js#L13)) is 3600 frames. That's about a minute at 60 fps, but longer on a slow device.
  Fix: store a deadline and compare the clock against it, as the ghost timer does since F1.

- [ ] **D4. Nothing shows whether the installations are online.** There are no health checks or presence tracking. If a kiosk's browser crashes, nobody finds out until a visitor waits in vain.
  Fix: add a `/health` endpoint, and log or expose how many sockets are connected.

- [ ] **D6. Open connections can use up the server's request slots.** By default Cloud Run sends an instance at most 80 requests at a time, and with `--max-instances=1` there's only one instance. Each WebSocket holds a slot for as long as it's open, and the connection is accepted before the station key is checked. So anyone with the URL could open enough connections to keep the installations out.
  Fix: add `--concurrency=1000`, Cloud Run's maximum, to the deploy command and the flag table in [deployment.md](deployment.md#deploy). That raises the bar a long way, but doesn't remove it.

## Dev environment

- [ ] **Make pushing work from inside the dev container.** The remote uses the SSH alias `github.com-personal`, which only exists in `~/.ssh/config` on the host. The SSH agent forwarded into the container also has no keys.
  Fix: run `ssh-add` for the personal key on the host, and create the `github.com-personal` alias in the container from [postCreateCommand.sh](.devcontainer/postCreateCommand.sh) so it survives rebuilds. Until then, push from a terminal on the host.

## Done

- [x] **S1. A visitor's name could run code on the other installation.** The chat header was set with p5's `.html()`, so a name like `<img src=x onerror="…">` ran as script on the partner's installation. The header now uses `textContent` ([chat.js:65](src/web/static/js/chat.js#L65)), the server trims names and cuts them to 40 characters ([main.py:96-97](src/main.py#L96-L97)), and the name input has `maxlength="40"`. The client trims the name too ([loginScene.js:10](src/web/static/js/loginScene.js#L10)), because pairing compares it with the name the server returns. Fixed in `29e0bc0`.
- [x] **S2. Debug mode could expose a Python console.** With `debug=True`, Flask-SocketIO wraps the app in Werkzeug's `DebuggedApplication(evalex=True)` in eventlet mode, which serves a PIN-protected Python console at `/console`. Debug was hard-coded on, and then followed `dever` in config.toml, which the image copies from the local checkout. Now `debug=True` is never passed ([main.py:313-315](src/main.py#L313-L315)), so there's no console in any environment. Development mode (`DEBUG=1`, [config.py:19-21](src/config.py#L19-L21)) turns on only the reloader, request logs and template reloading. The dev container sets it ([devcontainer.json](.devcontainer/devcontainer.json)), and the Docker image and Cloud Run don't, so a deploy needs no config change. The dev server stays reachable from the local network for testing with the installation devices. `/console` returns 404 with and without `DEBUG=1`. Fixed in `37d4748`.
- [x] **S3. The OpenAI key was baked into the Docker image.** The Dockerfile runs `COPY . .` with no `.dockerignore`, so `config.toml`, and the key in it, ended up in an image layer. gcloud also uploaded it to Cloud Build. [.dockerignore](src/.dockerignore) and [.gcloudignore](src/.gcloudignore) now leave out `config.toml`, `.env` and `__pycache__`. The key is read from `OPENAI_API_KEY` ([config.py:11-13](src/config.py#L11-L13)), set on Cloud Run with `--set-secrets=OPENAI_API_KEY=<secret-name>:latest`. config.toml is now optional and only for local development, and is found next to config.py, so the server starts from any directory. Images built before this fix still contain the key. Fixed in `48cd515`.
- [x] **S4. OpenAI spend had no limit.** Every `send-message` or `send-ghost-message` costs two OpenAI calls, and the server limited neither their size nor how often they came. With the station key, a script could pair A and B and loop `send-ghost-message` with a large fake history. Now [`read_message`](src/main.py#L169-L194) checks every message before OpenAI sees it, and each call's output is capped:
  - **Rate.** Each station can send 20 messages a minute ([`within_rate_limit`](src/main.py#L197-L206)). More are dropped. The count is per station, not per socket, so reconnecting doesn't reset it. A visitor typing fast, plus ghost messages, stays well under it. Both stations together can cause at most 80 OpenAI calls a minute.
  - **Size.** A message over 500 characters is dropped, and so is one whose tone names aren't in the tone table, since either would put free text in the prompt. The chat input's `maxlength` comes from the same constant, so the iPads never send one. The sender's name is cut to 40 characters, and only the last 10 history entries are kept, each cut to 1000 characters. Before, a single history entry could be close to 1 MB, Socket.IO's payload limit.
  - **Output.** Each call sets `max_completion_tokens` to 4000 ([`parse_completion`](src/main.py#L291-L308)). `gpt-6.1-sol` always reasons, and reasoning counts against the cap, so it's set well above what a rewrite needs. A reply that hits it is dropped and logged. Without a cap, a reply could run to 128K tokens.
  - When the rewrite comes back empty, the tone call is skipped.
  One request in flight per session was left out on purpose: it would drop a visitor's quick second message, which would then spin forever (P1). The real cap on total spend is the OpenAI project's budget limit ([deployment.md](deployment.md#one-time-setup)), which was set on 2026-10-08. Not committed yet.
- [x] **S8. Anyone with the URL could take an installation's waiting slot.** Pairing was first come, first served, and CORS allowed any origin. Now each installation is set up once as station A or B, with the station key, on a new Setup scene ([setup.js](src/web/static/js/setup.js)). The iPads run the page as a home-screen app, which always opens at `/`, so the choice is kept in `localStorage`, and the page sends it in the Socket.IO handshake ([sockets.js:9-14](src/web/static/js/sockets.js#L9-L14)). [`on_connect`](src/main.py#L60) refuses any socket without a known station and the right `STATION_KEY`, compared in constant time, and a refused page goes back to Setup. Only station A pairs with station B ([main.py:104-106](src/main.py#L104-L106)). When a station connects again, the newest socket wins and the old one is disconnected, so a reconnecting installation replaces its stale socket at once. A replaced page goes to the new Closed scene ([closed.js](src/web/static/js/closed.js)), with buttons to take the station back or change it. It never reloads by itself: otherwise two screens set up as the same station would keep taking the connection from each other. The server doesn't start without `STATION_KEY`. CORS is back to the same-origin default, which also accepts Cloud Run's `https` origin through `X-Forwarded-Proto`. Fixed in `437127f` (client) and `a1b2455` (server).
- [x] **D3. Configuration leftovers.** `DB_ROOMS`, which nothing used, and the `dever` key it needed are gone. The key is spelled `OPENAI_API_KEY` / `openai_api_key` now. Fixed in `48cd515`. A local `config.toml` may still have a `dever` line, which nothing reads.
- [x] **A1. The Firestore write blocked the server and held up delivery.** It was a synchronous gRPC call on eventlet's main thread, made before the emit. With expired credentials it froze the server for up to 60 s, long enough for both clients to time out and reconnect. Fixed in `3e9c18f`: [`save_color`](src/main.py#L281) runs after the emit, in `tpool`, with a 5 s timeout and no retry, and only logs a failure.
- [x] **F2. The Home button's hit box was off-center.** It tested `x..x+w`, while the button is drawn centered on `x` (`rectMode(CENTER)`), so only its lower-right quarter responded. `BubbleM.isHovered()` ([home.js:260-265](src/web/static/js/home.js#L260-L265)) now tests `x ± w/2`, `y ± h/2`. Hovering still works once the text is in focus, on purpose: since `13de701` it sends the other bubbles off screen, and Login opens once they're gone. Fixed in `2aa1e92`. Before that, `fb1c62f` removed the hidden "In between us." logo: its "no bubble covers the logo" check measured a 0×0 box at the top-left corner, so the button only worked while no bubble was there.
- [x] **F1. The ghost timer could fire early.** It compared a frame count against `this.waiting * frameRate()`, and `frameRate()` is the rate of the last frame only. At frame 1000 (about 17 s at 60 fps), a single frame at 20 fps lowered the threshold to 600, and the ghost message fired at 17 s instead of 30–45 s. [`Chat.ghostMessage`](src/web/static/js/chat.js#L112-L121) now measures the silence with `performance.now()`, written so that a `NaN` waits instead of sending, and `Chat.enter` restarts it for each new partner. Fixed in `93fb279`. Picking a new delay for each wait is still open, in F6.

Fixed in `bd03d89` and `93fb279` (fix frozen ipad):

- [x] The Home scene froze half-drawn when the home-screen app opened on the iPads, with no error in the console. Once Safari's JavaScript engine had optimised `repelFromPointer`, which used p5's `dist`, `atan2`, `map`, `cos` and `sin`, it returned `NaN` for every bubble it pushed, from ordinary inputs. A bubble at `NaN` made `createRadialGradient` throw, and p5 stops drawing for good after an error in `draw()`. The maths that runs every frame in [home.js](src/web/static/js/home.js) now uses plain `Math`, including `Bubble.move()`, which used `random` and `constrain`. A comment at the top of the file says why.

Fixed in `adf4272` (fix matching):

- [x] The partner check on disconnect and logout picked the leaving user, so the partner was never removed from the room.
- [x] The room lookup ignored whether rooms were active. After one rematch, a client's messages were silently dropped.
- [x] Waiting rooms were left behind pointing at closed connections, which split the two installations.
- [x] Login added the new user to every incomplete room (`continue` instead of `break`).
- [x] After an automatic reconnect, the client stayed on a dead chat screen.
- [x] Matching wasn't atomic: it read, then wrote, with no transaction.
- [x] One slow OpenAI call froze the whole server. Calls now run in a thread pool with a 20 s timeout.
