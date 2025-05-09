class Chat {

  constructor() {
    this.messages = [];

    this.recipientNameE = select('.recipient-name');
    this.headerContainer = select('.header-container');
    this.inputMessageContainer = select('.input-message-container');
    this.messageInput = select('.chat-input');
    this.sendButton = select('.send-button');
    this.sendButton.mousePressed(this.newMessage);

    this.toneController = new ToneController();
    this.bgC = c.bgColor;
  }

  add(message, newUserName, prompt, tone1, tone2, newColor) {
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
    } else {
      let newMessage = new Message(message, newUserName)
      this.messages.forEach((message) => { message.move(newMessage.height) });
      this.messages.push(newMessage);
    }
  }

  show() {
    colorMode(RGB);
    textSize(16);
    this.recipientNameE.html(`${recipientName}`);
    this.headerContainer.removeClass('hidden')
    this.inputMessageContainer.removeClass('hidden');
    this.toneController.setToneValue();
  }

  display() {
    background(this.bgC);
    this.toneController.display();

    textFont('Arial');
    this.messages.slice().reverse().forEach((message) => {
      message.display();
    });
  }

  newMessage = () => {
    let message = this.messageInput.value();
    if (message) {
      let newMessage = new Message(message, userName, this.toneController.toneColor);
      this.messages.forEach((message) => { message.move(newMessage.height) });
      this.messages.push(newMessage);

      let messageHistory = this.messages.slice(-10, -1).map(message => { return { 'name': message.userName, 'content': message.content } });
      const tone = this.toneController.tonePayload();
      socketService.sendMessage(userName, message, tone, messageHistory);
      this.messageInput.value("");
    }
  }

  recipientDisconnected() {
    this.messages = [];
    this.headerContainer.addClass('hidden');
    this.inputMessageContainer.addClass('hidden');
    changeScene(SCENES.WAITING);
    socketService.login(userName);
  }
}
