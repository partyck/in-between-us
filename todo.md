# To do

Problems found while reviewing the session flow. The pairing and reconnect fixes are done (see the end of this file). The rest are still open, most important first.

## High

- [ ] **Only pair the two installations.** Anyone who opens the URL can take an installation's waiting slot: a phone with the link, a second browser tab, or a developer's machine. Pairing is first come, first served in [`on_login`](src/main.py#L48), and CORS allows any origin ([main.py:22](src/main.py#L22)).
  Fix: give each installation a station name and a shared secret (e.g. `/?station=A&key=…`). The server then only pairs station A with station B and rejects every other login.

- [ ] **Stop using the display name as identity.** Each client decides whether a message is its own by comparing names ([chat.js:32-35](src/web/static/js/chat.js#L32-L35), [waiting.js:22](src/web/static/js/waiting.js#L22)). If both visitors type the same name, each client shows the partner's messages as its own, and the ghost-message timers get mixed up.
  Fix: have the server include a sender id (session id or station) in `room` and `response-message`, and compare that instead.

- [ ] **Check that the server runs as a single instance.** Pairing state is in memory, so a second instance has its own waiting slot and can leave the two installations unable to reach each other (see the README).
  Fix: if the host autoscales, set max instances to 1.

## Medium

- [ ] **End chats that nobody is using.** Ghost messages ([chat.js:108-115](src/web/static/js/chat.js#L108-L115)) reply to each other. If both visitors walk away, the installations keep an AI-to-AI conversation going indefinitely, at about 4 GPT-4o calls a minute. The chat screen has no idle timeout (its [`draw`](src/web/static/js/chat.js#L72-L82) never calls `updateTimer()`), so the next visitor walks up to the previous conversation.
  Fix (unless this is intended): stop after a few ghost messages in a row, or send both installations back to the home screen after a few minutes without a real message.

- [ ] **Include the partner's last message in ghost replies.** `messageHistory` uses `slice(-10, -1)` ([chat.js:27](src/web/static/js/chat.js#L27)), which drops the newest message. That's right for a normal send, where the newest message is the visitor's own prompt. For a ghost message, the newest message is the partner's, which is the one it should be replying to.
  Fix: use `slice(-10)` when building the history for `send-ghost-message`.

- [ ] **Restrict the tone names OpenAI can return.** `ToneResponse.tone_a` and `tone_b` are plain `str` ([models.py:82-84](src/models.py#L82-L84)). A reply like `"friendly"`, or a tone that isn't in the list, raises a `KeyError` at [main.py:164](src/main.py#L164). The message is never delivered and the sender's bubble keeps its waiting animation.
  Fix: type both fields as a `Literal` or `Enum` built from the tone list, so structured outputs can only return valid names.

- [ ] **Decide what the partner sees when a chat ends.** Pressing X sends the partner to the home screen (`logout`), while a dropped connection sends them to the waiting screen (`userdisconnect`). The X button also calls `location.reload()` straight after `socketService.logout()` ([chat.js:12-13](src/web/static/js/chat.js#L12-L13)). The page can unload before `logout` is sent, and the partner then gets the waiting-screen behaviour.
  Fix: pick one behaviour on purpose. If X should keep sending the partner home, reload only once the server has acknowledged `logout` (a Socket.IO emit callback).

- [ ] **Turn off debug mode in production.** `socketio.run(..., debug=True, host="0.0.0.0")` ([main.py:196](src/main.py#L196)) runs the reloader. In eventlet mode it also wraps the app in Werkzeug's interactive debugger.
  Fix: read the debug flag from an environment variable and leave it off in the Docker image.

## Low

- [ ] **Reset the ghost timer when going back to waiting.** [`Chat.exit`](src/web/static/js/chat.js#L67) clears the messages but not `count` or `isWaiting`, so a ghost message can fire soon after the next chat starts.
  Fix: reset both to their constructor values there.

- [ ] **Count the refresh timer in seconds, not frames.** `timerToRefresh = 60 * 60` ([main.js:11](src/web/static/js/main.js#L11)) is 3600 frames. That's about a minute at 60 fps, but longer on a slow device.
  Fix: store a deadline based on `millis()` and compare against it.

## Dev environment

- [ ] **Make pushing work from inside the dev container.** The remote uses the SSH alias `github.com-personal`, which only exists in `~/.ssh/config` on the host. The SSH agent forwarded into the container also has no keys.
  Fix: run `ssh-add` for the personal key on the host, and create the `github.com-personal` alias in the container from [postCreateCommand.sh](.devcontainer/postCreateCommand.sh) so it survives rebuilds. Until then, push from a terminal on the host.

## Done

Fixed in `adf4272` (fix matching):

- [x] The partner check on disconnect and logout picked the leaving user, so the partner was never removed from the room.
- [x] The room lookup ignored whether rooms were active. After one rematch, a client's messages were silently dropped.
- [x] Waiting rooms were left behind pointing at closed connections, which split the two installations.
- [x] Login added the new user to every incomplete room (`continue` instead of `break`).
- [x] After an automatic reconnect, the client stayed on a dead chat screen.
- [x] Matching wasn't atomic: it read, then wrote, with no transaction.
- [x] One slow OpenAI call froze the whole server. Calls now run in a thread pool with a 20 s timeout.
