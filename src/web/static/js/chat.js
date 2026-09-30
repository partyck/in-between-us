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
    this.count = 0;
    this.waiting = random(30, 45);

    this.sound = new Sound();
  }

  get messageHistory() {
    return this.messages.slice(-10, -1).map(message => { return { 'name': message.userName, 'content': message.content } });
  }

  add(message, newUserName, prompt, tone1, tone2, newColor) {
    this.count = 0;
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
      this.count = 0;
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
    this.count++;
    if (this.waiting * frameRate() - this.count > 0) return;
    socketService.sendGhostMessage(userName, this.toneController.tonePayload(), this.messageHistory);
    this.count = 0;
    this.isWaiting = true;
  }
}
