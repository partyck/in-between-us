class Chat extends Scene {

  constructor() {
    super('chat-scene');
    this.messages = [];

    this.recipientNameE = select('.recipient-name');
    this.messageInput = select('.chat-input');
    this.sendButton = select('.send-button');
    this.closeButton = select('.home-button');
    this.closeButton.mousePressed(() => {
      socketService.logout();
      location.reload();
    });
    this.sendButton.mousePressed(this.newMessage);

    this.toneController = new ToneController();
    this.bgC = c.bgColor;
    this.isWaiting = true;
    // When the last message was sent or received (a performance.now() time), for the ghost message's timer.
    this.lastMessageAt = performance.now();
    // Seconds of silence before a ghost message.
    this.waiting = random(30, 45);

    this.sound = new Sound();
  }

  get messageHistory() {
    return this.messages.slice(-10, -1).map(message => { return { 'name': message.userName, 'content': message.content } });
  }

  add(message, newUserName, prompt, tone1, tone2, newColor) {
    this.lastMessageAt = performance.now();
    this.isWaiting = newUserName !== userName;
    this.toneController.addTones(tone1, tone2);

    if (newUserName === userName) {
      let newMessage = this.messages.find((message) => {
        return message.content === prompt;
      });
      if (newMessage) {
        let distance = newMessage.rephrase(message);
        this.messages.forEach((message) => {
          if (message.content !== newMessage.content) {
            message.y = message.y + distance;
          }
        });
      }
      else {
        let newMessage = new Message(message, newUserName, c.sendMessageBGC2, false);
        this.messages.forEach((message) => { message.move(newMessage.height) });
        this.messages.push(newMessage);
      }
    }
    else {
      this.sound.newMessage();
      let newMessage = new Message(message, newUserName);
      this.messages.forEach((message) => { message.move(newMessage.height) });
      this.messages.push(newMessage);
    }
  }

  enter() {
    super.enter();
    this.recipientNameE.elt.textContent = `You are talking to ${recipientName}`;
    this.toneController.setToneValue();
    // A new partner gets the full silence before a ghost message.
    this.lastMessageAt = performance.now();
  }

  exit() {
    super.exit();
    this.messages = [];
  }

  draw() {
    background(this.bgC);
    this.toneController.display();

    textFont(MESSAGE_FONT, MESSAGE_TEXT_SIZE);
    this.messages.slice().reverse().forEach((message) => {
      message.display();
    });

    this.ghostMessage();
  }

  newMessage = () => {
    let message = this.messageInput.value();
    if (message) {
      let newMessage = new Message(message, userName, this.toneController.toneColor);
      this.messages.forEach((message) => { message.move(newMessage.height) });
      this.messages.push(newMessage);
      socketService.sendMessage(userName, message, this.toneController.tonePayload(), this.messageHistory);
      this.messageInput.value("");
      this.lastMessageAt = performance.now();
    }
  }

  onMessage(data) {
    this.add(data.message, data.userName, data.prompt, data.tone1, data.tone2, data.color);
  }

  onPartnerLeft() {
    waiting.join();
  }

  onReconnect() {
    waiting.join();
  }

  ghostMessage() {
    if (!this.isWaiting) return;
    // Timed by the clock, not by counting frames at frameRate(), so a slow frame (like the first one after the iPad
    // wakes up) can't send it early. Written so that a NaN waits instead of sending: NaN >= anything is false.
    const silence = performance.now() - this.lastMessageAt;
    if (!(silence >= this.waiting * 1000)) return;
    socketService.sendGhostMessage(userName, this.toneController.tonePayload(), this.messageHistory);
    this.lastMessageAt = performance.now();
    this.isWaiting = true;
  }
}
