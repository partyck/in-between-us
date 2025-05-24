const waitingTitle = 'Waiting for someone to join.';

class Waiting {

  constructor() {
    this.waitingText = createSpan(waitingTitle);
    this.waitingText.class('waiting-text');
    this.waitingText.addClass('unselectable');
    this.waitingText.hide();
  }

  show() {
    textSize(24);
    colorMode(HSL);
    this.waitingText.show();
  }

  display() {
    background(c.bgColor);
    let buttonHue = frameCount % 360;
    this.waitingText.style("text-shadow", `2px 2px 9px hsl(${buttonHue}deg 100 50)`);
  }

  newRoom(room) {
    if (room.userA.userName === userName) {
      recipientName = room.userB.userName;
    }
    else {
      recipientName = room.userA.userName;
    }
    this.waitingText.hide();
    changeScene(SCENES.CHAT);
  }
}
