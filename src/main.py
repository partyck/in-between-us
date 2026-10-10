import hmac
import os
import random
import threading
import time
import traceback
import uuid
from collections import deque
from typing import Optional

from firebase_admin import firestore, initialize_app
from flask import Flask, render_template, request
from flask_socketio import SocketIO, disconnect, join_room, leave_room
from openai import LengthFinishReasonError, OpenAI

from config import DEBUG, OPENAI_API_KEY, STATION_KEY, STATIONS, TONE_PAIR_OF, TONE_PAIRS, TONES_BY_NAME
from models import MessageInput, Room, User, message_response_format

if not STATION_KEY:
    raise RuntimeError("STATION_KEY is not set, so no installation could connect. See deployment.md.")

# DB initialize
initialize_app()
db = firestore.client()

app = Flask(__name__, static_url_path="", static_folder="web/static", template_folder="web/templates")
app.config["TEMPLATES_AUTO_RELOAD"] = DEBUG


# Without cors_allowed_origins, only pages served by this server can open a socket.
# Threading mode runs every connection and every event in a real thread, so a blocking OpenAI or Firestore call only
# holds up its own handler. Eventlet would need monkey-patching for that, which breaks Firestore's gRPC library (A2).
socketio = SocketIO(app, async_mode="threading")
client = OpenAI(api_key=OPENAI_API_KEY, timeout=20, max_retries=1)

# PAIRING
# Only the two installations talk to each other, so pairing lives in memory instead of the DB.
# A restart drops every pairing, and the clients log in again when they reconnect.
pairing_lock = threading.Lock()
waiting_user: Optional[User] = None
partners: dict[str, User] = {}  # session id -> the user they are talking to
rooms: dict[str, str] = {}  # session id -> room id
stations: dict[str, str] = {}  # session id -> station
station_sessions: dict[str, str] = {}  # station -> session id of the socket that holds it
room_tones: dict[str, str] = {}  # room id -> the tone pair both sliders show since the room's last reply

MAX_NAME_LENGTH = 40  # also the name input's maxlength, through route_home
MAX_MESSAGE_LENGTH = 500  # also the chat input's maxlength, through route_home
# Everything the client sends ends up in the OpenAI prompt, so these bound what one message can cost (S4). The client
# sends at most the last 9 messages. History entries are mostly rewrites, which can come out longer than what was typed.
MAX_HISTORY_ITEMS = 10
MAX_HISTORY_ITEM_LENGTH = 1000
# A visitor typing fast, plus ghost messages, stays well under this, so it only stops a looping script or a client bug.
# It counts per station rather than per socket, so reconnecting doesn't reset it.
MAX_REQUESTS_PER_MINUTE = 20
request_times: dict[str, deque[float]] = {station: deque() for station in STATIONS}  # station -> recent request times
# Handlers run in parallel threads, so without it two messages could both take a station's last request.
request_times_lock = threading.Lock()
# The model always reasons, and its reasoning counts against this cap too, so it leaves plenty of room beyond the reply
# itself, which is a few hundred tokens at most. Without a cap, one reply could run to the model's 128K-token maximum.
MAX_COMPLETION_TOKENS = 4000

# The ack that answers a send-message. When it isn't delivered, nothing will replace the sender's bubble, so the client
# fades it out (P1).
DELIVERED = {"delivered": True}
NOT_DELIVERED = {"delivered": False}


# SOCKETS
@socketio.on("connect")
def on_connect(auth):
    session_id = request.sid  # type: ignore
    station = auth.get("station") if isinstance(auth, dict) else None
    key = auth.get("key") if isinstance(auth, dict) else None
    if station not in STATIONS or not is_station_key(key):
        print("on_connect rejected", session_id)
        return False

    with pairing_lock:
        replaced = station_sessions.get(station)
        station_sessions[station] = session_id
        stations[session_id] = station
    print("on_connect", session_id, "station", station)

    # The newest socket wins. A reloaded or reconnected installation gets a new session id, and its old socket
    # may not have timed out yet. The old socket's disconnect ends its session, outside the lock.
    if replaced:
        disconnect(replaced)


@socketio.on("disconnect")
def on_disconnect(reason=None):
    # Flask-SocketIO passes the reason ("client disconnect", "ping timeout"…). Without the parameter the call raises a
    # TypeError, which on_error swallows, so the session would never end.
    session_id = request.sid  # type: ignore
    print("on_disconnect", session_id, reason)
    with pairing_lock:
        station = stations.pop(session_id, None)
        if station and station_sessions.get(station) == session_id:
            del station_sessions[station]
    end_session(session_id, "userdisconnect", "user disconnected.")


