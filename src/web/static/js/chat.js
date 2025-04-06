class Chat {

  constructor() {
    this.messages = [];
    this.inputMessageContainer = select('.input-message-container');
    this.messageInput = select('.chat-input');
    let sendButton = select('.send-button');

    sendButton.mousePressed(this.newMessage);
    this.messageInput.changed(this.newMessage);
  }

  add(message, newUserName, prompt) {
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
    this.inputMessageContainer.removeClass('hidden');
  }

  display() {
    background(255);
    this.messages.slice().reverse().forEach((message) => {
      message.display();
    });
  }

  newMessage = () => {
    let message = this.messageInput.value();
    if (message) {
      let newMessage = new Message(message, userName);
      this.messages.forEach((message) => { message.move(newMessage.height) });
      this.messages.push(newMessage);

      let messageHistory = this.messages.slice(-10).map(message => { return { 'name': message.userName, 'content': message.content } });
      socketService.sendMessage(userName, message, messageHistory);
      this.messageInput.value("");
    }
  }

  recipientDisconnected() {
    this.messages = [];
    this.inputMessageContainer.addClass('hidden');
    changeScene(SCENES.WAITING);
    socketService.login(userName);
  }
}
