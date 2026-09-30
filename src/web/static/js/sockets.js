class SocketService {

  constructor() {
    this.socket = io();
    this.listenSockets();
  }

  listenSockets() {
    // Events go to the current scene, and scenes that don't handle one ignore it.
    this.socket.on('connect', () => {
      console.log('🔌⬅️ Socket connected!');
      if (this.hasConnected) {
        currentScene.onReconnect?.();
      }
      this.hasConnected = true;
    });

    this.socket.on('disconnect', function (data) {
      console.log('🔌⬅️ Socket disconnect!', data);
    });

    this.socket.on('room', (data) => {
      console.log('🔌⬅️ room!', data);
      currentScene.onRoom?.(data);
    });

    this.socket.on('userdisconnect', (data) => {
      console.log('🔌⬅️ user disconected!', data);
      currentScene.onPartnerLeft?.();
    });

    this.socket.on('logout', (data) => {
      console.log('🔌⬅️ logout!', data);
      location.reload();
    });

    this.socket.on('response-message', function (data) {
      console.log('🔌⬅️ response message!', data);
      currentScene.onMessage?.(data);
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