@socketio.on("login")
def on_login(data):
    global waiting_user
    session_id = request.sid  # type: ignore
    print("on login!", session_id)
    raw_name = data.get("userName") if isinstance(data, dict) else None
    user_name = raw_name.strip()[:MAX_NAME_LENGTH] if isinstance(raw_name, str) else ""
    station = stations.get(session_id)
    if not station:  # replaced by a newer socket for the same station
        return
    user = User(session_id=session_id, user_name=user_name, station=station)
    end_session(session_id, "userdisconnect", "user disconnected.")

    with pairing_lock:
        # Only the other station can be a partner.
        partner = waiting_user if waiting_user and waiting_user.station != station else None
        if not partner:
            waiting_user = user
            return
        waiting_user = None
        room_id = uuid.uuid4().hex
        partners[session_id], partners[partner.session_id] = partner, user
        rooms[session_id] = rooms[partner.session_id] = room_id

    join_room(room_id)
    join_room(room_id, partner.session_id)
    socketio.emit("room", Room(active=True, user_a=partner, user_b=user).to_json(), to=room_id)


@socketio.on("logout")
def on_logout():
    session_id = request.sid  # type: ignore
    print("on logout", session_id)
    end_session(session_id, "logout", "user has logged out.")


@socketio.on("send-message")
def event_send_message(data):
    new_message = read_message(data)
    if not new_message:
        return NOT_DELIVERED
    print(f'new message from: {new_message.user_name} prompt: "{new_message.message}"')
    return respond(
        request.sid,  # type: ignore
        new_message,
        f'Based on the past conversation, rephrase the message "{new_message.message}" wrote by {new_message.user_name} to sound {new_message.higher_tone_value()}% more {new_message.higher_tone_name()}. Do not change the meaning and do not use place holders.',
        "new message",
    )


@socketio.on("send-ghost-message")
def event_send_ghost_message(data):
    new_message = read_message(data)
    if not new_message:
        return NOT_DELIVERED
    print(f'new ghost message from: {new_message.user_name} prompt: "{new_message.message}"')
    return respond(
        request.sid,  # type: ignore
        new_message,
        f"Based on the past conversation, generate the next message on behalf of  {new_message.user_name} to sound {new_message.higher_tone_value()}% more {new_message.higher_tone_name()}. The message should be less than 80 characters long. do not use place holders.",
        "new ghost message",
    )


@socketio.on_error_default
def on_error(e):
    """Logs an exception from any handler. A send-message gets NOT_DELIVERED back, so its bubble fades out (P1)."""
    traceback.print_exception(e)
    # Flask-SocketIO answers with this in place of the handler's result. For the handshake only False refuses the
    # socket, and anything else would let it in without the station key (S10).
    if request.event["message"] == "connect":  # type: ignore
        return False
    return NOT_DELIVERED


# ROUTES


@app.route("/")
def route_home():
    return render_template("index.html", max_name_length=MAX_NAME_LENGTH, max_message_length=MAX_MESSAGE_LENGTH)


# HELPERS
def is_station_key(key) -> bool:
    # compare_digest takes the same time wherever the strings differ, so the key can't be guessed from timings.
    return isinstance(key, str) and hmac.compare_digest(key.encode(), STATION_KEY.encode())  # type: ignore


def read_message(data) -> Optional[MessageInput]:
    """Returns a send-message or send-ghost-message payload within the rate and size limits, or None to drop it."""
    session_id = request.sid  # type: ignore
    station = stations.get(session_id)
    if not station:  # only a socket that passed the station key has one
        return None
    if not within_rate_limit(station):
        print("message dropped, over the rate limit:", session_id)
        return None
    new_message = MessageInput.from_json(data)
    # The chat input can't hold more, so a longer message comes from a modified client. Dropping it beats rewriting
    # something the visitor didn't type in full.
    if len(new_message.message) > MAX_MESSAGE_LENGTH:
        print("message dropped, too long:", session_id)
        return None
    # The client only sends tone names the server gave it. Any other name would be free text in the prompt.
    if new_message.tone_1.tone not in TONES_BY_NAME or new_message.tone_2.tone not in TONES_BY_NAME:
        print("message dropped, unknown tone:", session_id)
        return None
    # Names and earlier messages are only context, so they're cut instead.
    new_message.user_name = new_message.user_name[:MAX_NAME_LENGTH]
    new_message.message_history = [
        {"name": item["name"][:MAX_NAME_LENGTH], "content": item["content"][:MAX_HISTORY_ITEM_LENGTH]}
        for item in new_message.message_history[-MAX_HISTORY_ITEMS:]
    ]
    return new_message


def within_rate_limit(station: str) -> bool:
    """Counts a request against the station's MAX_REQUESTS_PER_MINUTE, or returns False if none are left."""
    now = time.monotonic()
    times = request_times[station]
    with request_times_lock:
        while times and now - times[0] >= 60:
            times.popleft()
        if len(times) >= MAX_REQUESTS_PER_MINUTE:
            return False
        times.append(now)
        return True


