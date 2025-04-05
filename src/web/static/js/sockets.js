class MySocket {

	constructor() {
		this.socket = io();
		this.listenSockets();
	}

	listenSockets() {
		this.socket.on('connect', function (data) {
			console.log('Socket connected! ' + data);
		});

		this.socket.on('response-message', function (data) {
			chat.add(data.message, data.userName, data.prompt);
		});
	}

	sendMessage(userName, message, messageHistory) {
		this.socket.emit('send-message', {
			userName,
			message,
			messageHistory
		});
	}
}
