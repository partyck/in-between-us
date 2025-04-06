const waitingTitle = 'Waiting for someone to join.';

class Waiting {

  constructor() {
    textSize(24);
    this.w = textWidth(waitingTitle);
    this.h = textAscent() + textDescent();

    this.logoIcon = createSpan(waitingTitle);
    this.logoIcon.class('waiting-text');
    this.logoIcon.position((width - this.w) * 0.5, (height - this.h) * 0.5);
    this.logoIcon.size(this.w, this.h);
    this.logoIcon.hide();
  }

  show() {
    textSize(24);
    colorMode(HSL);
    this.logoIcon.show();
  }

  display() {
    background(255);
    let buttonHue = frameCount % 360;
    this.logoIcon.style("text-shadow", `2px 2px 9px hsl(${buttonHue}deg 100 50)`);
  }

  newRoom(room) {
    if (room.userA.userName === userName) {
      recipientName = room.userB.userName;
    }
    else {
      recipientName = room.userA.userName;
    }
    this.logoIcon.hide();
    changeScene(SCENES.CHAT);
  }
}