def end_session(session_id: str, event: str, message: str):
    """Takes the user out of the waiting slot or their room, and sends `event` to their partner."""
    global waiting_user
    with pairing_lock:
        if waiting_user and waiting_user.session_id == session_id:
            waiting_user = None
        partner = partners.pop(session_id, None)
        room_id = rooms.pop(session_id, None)
        if partner:
            partners.pop(partner.session_id, None)
            rooms.pop(partner.session_id, None)
        if room_id:
            room_tones.pop(room_id, None)

    if partner and room_id:
        leave_room(room_id, session_id)
        leave_room(room_id, partner.session_id)
        socketio.emit(event, {"message": message}, to=partner.session_id)


def respond(session_id: str, new_message: MessageInput, instruction: str, label: str) -> dict:
    """Generates the message and the next pair of tones in one OpenAI call, and sends them to the user's room. Returns
    the sender's ack."""
    room_id = rooms.get(session_id)
    station = stations.get(session_id)
    if not room_id:
        print("message dropped, not paired:", session_id)
        return NOT_DELIVERED

    # Every message brings a new pair of tones, so OpenAI can't pick the pair on the sender's slider. Nor the room's
    # last pair: the slider can still show the previous chat's pair (F3), or the partner's reply can have changed it
    # since the visitor pressed send.
    shown = {TONE_PAIR_OF[new_message.tone_1.tone], TONE_PAIR_OF[new_message.tone_2.tone], room_tones.get(room_id)}
    print(shown)
    allowed = tuple(pair for pair in TONE_PAIRS if pair not in shown)
    print(allowed)
    reply = parse_completion(
        [
            {"role": "developer", "content": new_message.message_history_prompt()},
            {"role": "developer", "content": instruction},
            {
                "role": "developer",
                "content": "Then, as next_tones, select the pair of opposite tones of conversation in which the conversation can continue after this message.",
            },
        ],
        message_response_format(allowed),
    )
    if not reply:
        return NOT_DELIVERED

    next_pair = reply.next_tones
    with pairing_lock:
        # The pairing may have ended or changed while OpenAI was answering.
        paired = rooms.get(session_id) == room_id
        if paired:
            # The partner's reply can arrive while OpenAI answers this one. If it brought the same pair, this one takes
            # another, so the sliders still change.
            if next_pair == room_tones.get(room_id):
                next_pair = random.choice([pair for pair in allowed if pair != next_pair])
            room_tones[room_id] = next_pair
    if not paired:
        print("reply dropped, the pairing changed:", session_id)
        return NOT_DELIVERED

    print(
        f'{label} from: {new_message.user_name} prompt: "{new_message.message}" message: "{reply.message}" tones: {next_pair}'
    )
    tones = TONE_PAIRS[next_pair]
    current_color = new_message.color
    socketio.emit(
        "response-message",
        {
            "message": reply.message,
            "userName": new_message.user_name,
            # Both visitors can type the same name, so the clients tell whose message it is by station (P8). Only A
            # pairs with B, so the station names one side of the room.
            "station": station,
            "prompt": new_message.message,
            "tone1": {"name": tones.tone_a.name, "color": tones.tone_a.color.to_json()},
            "tone2": {"name": tones.tone_b.name, "color": tones.tone_b.color.to_json()},
            "color": current_color,
        },
        to=room_id,
    )
    save_color(current_color)
    return DELIVERED


def save_color(color):
    """Saves the latest color to Firestore. A failure is logged, never raised, because the chat doesn't need it."""
    # It runs after the emit, so a slow write only delays the sender's ack. Without retries, expired credentials or an
    # outage fail in seconds instead of tying up the handler's thread for the default 60 s.
    try:
        db.collection("color").document("color").set({"color": color}, timeout=5, retry=None)
    except Exception as e:
        print("could not save color:", e)


def parse_completion(messages: list, response_format):
    # The call blocks the handler's thread for up to 20 s, twice with the retry. Other handlers run in their own threads.
    try:
        completion = client.beta.chat.completions.parse(
            # model="gpt-4o-mini",
            # model="gpt-4o-2024-08-06",
            model="gpt-6.1-sol",
            store=True,
            max_completion_tokens=MAX_COMPLETION_TOKENS,
            messages=messages,
            response_format=response_format,
        )
    except LengthFinishReasonError:
        # The reply hit MAX_COMPLETION_TOKENS, so it's cut off and can't be parsed.
        print("OpenAI reply dropped, longer than", MAX_COMPLETION_TOKENS, "tokens")
        return None
    reply = completion.choices[0].message
    # A refusal comes back as text instead of JSON, and parsed is None.
    if reply.refusal:
        print("OpenAI refused:", reply.refusal)
        return None
    return reply.parsed  # type: ignore


# Local development only. The Docker image runs `app` with gunicorn (see the Dockerfile).
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    # In threading mode this is Werkzeug's development server. Flask-SocketIO refuses to start it without a terminal,
    # so it can't end up serving production by accident. Never debug=True: it adds Werkzeug's interactive console,
    # which would be reachable from the local network.
    socketio.run(app, port=port, host="0.0.0.0", use_reloader=DEBUG)
