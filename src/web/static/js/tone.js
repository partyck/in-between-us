class ToneController {

  constructor() {
    this.toneValue = 0.5;
    this.tone1c = color('#00F260');
    this.tone2c = color('#0575E6');
    this.tone1s = 'Formal';
    this.tone2s = 'Informal';
    this.cy1 = height - 100;
    this.cy0 = this.cy1 - height * 0.05;
    this.cyt = this.cy1 - (this.cy1 - this.cy0) * 0.3;
    this.cyc = this.cy1 - (this.cy1 - this.cy0) * 0.5;

    this.sendButton = select('.send-button');
  }

  get toneColor() {
    return lerpColor(this.tone1c, this.tone2c, this.toneValue);
  }

  display() {
    for (let index = 0; index < width / 5; index++) {
      noStroke();
      fill(lerpColor(this.tone1c, this.tone2c, (index * 5 / width)));
      rect(index * 5, this.cy0, index + 5, height * 0.05);
    }

    fill(this.toneColor);
    stroke('0015ff');
    strokeWeight(1);
    circle(width * this.toneValue, this.cyc, height * 0.04);

    noStroke();
    fill(0);
    textFont('Roboto Mono');
    text(this.tone1s, 10, this.cyt);
    text(this.tone2s, width - 10 - textWidth(this.tone2s), this.cyt);
    this.control();
  }

  control() {
    if (!mouseIsPressed) return;
    if (mouseY > this.cy0 && mouseY < this.cy1) {
      this.setToneValue(mouseX / width);
    }
  }

  addTones(tone1, tone2) {
    this.tone1s = tone1.name;
    this.tone2s = tone2.name;
    this.tone1c = color(tone1.color.r, tone1.color.g, tone1.color.b);
    this.tone2c = color(tone2.color.r, tone2.color.g, tone2.color.b);
  }

  tonePayload() {
    return {
      "tone1": this.tone1s,
      "tone1Value": 1 - this.toneValue,
      "tone2": this.tone2s,
      "tone2Value": this.toneValue,
      "color": this.toneColor.toString('#rrggbb')
    };
  }

  colorRGB() {
    return this.toneColor.toString('#rrggbb');
  }

  setToneValue(newValue = this.toneValue) {
    this.toneValue = newValue;
    let color = this.toneColor.toString('#rrggbb');
    this.sendButton.style('background-color', color);
  }
}
