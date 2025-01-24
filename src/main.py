import os

from flask import Flask, render_template
from flask_socketio import SocketIO
from openai import OpenAI

from config import OPENIA_API_KEY
from models import MessageResponse

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
    completion = client.beta.chat.completions.parse(
        model="gpt-4o-mini",
        store=True,
        messages=[
            {
                "role": "developer",
                "content": "rewrite the given message and make it sound like it's directed to the love of their life.",
            },
            {"role": "user", "content": data.get("message")},
        ],
        response_format=MessageResponse,  # type: ignore
    )
    message = completion.choices[0].message.parsed.message  # type: ignore
    socketio.emit("response-message", {"message": message, "userName": data.get("userName")})


@socketio.on("send-message1")
def event_send_message_test(data):
    socketio.emit("response-message", data)


# ROUTES
@app.route("/")
def route_home():
    return render_template("index.html")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    socketio.run(app, debug=True, port=port, host="0.0.0.0")
    # app.run(debug=True, host="0.0.0.0", port=port)
    # app.run(debug=True, host='0.0.0.0', port=port, ssl_context=("cert.pem", "key.pem"))
