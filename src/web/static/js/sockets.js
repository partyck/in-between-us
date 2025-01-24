class MySocket {

    constructor() {
        this.socket = io();
        this.isResetValues = false;
        this.distance = { alpha: 0, beta: 0, gamma: 0 };
        this.listenSockets();
    }


    listenSockets() {
        this.socket.on('connect', function (data) {
            console.log('Socket connected! ' + data);
        });

        this.socket.on('response-message', function (data) {
            messages.add(data.message, data.userName);
        });
    }

    emitClick(x, y) {
        this.socket.emit('click', {
            x: x,
            y: y
        });
        console.log('click send! x: ' + x + ' y: ' + y);
    }

    sendMessage(userName, message) {
        this.socket.emit('send-message', {
            userName,
            message
        });
    }

}