class MySocket {

    constructor() {
        this.socket = io();
        this.isResetValues = false;
        this.distance = { alpha: 0, beta: 0, gamma: 0 };
        this.listenSockets();
    }


    listenSockets() {
        this.socket.on('connect', function () {
            console.log('Socket connected!');
        });

        this.socket.on('click_2', function (data) {
            console.log('click_2 received!');
            console.log(data);
            stroke(255);
            fill(0, 255, 0);
            ellipse(data.x + 50, data.y, 50, 50);
        });
    }

    emitClick(x, y) {
        this.socket.emit('click', {
            x: x,
            y: y
        });
        console.log('click send! x: ' + x + ' y: ' + y);
    }

}