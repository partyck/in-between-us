class SocketService {

  constructor() {
    this.socket = io();
    this.listenSockets();
  }

  listenSockets() {
    this.socket.on('connect', function (data) {
      console.log('🔌⬅️ Socket connected!', data);
    });

    this.socket.on('disconnect', function (data) {
      console.log('🔌⬅️ Socket disconnect!', data);
    });

    this.socket.on('room', (data) => {
      console.log('🔌⬅️ room!', data);
      waiting.newRoom(data);
    });

    this.socket.on('userdisconnect', (data) => {
      console.log('🔌⬅️ user disconected!', data);
      chat.recipientDisconnected();
    });

    this.socket.on('logout', (data) => {
      console.log('🔌⬅️ logout!', data);
      location.reload();
    });

    this.socket.on('response-message', function (data) {
      console.log('🔌⬅️ response message!', data);
      chat.add(data.message, data.userName, data.prompt, data.tone1, data.tone2, data.color);
    });
  }

  sendMessage(userName, message, tone, messageHistory) {
    console.log('🔌➡️ send message.');
    this.socket.emit('send-message', {
      userName,
      message,
      tone,
      messageHistory
    });
  }

  sendGhostMessage(userName, tone, messageHistory) {
    console.log('🔌➡️ send gost message.');
    this.socket.emit('send-ghost-message', {
      userName,
      tone,
      messageHistory
    });
  }

  login(userName) {
    console.log('🔌➡️ loggin in.');
    this.socket.emit('login', {
      userName
    });
  }

  logout() {
    console.log('🔌➡️ loggin out.');
    this.socket.emit('logout');
  }
}
