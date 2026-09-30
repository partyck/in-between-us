import os
import threading
import uuid
from typing import Optional

from eventlet import tpool
from firebase_admin import firestore, initialize_app
from flask import Flask, render_template, request
from flask_socketio import SocketIO, join_room, leave_room
from openai import OpenAI

from config import DEBUG, OPENAI_API_KEY, TONES_BY_NAME, TONES_PROMPT
from models import MessageInput, MessageResponse, Room, ToneOptions, ToneResponse, User

# DB initialize
initialize_app()
db = firestore.client()

app = Flask(__name__, static_url_path="", static_folder="web/static", template_folder="web/templates")
app.config["TEMPLATES_AUTO_RELOAD"] = DEBUG


socketio = SocketIO(app, cors_allowed_origins="*", async_mode="eventlet")
client = OpenAI(api_key=OPENAI_API_KEY, timeout=20, max_retries=1)

# PAIRING
# Only the two installations talk to each other, so pairing lives in memory instead of the DB.
# A restart drops every pairing, and the clients log in again when they reconnect.
pairing_lock = threading.Lock()
waiting_user: Optional[User] = None
partners: dict[str, User] = {}  # session id -> the user they are talking to
rooms: dict[str, str] = {}  # session id -> room id

MAX_NAME_LENGTH = 40  # keep in sync with maxlength on #name-input


# SOCKETS
@socketio.on("connect")
def on_connect():
    print("on_connect", request.sid)  # type: ignore


@socketio.on("disconnect")
def on_disconnect():
    session_id = request.sid  # type: ignore
    print("on_disconnect", session_id)
    end_session(session_id, "userdisconnect", "user disconnected.")


@socketio.on("login")
def on_login(data):
    global waiting_user
    session_id = request.sid  # type: ignore
    print("on login!", session_id)
    raw_name = data.get("userName") if isinstance(data, dict) else None
    user_name = raw_name.strip()[:MAX_NAME_LENGTH] if isinstance(raw_name, str) else ""
    user = User(session_id=session_id, user_name=user_name)
    end_session(session_id, "userdisconnect", "user disconnected.")

    with pairing_lock:
        partner = waiting_user if waiting_user and waiting_user.session_id != session_id else None
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
    new_message = MessageInput.from_json(data)
    print(f'new message from: {new_message.user_name} prompt: "{new_message.message}"')
    respond(
        request.sid,  # type: ignore
        new_message,
        f'Based on the past conversation, rephrase the message "{new_message.message}" wrote by {new_message.user_name} to sound {new_message.higher_tone_value()}% more {new_message.higher_tone_name()}. Do not change the meaning and do not use place holders.',
        "new message",
    )


@socketio.on("send-ghost-message")
def event_send_ghost_message(data):
    new_message = MessageInput.from_json(data)
    print(f'new ghost message from: {new_message.user_name} prompt: "{new_message.message}"')
    respond(
        request.sid,  # type: ignore
        new_message,
        f"Based on the past conversation, generate the next message on behalf of  {new_message.user_name} to sound {new_message.higher_tone_value()}% more {new_message.higher_tone_name()}. The message should be less than 80 characters long. do not use place holders.",
        "new ghost message",
    )


# ROUTES


@app.route("/")
def route_home():
    return render_template("index.html")


# HELPERS
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

    if partner and room_id:
        leave_room(room_id, session_id)
        leave_room(room_id, partner.session_id)
        socketio.emit(event, {"message": message}, to=partner.session_id)


def respond(session_id: str, new_message: MessageInput, instruction: str, label: str):
    """Generates the message and the next pair of tones, and sends them to the user's room."""
    room_id = rooms.get(session_id)
    if not room_id:
        return

    message = parse_completion(
        [
            {"role": "developer", "content": new_message.message_history_prompt()},
            {"role": "developer", "content": instruction},
        ],
        MessageResponse,
    )

    if message:
        new_message.add_message(message)

    tones_response = parse_completion(
        [
            {"role": "developer", "content": TONES_PROMPT},
            {"role": "developer", "content": new_message.message_history_prompt()},
            {
                "role": "developer",
                "content": "Based on the past conversation, select 2 opposite tones of conversation from the provided list so that the given conversation can continue.",
            },
        ],
        ToneResponse,
    )

    # The pairing may have ended or changed while OpenAI was answering.
    if rooms.get(session_id) != room_id:
        return

    if isinstance(message, MessageResponse) and isinstance(tones_response, ToneResponse):
        print(f'{label} from: {new_message.user_name} prompt: "{new_message.message}" message: "{message.message}"')
        tones = ToneOptions(TONES_BY_NAME[tones_response.tone_a], TONES_BY_NAME[tones_response.tone_b])
        current_color = new_message.color
        socketio.emit(
            "response-message",
            {
                "message": message.message,
                "userName": new_message.user_name,
                "prompt": new_message.message,
                "tone1": {"name": tones.tone_a.name, "color": tones.tone_a.color.to_json()},
                "tone2": {"name": tones.tone_b.name, "color": tones.tone_b.color.to_json()},
                "color": current_color,
            },
            to=room_id,
        )
        save_color(current_color)


def save_color(color):
    """Saves the latest color to Firestore. A failure is logged, never raised, because the chat doesn't need it."""
    # Firestore blocks like OpenAI does, so it also runs in a real thread. Without retries, expired credentials
    # or an outage fail in seconds instead of tying up a thread for the default 60 s.
    try:
        tpool.execute(db.collection("color").document("color").set, {"color": color}, timeout=5, retry=None)
    except Exception as e:
        print("could not save color:", e)


def parse_completion(messages: list, response_format):
    # OpenAI calls block, so run them in a real thread; otherwise every other client freezes while one waits.
    completion = tpool.execute(
        client.beta.chat.completions.parse,
        # model="gpt-4o-mini",
        # model="gpt-4o-2024-08-06",
        model="gpt-6.1-sol",
        store=True,
        messages=messages,
        response_format=response_format,
    )
    return completion.choices[0].message.parsed  # type: ignore


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    # Never debug=True: in eventlet mode it adds Werkzeug's interactive console, which would be
    # reachable from the local network in development.
    socketio.run(app, port=port, host="0.0.0.0", use_reloader=DEBUG, log_output=DEBUG)
