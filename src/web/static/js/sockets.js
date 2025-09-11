class SocketService {

  constructor() {
    this.socket = io();
    this.listenSockets();
    const selected = select('.exhibition');
    this.user_id = (selected) ? selected.elt.getAttribute('id') : '';
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
    const room = this.user_id ? 'EXHIBITION' : '';
    this.socket.emit('send-message', {
      userName,
      message,
      tone,
      messageHistory,
      room,
    });
  }

  sendGhostMessage(userName, tone, messageHistory) {
    console.log('🔌➡️ send gost message.');
    const room = this.user_id ? 'EXHIBITION' : '';
    this.socket.emit('send-ghost-message', {
      userName,
      tone,
      messageHistory,
      room,
    });
  }

  login(userName) {
    console.log('🔌➡️ loggin in.');
    const room = this.user_id ? 'EXHIBITION' : '';
    this.socket.emit('login', {
      userName,
      room,
      user: this.user_id,
    });
  }

  logout() {
    console.log('🔌➡️ loggin out.');
    this.socket.emit('logout');
  }
}
