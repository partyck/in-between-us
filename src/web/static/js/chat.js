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

  // A bubble that's fading out was never delivered, so the partner never saw it.
  get messageHistory() {
    return this.messages.filter(message => !message.isFading()).slice(-10, -1).map(message => { return { 'name': message.userName, 'content': message.content } });
  }

  // `station` is the sender's, set by the server. It tells whose message this is, since both visitors can have the same
  // name (P8).
  add(message, newUserName, station, prompt, tone1, tone2, newColor) {
    const isOwn = station === socketService.station;
    this.lastMessageAt = performance.now();
    this.isWaiting = !isOwn;
    this.toneController.addTones(tone1, tone2);

    if (isOwn) {
      let newMessage = this.messages.find((message) => {
        return !message.isFading() && message.content === prompt;
      });
      if (newMessage) {
        newMessage.rephrase(message);
      }
      else {
        this.messages.push(new Message(message, newUserName, station, c.sendMessageBGC2, false));
      }
    }
    else {
      this.sound.newMessage();
      this.messages.push(new Message(message, newUserName, station));
    }
    this.layout();
  }

  // Stacks the bubbles from the bottom of the chat up, newest at the bottom, from their order in this.messages and
  // their current heights. Everything that adds, rewrites or removes a bubble calls it. Moving bubbles by offsets went
  // wrong when a rewrite came back after the partner's next message: the rewritten bubble jumped to the bottom, on top
  // of the partner's (P3).
  layout() {
    let below = null;
    this.messages.slice().reverse().forEach((message) => {
      message.placeAbove(below);
      below = message;
    });
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
    this.removeFadedMessage();

    this.ghostMessage();
  }

  // Once a dropped message has faded out, its bubble goes, and the older bubbles above it move down into its place.
  removeFadedMessage() {
    const index = this.messages.findIndex((message) => message.isGone());
    if (index < 0) return;
    this.messages.splice(index, 1);
    this.layout();
  }

  newMessage = () => {
    let message = this.messageInput.value();
    if (message) {
      let newMessage = new Message(message, userName, socketService.station, this.toneController.toneColor);
      this.messages.push(newMessage);
      this.layout();
      socketService.sendMessage(userName, message, this.toneController.tonePayload(), this.messageHistory, (ack) => {
        // The server dropped it, so no rewrite will replace the bubble. It fades out instead of waiting forever.
        if (ack?.delivered === false) newMessage.fadeOut();
      });
      this.messageInput.value("");
      this.lastMessageAt = performance.now();
    }
  }

  onMessage(data) {
    this.add(data.message, data.userName, data.station, data.prompt, data.tone1, data.tone2, data.color);
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
