import os

from flask import Flask, render_template
from flask_socketio import SocketIO

app = Flask(__name__, static_url_path="", static_folder="web/static", template_folder="web/templates")
# app.config["SECRET_KEY"] = "secret!"

socketio = SocketIO(app, cors_allowed_origins="*")


# SOCKETS
@socketio.on("click")
def event_click(data):
    print("click: " + str(data))
    socketio.emit("click_2", data)


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
