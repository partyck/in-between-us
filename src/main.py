import os

from flask import Flask, render_template
from flask_socketio import SocketIO
from openai import OpenAI

from config import OPENIA_API_KEY
from models import MessageInput, MessageResponse

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
        {
            "role": "developer",
            "content": f'Based on the past conversation, rephrase the given message and make it sound with more love, and more trust like a couple that is in love. Do not use place holders. Message by {new_message.user_name} "{new_message.message}"',
        },
        {"role": "developer", "content": new_message.message_history},
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


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    socketio.run(app, debug=True, port=port, host="0.0.0.0")
