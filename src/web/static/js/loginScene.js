class LoginScene {

  constructor() {
    this.container = createDiv();
    this.container.id('form');
    this.container.hide();

    let inputE = createInput();
    inputE.position(width * 0.5, height * 0.5);
    inputE.parent(this.container);
    inputE.class('name-input');
    inputE.attribute('placeholder', 'Tell me your name... ');

    this.submitButton = createButton('ok');
    this.submitButton.position(width * 0.5, height * 0.6);
    this.submitButton.size(width * 0.5, 50);
    this.submitButton.class('login-button');
    this.submitButton.parent(this.container);

    this.submitButton.mousePressed(() => {
      if (inputE.value()) {
        userName = inputE.value();
        this.container.hide();
        colorMode(RGB);
        changeScene(SCENES.CHAT)
      }
    });
  }

  show() {
    this.container.show();
    colorMode(HSL);
  }

  display() {
    background(255);
    let buttonHue = frameCount % 360;
    this.submitButton.style("background-color", `hsl(${buttonHue}deg 100 50)`);
  }
}
