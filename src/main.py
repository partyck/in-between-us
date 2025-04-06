import os

from firebase_admin import firestore, initialize_app
from flask import Flask, render_template, request
from flask_socketio import SocketIO, join_room, leave_room
from google.cloud.firestore_v1.base_query import FieldFilter, Or
from openai import OpenAI

from config import OPENIA_API_KEY
from models import MessageInput, MessageResponse, Room, User

# DB initialize
initialize_app()
db = firestore.client()

app = Flask(__name__, static_url_path="", static_folder="web/static", template_folder="web/templates")


socketio = SocketIO(app, cors_allowed_origins="*")
client = OpenAI(api_key=OPENIA_API_KEY)


# SOCKETS
@socketio.on("connect")
def on_connect():
    print("on_connect", request.sid)


@socketio.on("disconnect")
def on_disconnect():
    print("on_disconnect", request.sid)
    session_id = request.sid
    room = getRoom(session_id)

    if room:
        room_ref = db.collection("rooms").document(room.id)
        room_doc = Room.from_json(room_ref.get().to_dict())
        other_user = room_doc.user_a if room_doc.user_a.session_id == session_id else room_doc.user_b
        if other_user:
            socketio.emit("userdisconnect", {"message": "user has entered the room."}, to=room.id)
            leave_room(room.id, other_user.session_id)
        room_ref.update({"active": False})


@socketio.on("login")
def on_login(data):
    print("on login!", request.sid)
    user_name = data["userName"] if isinstance(data, dict) else ""
    user = User(session_id=request.sid, user_name=user_name)
    # user = {"sessionId": request.sid, "userName": user_name}
    incomplete_rooms = getIncompleteRooms()
    added = False

    for room in incomplete_rooms:
        db.collection("rooms").document(room.id).update({"userB": user.to_json()})
        room_doc = Room.from_json(db.collection("rooms").document(room.id).get().to_dict())
        join_room(room.id)
        socketio.emit("room", room_doc.to_json(), to=room.id)
        added = True
        continue
    if not added:
        _, room_ref = db.collection("rooms").add({"active": True, "userA": user.to_json(), "userB": None})
        join_room(room_ref.id)


@socketio.on("send-message")
def event_send_message(data):
    new_message = MessageInput.from_json(data)
    messages = [
        {"role": "developer", "content": new_message.message_history},
        {
            "role": "developer",
            "content": f'Based on the past conversation, rephrase the message "{new_message.message}" wrote by {new_message.user_name} to sound more assertive and kind. Do not change the meaning and do not use place holders.',
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

    room = getRoom(request.sid)

    if room and isinstance(message, MessageResponse):
        socketio.emit(
            "response-message",
            {"message": message.message, "userName": new_message.user_name, "prompt": new_message.message},
            to=room.id,
        )


@socketio.on("send-test")
def event_send_message_test(data):
    data["prompt"] = data["message"]
    socketio.emit("response-message", data)


# ROUTES


@app.route("/")
def route_home():
    return render_template("index.html")


# HELPERS
def getRoom(userSId: str):
    rooms = [
        room
        for room in (
            db.collection("rooms")
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
            db.collection("rooms")
            .where(filter=FieldFilter("active", "==", True))
            .where(filter=FieldFilter("userB", "==", None))
            .stream()
        )
    ]


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    socketio.run(app, debug=True, port=port, host="0.0.0.0")
