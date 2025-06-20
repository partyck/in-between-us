class LoginScene {

  constructor() {
    this.container = select('#form');
    let inputE = select('#name-input');
    this.submitButton = select('.login-button');

    this.submitButton.mousePressed(() => {
      if (inputE.value()) {
        userName = inputE.value();
        inputE.value('');
        this.container.addClass('hidden');
        changeScene(SCENES.WAITING);
        socketService.login(userName);
      }
    });
  }

  show() {
    this.container.removeClass('hidden');
    colorMode(HSL);
  }

  display() {
    background(c.bgColor);
    let buttonHue = frameCount % 360;
    this.submitButton.style("background-color", `hsl(${buttonHue}deg 100 50)`);
  }
}
