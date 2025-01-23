import os

from flask import Flask, render_template
from flask_socketio import SocketIO
from openai import OpenAI

from config import OPENIA_API_KEY
from models import MessageResponse

app = Flask(__name__, static_url_path="", static_folder="web/static", template_folder="web/templates")
# app.config["SECRET_KEY"] = "secret!"

socketio = SocketIO(app, cors_allowed_origins="*")

client = OpenAI(api_key=OPENIA_API_KEY)


# SOCKETS
@socketio.on("connect")
def on_connect():
    payload = dict(data="Connected")
    socketio.emit("connect", payload)


@socketio.on("send-message1")
def event_send_message(data):
    print("send-message: " + str(data))
    completion = client.beta.chat.completions.parse(
        model="gpt-4o-mini",
        store=True,
        messages=[
            {
                "role": "system",
                "content": "rewrite the given message and make it sound like it's directed to the love of their life.",
            },
            {"role": "user", "content": str(data)},
        ],
        response_format=MessageResponse,  # type: ignore
    )

    print("gpt response:")
    print(completion.choices[0].message.parsed)
    socketio.emit("response-message", completion.choices[0].message.parsed.to_json())  # type: ignore


@socketio.on("send-message")
def event_send_message_test(data):
    print("send-message: " + str(data))
    socketio.emit("response-message", data)


# ROUTESpyth
@app.route("/")
def route_home():
    return render_template("index.html")


@app.route("/chat")
def route_chat():
    return render_template("chat.html")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    socketio.run(app, debug=True, port=port, host="0.0.0.0")
    # app.run(debug=True, host="0.0.0.0", port=port)
    # app.run(debug=True, host='0.0.0.0', port=port, ssl_context=("cert.pem", "key.pem"))
