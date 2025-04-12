class Chat {

  constructor() {
    this.messages = [];

    this.recipientNameE = select('.recipient-name');
    this.headerContainer = select('.header-container');
    this.inputMessageContainer = select('.input-message-container');
    this.messageInput = select('.chat-input');
    this.sendButton = select('.send-button');
    this.sendButton.mousePressed(this.newMessage);

    this.toneValue = 0.5;
    this.tone1c = color('#00F260');
    this.tone2c = color('#0575E6');
    this.tone1s = 'Formal';
    this.tone2s = 'Informal';
    this.cy1 = height - 100;
    this.cy0 = this.cy1 - height * 0.05;
    this.cyt = this.cy1 - (this.cy1 - this.cy0) * 0.3;
    this.cyc = this.cy1 - (this.cy1 - this.cy0) * 0.5;
  }

  get toneColor() {
    return lerpColor(this.tone1c, this.tone2c, this.toneValue);
  }

  add(message, newUserName, prompt, tone1, tone2) {
    this.tone1s = tone1.name;
    this.tone2s = tone2.name;
    this.tone1c = color(tone1.color.r, tone1.color.g, tone1.color.b);
    this.tone2c = color(tone2.color.r, tone2.color.g, tone2.color.b);

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
    this.setToneValue(this.toneValue);
  }

  display() {
    background(c.bgColor);
    this.displayToneControl()

    textFont('Arial');
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

      let messageHistory = this.messages.slice(-10, -1).map(message => { return { 'name': message.userName, 'content': message.content } });
      let color = this.toneColor.toString('#rrggbb');
      const tone = { "tone1": this.tone1s, "tone1Value": 1 - this.toneValue, "tone2": this.tone2s, "tone2Value": this.toneValue, "color": color };
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

  displayToneControl() {
    noFill();
    for (let index = 0; index < width; index++) {
      stroke(lerpColor(this.tone1c, this.tone2c, (index / width)));
      line(index, this.cy0, index, this.cy1);
    }

    fill(this.toneColor);
    stroke('0015ff');
    strokeWeight(1);
    circle(width * this.toneValue, this.cyc, height * 0.04);

    noStroke();
    fill(0);
    textFont('Courier New');
    text(this.tone1s, 10, this.cyt);
    text(this.tone2s, width - 10 - textWidth(this.tone2s), this.cyt);
    this.controllTone();
  }

  controllTone() {
    if (!mouseIsPressed) return;
    if (mouseY > this.cy0 && mouseY < this.cy1) {
      this.setToneValue(mouseX / width);
    }
  }

  setToneValue(newValue) {
    this.toneValue = newValue;
    let color = this.toneColor.toString('#rrggbb');
    this.sendButton.style('background-color', color);
  }
}
