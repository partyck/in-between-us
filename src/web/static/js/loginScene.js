class LoginScene extends Scene {

  constructor() {
    super('login-scene');
    let inputE = select('#name-input');
    this.submitButton = select('.login-button');

    this.submitButton.mousePressed(() => {
      // Trimmed the same way as on the server, so a name of only spaces doesn't count.
      let name = inputE.value().trim();
      if (name) {
        userName = name;
        inputE.value('');
        waiting.join();
      }
    });
  }

  draw() {
    background(c.bgColor);
    let buttonHue = frameCount % 360;
    this.submitButton.style("background-color", `hsl(${buttonHue}deg 100 50)`);
    updateTimer();
  }
}
