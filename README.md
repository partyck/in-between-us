# In Between us.

A chat between two installations. Each visitor types a name and is paired with whoever is waiting at the other installation. The server rewrites every message with OpenAI, in the tone chosen on the slider.

## Session flow

The client moves through four scenes ([scene.js](src/web/static/js/scene.js), switched by `changeScene` in [main.js](src/web/static/js/main.js)): Home → Login → Waiting → Chat.

1. **Login.** The visitor enters a name. The client emits `login` and shows the waiting screen.
2. **Pairing.** The server keeps a single waiting slot. If it's empty, the new user takes it. If someone is already waiting, the two are paired and put in a Socket.IO room, and both receive `room`.
3. **Chat.** `send-message` goes through OpenAI and comes back to both clients as `response-message`. If a visitor doesn't reply within 30–45 s of the partner's message, the client sends `send-ghost-message` and the server writes a reply on their behalf.
4. **Ending.**
   - **X button:** the client emits `logout`. The partner receives `logout` and reloads to the home screen.
   - **Page closed or connection lost:** the partner receives `userdisconnect`, returns to the waiting screen and logs in again.
   - **Client dies without closing (e.g. power loss):** the server only notices after the Socket.IO heartbeat times out, about 45 s later. The partner is then handled as above.
   - **Reconnect:** a client that reconnects gets a new session id, which the server doesn't know. It returns to the waiting screen and logs in again.
   - **Idle timeout:** a client left on the login or waiting screen reloads to the home screen after 3600 frames (about a minute at 60 fps).

## Socket events

| Direction | Event | Meaning |
| --- | --- | --- |
| client → server | `login` | `{userName}`: take the waiting slot, or pair with whoever holds it |
| client → server | `logout` | End the chat. The partner receives `logout` |
| client → server | `send-message` | The visitor's message, the tone slider and recent history |
| client → server | `send-ghost-message` | The tone slider and recent history |
| server → client | `room` | `{userA, userB}`: the two users are paired |
| server → client | `response-message` | The rewritten message, the next pair of tones and the color |
| server → client | `userdisconnect` | The partner left. Go back to waiting |
| server → client | `logout` | The partner pressed X. Reload |

## Server notes

- **Pairing state lives in memory** (`waiting_user`, `partners` and `rooms` in [main.py](src/main.py)). With only two installations there's nothing to share, and a restart just clears the state; clients log in again when they reconnect. Firestore only stores the current `color` document.
- **Run exactly one server process and one instance.** A second instance keeps its own pairing state and can leave the two installations unable to reach each other. If the host autoscales (e.g. Cloud Run), set max instances to 1.
- **OpenAI and Firestore calls run in `eventlet.tpool`.** The server runs in eventlet mode without monkey-patching, so a blocking call on the main thread would freeze every client. Don't add `eventlet.monkey_patch()`: it's known to break the gRPC library Firestore uses. OpenAI calls time out after 20 s and retry once. The Firestore color write happens after the message is sent, times out after 5 s with no retry, and a failure is only logged.
- A reply is dropped if the sender is no longer paired, or is paired with someone else, by the time OpenAI answers.

## Known limitations

- Anyone who opens the URL can be paired, not only the two installations.
- Each client identifies its own messages by display name, so two visitors with the same name confuse the chat.
