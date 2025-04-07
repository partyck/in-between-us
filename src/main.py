import os

from firebase_admin import firestore, initialize_app
from flask import Flask, render_template, request
from flask_socketio import SocketIO

# DB initialize
initialize_app()
db = firestore.client()

app = Flask(__name__, static_url_path="", static_folder="web/static", template_folder="web/templates")


socketio = SocketIO(app, cors_allowed_origins="*")


# SOCKETS
@socketio.on("connect")
def on_connect():
    print("on_connect", request.sid)


# ROUTES


@app.route("/")
def route_home():
    return render_template("index.html")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    socketio.run(app, debug=True, port=port, host="0.0.0.0")
