import os

from firebase_admin import firestore, initialize_app
from flask import Flask, render_template, request
from flask_socketio import SocketIO, join_room, leave_room
from google.cloud.firestore_v1.base_query import FieldFilter, Or
from openai import OpenAI

from config import DB_ROOMS, OPENIA_API_KEY, TONES_BY_NAME, TONES_PROMPT
from models import MessageInput, MessageResponse, Room, ToneOptions, ToneResponse, User

# DB initialize
initialize_app()
db = firestore.client()

app = Flask(__name__, static_url_path="", static_folder="web/static", template_folder="web/templates")


socketio = SocketIO(app, cors_allowed_origins="*")
client = OpenAI(api_key=OPENIA_API_KEY)


# SOCKETS
@socketio.on("connect")
def on_connect():
    print("on_connect", request.sid)  # type: ignore


@socketio.on("disconnect")
def on_disconnect():
    session_id = request.sid  # type: ignore
    print("on_disconnect", session_id)
    room = getRoom(session_id)

    if room:
        room_ref = db.collection(DB_ROOMS).document(room.id)
        room_doc = Room.from_json(room_ref.get().to_dict())
        other_user = room_doc.user_a if room_doc.user_a.session_id == session_id else room_doc.user_b
        if other_user:
            socketio.emit("userdisconnect", {"message": "user disconnected."}, to=room.id)
            leave_room(room.id, other_user.session_id)
        room_ref.update({"active": False})


@socketio.on("login")
def on_login(data):
    session_id = request.sid  # type: ignore
    print("on login!", session_id)
    user_name = data["userName"] if isinstance(data, dict) else ""
    user = User(session_id=session_id, user_name=user_name)
    incomplete_rooms = getIncompleteRooms()
    added = False

    for room in incomplete_rooms:
        db.collection(DB_ROOMS).document(room.id).update({"userB": user.to_json()})
        room_doc = Room.from_json(db.collection(DB_ROOMS).document(room.id).get().to_dict())
        join_room(room.id)
        socketio.emit("room", room_doc.to_json(), to=room.id)
        added = True
        continue
    if not added:
        new_room = Room(active=True, user_a=user, user_b=None)
        _, room_ref = db.collection(DB_ROOMS).add(new_room.to_json())
        join_room(room_ref.id)


@socketio.on("logout")
def on_logout():
    session_id = request.sid  # type: ignore
    print("on logout", session_id)
    room = getRoom(session_id)
    if room:
        leave_room(room.id, session_id)
        room_ref = db.collection(DB_ROOMS).document(room.id)
        room_doc = Room.from_json(room_ref.get().to_dict())
        other_user = room_doc.user_a if room_doc.user_a.session_id == session_id else room_doc.user_b
        if other_user:
            # socketio.emit("userdisconnect", {"message": "user has entered the room."}, to=room.id)
            socketio.emit("logout", {"message": "user has logged out."}, to=room.id)
            leave_room(room.id, other_user.session_id)
        room_ref.update({"active": False})


@socketio.on("send-message")
def event_send_message(data):
    new_message = MessageInput.from_json(data)
    print(f'new message from: {new_message.user_name} prompt: "{new_message.message}"')
    messages = [
        {"role": "developer", "content": new_message.message_history_prompt()},
        {
            "role": "developer",
            "content": f'Based on the past conversation, rephrase the message "{new_message.message}" wrote by {new_message.user_name} to sound {new_message.higher_tone_value()}% more {new_message.higher_tone_name()}. Do not change the meaning and do not use place holders.',
        },
    ]

    completion = client.beta.chat.completions.parse(
        # model="gpt-4o-mini",
        model="gpt-4o-2024-08-06",
        store=True,
        messages=messages,  # type: ignore
        response_format=MessageResponse,
    )
    message = completion.choices[0].message.parsed

    if message:
        new_message.add_message(message)

    completion2 = client.beta.chat.completions.parse(
        # model="gpt-4o-mini",
        model="gpt-4o-2024-08-06",
        store=True,
        messages=[
            {"role": "developer", "content": TONES_PROMPT},
            {"role": "developer", "content": new_message.message_history_prompt()},
            {
                "role": "developer",
                "content": "Based on the past conversation, select 2 opposite tones of conversation from the provided list so that the given conversation can continue.",
            },
        ],  # type: ignore
        response_format=ToneResponse,
    )
    tones_response = completion2.choices[0].message.parsed

    room = getRoom(request.sid)  # type: ignore

    if room and isinstance(message, MessageResponse) and isinstance(tones_response, ToneResponse):
        print(f'new message from: {new_message.user_name} prompt: "{new_message.message}" message: "{message.message}"')
        tones = ToneOptions(TONES_BY_NAME[tones_response.tone_a], TONES_BY_NAME[tones_response.tone_b])
        current_color = new_message.color
        db.collection("color").document("color").set({"color": current_color})
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
            to=room.id,
        )


@socketio.on("send-ghost-message")
def event_send_ghost_message(data):
    new_message = MessageInput.from_json(data)
    print(f'new ghost message from: {new_message.user_name} prompt: "{new_message.message}"')
    messages = [
        {"role": "developer", "content": new_message.message_history_prompt()},
        {
            "role": "developer",
            "content": f"Based on the past conversation, generate the next message on behalf of  {new_message.user_name} to sound {new_message.higher_tone_value()}% more {new_message.higher_tone_name()}. The message should be less than 80 characters long. do not use place holders.",
        },
    ]

    completion = client.beta.chat.completions.parse(
        # model="gpt-4o-mini",
        model="gpt-4o-2024-08-06",
        store=True,
        messages=messages,  # type: ignore
        response_format=MessageResponse,
    )
    message = completion.choices[0].message.parsed

    if message:
        new_message.add_message(message)

    completion2 = client.beta.chat.completions.parse(
        # model="gpt-4o-mini",
        model="gpt-4o-2024-08-06",
        store=True,
        messages=[
            {"role": "developer", "content": TONES_PROMPT},
            {"role": "developer", "content": new_message.message_history_prompt()},
            {
                "role": "developer",
                "content": "Based on the past conversation, select 2 opposite tones of conversation from the provided list so that the given conversation can continue.",
            },
        ],  # type: ignore
        response_format=ToneResponse,
    )
    tones_response = completion2.choices[0].message.parsed

    room = getRoom(request.sid)  # type: ignore

    if room and isinstance(message, MessageResponse) and isinstance(tones_response, ToneResponse):
        tones = ToneOptions(TONES_BY_NAME[tones_response.tone_a], TONES_BY_NAME[tones_response.tone_b])
        current_color = new_message.color
        print(
            f'new ghost message from: {new_message.user_name} prompt: "{new_message.message}" message: "{message.message}"'
        )
        db.collection("color").document("color").set({"color": current_color})
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
            to=room.id,
        )


# ROUTES


@app.route("/")
def route_home():
    return render_template("index.html")


# HELPERS
def getRoom(userSId: str):
    rooms = [
        room
        for room in (
            db.collection(DB_ROOMS)
            .where(
                filter=Or(
                    [FieldFilter("userB.sessionId", "==", userSId), FieldFilter("userA.sessionId", "==", userSId)]
                )
            )
            .stream()
        )
    ]
    if len(rooms) == 1:
        return rooms[0]
    else:
        return None


def getIncompleteRooms():
    return [
        room
        for room in (
            db.collection(DB_ROOMS)
            .where(filter=FieldFilter("active", "==", True))
            .where(filter=FieldFilter("userB", "==", None))
            .stream()
        )
    ]


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    socketio.run(app, debug=True, port=port, host="0.0.0.0")
