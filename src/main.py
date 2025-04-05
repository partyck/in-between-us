import json
import os

from firebase_admin import firestore, initialize_app
from flask import Flask, Response, render_template, request
from flask_socketio import SocketIO
from google.cloud.firestore_v1.base_query import FieldFilter
from openai import OpenAI

from config import OPENIA_API_KEY
from models import MessageInput, MessageResponse

# DB initialize
initialize_app()
db = firestore.client()

app = Flask(__name__, static_url_path="", static_folder="web/static", template_folder="web/templates")


socketio = SocketIO(app, cors_allowed_origins="*")
client = OpenAI(api_key=OPENIA_API_KEY)


# SOCKETS
@socketio.on("connect")
def on_connect():
    payload = dict(data="Connected")
    socketio.emit("connect", payload)


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
    if isinstance(message, MessageResponse):
        socketio.emit(
            "response-message",
            {"message": message.message, "userName": new_message.user_name, "prompt": new_message.message},
        )


@socketio.on("send-test")
def event_send_message_test(data):
    data["prompt"] = data["message"]
    socketio.emit("response-message", data)


# ROUTES


@app.route("/")
def route_home():
    return render_template("index.html")


@app.route("/user", methods=["POST"])
def messages():
    print("messages endpoint!")
    data = request.get_json()
    user_name = data["userName"]
    docs = db.collection("users").where(filter=FieldFilter("userB", "==", None)).stream()

    message = None
    for doc in docs:
        db.collection("users").document(doc.id).update({"userB": user_name})
        pair = db.collection("users").document(doc.id).get().to_dict()
        message = json.dumps(pair)
        socketio.emit(
            "pair",
            {"userA": pair["userA"], "userB": pair["userB"]},
        )
        continue
    if not message:
        db.collection("users").add({"userA": user_name, "userB": None})
        message = json.dumps({"message": "waiting for pair."})

    return Response(response=message, status=200, mimetype="application/json")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    socketio.run(app, debug=True, port=port, host="0.0.0.0")
