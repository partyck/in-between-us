class SocketService {

  constructor() {
    this.socket = io();
    this.listenSockets();
  }

  listenSockets() {
    this.socket.on('connect', function (data) {
      console.log('Socket connected!', data);
    });

    this.socket.on('disconnect', function (data) {
      console.log('Socket disconnect!', data);
    });

    this.socket.on('room', (data) => {
      waiting.newRoom(data);
    });

    this.socket.on('userdisconnect', (data) => {
      chat.recipientDisconnected();
    });

    this.socket.on('response-message', function (data) {
      chat.add(data.message, data.userName, data.prompt, data.tone1, data.tone2, data.color);
    });
  }

  sendMessage(userName, message, tone, messageHistory) {
    this.socket.emit('send-message', {
      userName,
      message,
      tone,
      messageHistory
    });
  }

  sendGhostMessage(userName, tone, messageHistory) {
    this.socket.emit('send-ghost-message', {
      userName,
      tone,
      messageHistory
    });
  }

  login(userName) {
    this.socket.emit('login', {
      userName
    });
  }
}
