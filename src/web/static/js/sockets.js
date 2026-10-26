class SocketService {

  constructor() {
    // It connects once the station is known (see connect).
    this.socket = io({ autoConnect: false });
    this.listenSockets();
  }

  // Connects as `credentials.station`, "A" or "B". The handshake carries the station and the station key, and the
  // server refuses any other socket.
  connect(credentials) {
    this.socket.auth = { station: credentials.station, key: credentials.key };
    this.socket.connect();
  }

  // The station this screen connected as. `room` and `response-message` carry the station of each user, and that's
  // how the client tells its own messages from the partner's: both visitors can type the same name (P8).
  get station() {
    return this.socket.auth?.station;
  }

  listenSockets() {
    // Events go to the current scene, and scenes that don't handle one ignore it.
    this.socket.on('connect', () => {
      console.log('🔌⬅️ Socket connected!');
      currentScene.onConnect?.();
      if (this.hasConnected) {
        currentScene.onReconnect?.();
      }
      this.hasConnected = true;
    });

    this.socket.on('connect_error', (error) => {
      console.log('🔌⬅️ Socket connect error!', error.message);
      // Inactive means the server refused the station or key, so the client won't retry. Otherwise it's a network
      // error, and the client keeps trying.
      if (!this.socket.active) {
        setupScene.show('The server refused this station or key.');
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌⬅️ Socket disconnect!', reason);
      // The server only disconnects a socket when the same station connects again somewhere else.
      if (reason === 'io server disconnect') {
        changeScene(closed);
      }
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

    // The finale's burst is over, or failed, and the chat ends.
    this.socket.on('chat-end', () => {
      console.log('🔌⬅️ chat end!');
      currentScene.onChatEnd?.();
    });
  }

  // onAck gets the server's answer once it's done with the message. `{delivered: false}` means it was dropped (P1).
  sendMessage(userName, message, tone, messageHistory, onAck) {
    console.log('🔌➡️ send message:', message);
    this.socket.emit('send-message', {
      userName,
      message,
      tone,
      messageHistory
    }, (ack) => {
      console.log('🔌⬅️ send message ack:', ack);
      onAck?.(ack);
    });
  }

  // onAck works as for sendMessage. Chat waits for it before it sends another ghost message.
  sendGhostMessage(userName, tone, messageHistory, onAck) {
    console.log('🔌➡️ send gost message.');
    this.socket.emit('send-ghost-message', {
      userName,
      tone,
      messageHistory
    }, (ack) => {
      console.log('🔌⬅️ send gost message ack:', ack);
      onAck?.(ack);
    });
  }

  // The finale: the server writes a burst of messages for both visitors and sends them one by one, then chat-end.
  sendGhostBurst(userName, tone, messageHistory) {
    console.log('🔌➡️ send ghost burst.');
    this.socket.emit('send-ghost-burst', {
      userName,
      tone,
      messageHistory
    }, (ack) => {
      console.log('🔌⬅️ send ghost burst ack:', ack);
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
