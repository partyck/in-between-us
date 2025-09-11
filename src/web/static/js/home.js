const title = 'In between us.';

class Home {
  constructor() {
    textSize(24);
    this.logoCovered = false;

    const bubblesLength = width * height * 0.0002;
    this.bubbles = [];
    for (let i = 0; i < bubblesLength; i++) {
      let x = random(width);
      let y = random(height);
      let r = random(20, 100);
      this.bubbles.push(new Bubble(x, y, r));
    }
    this.m1 = new BubbleM(width * 0.5, height * 0.5, "touch here to connect", color(0, 242, 96), color(255));
  }

  show() {
    textSize(24);
    rectMode(CENTER);
  }

  display() {
    background(c.bgColor);

    this.m1.display();

    for (let bubble of this.bubbles) {
      bubble.move();
      bubble.repel();
      bubble.display();
    }

    this.bubblesCoilide();
  }

  bubblesCoilide() {
    this.logoCovered = this.bubbles.some((bubble) => {
      return bubble.colides(this.m1.minX, this.m1.minY, this.m1.w, this.m1.h);
    });

    if (!this.logoCovered && this.m1.isPressed()) {
      changeScene(SCENES.LOGIN);
    }
  }
}


class Bubble {
  constructor(x, y, r) {
    this.x = x;
    this.y = y;
    this.r = r;
    const selectionIndex = Math.floor(Math.random() * (c.tones.length));
    const selection = c.tones[selectionIndex];
    selection.selected++;
    this.c1 = color(selection.toneA.rgb.r, selection.toneA.rgb.g, selection.toneA.rgb.b);
    this.c2 = color(selection.toneB.rgb.r, selection.toneB.rgb.g, selection.toneB.rgb.b);
    this.osc = 0;
  }

  move() {
    this.y = constrain(this.y + random(-1, 1), 20, height - 20);
    this.x = constrain(this.x + random(-1, 1), 20, width - 20);
  }

  repel() {
    const d = dist(this.x, this.y, mouseX, mouseY);
    const strength = 3;
    if (d < this.r * strength) {
      const angle = atan2(this.y - mouseY, this.x - mouseX);
      const force = map(d, 0, this.r * strength, 3, 0);
      this.x += cos(angle) * force;
      this.y += sin(angle) * force;
    }
  }

  display() {
    const color = lerpColor(this.c1, this.c2, this.osc);
    color.setAlpha(6);
    fill(color);
    noStroke();
    for (let i = 0; i < this.r; i++) {
      const d = (this.r * 2) * (i / this.r);
      ellipse(this.x, this.y, d);
    }
    this.osc = (sin(frameCount * (this.r / 10000)) + 1) / 2;
  }

  colides(buttonX, buttonY, buttonWidth, buttonHeigth) {
    // returns true if it colides with the logo
    let closestX = constrain(this.x, buttonX, buttonX + buttonWidth);
    let closestY = constrain(this.y, buttonY, buttonY + buttonHeigth);
    let distanceX = this.x - closestX;
    let distanceY = this.y - closestY;
    let distanceSquared = distanceX * distanceX + distanceY * distanceY;
    return distanceSquared < this.r * this.r;
  }
}

class BubbleM {
  constructor(x, y, content, color, sc) {
    this.x = x;
    this.y = y;
    this.w = textWidth(content) + 40;
    this.h = textLeading() + 28;
    this.minX = this.x - this.w * 0.5;
    this.minY = this.y - this.h * 0.5;
    this.content = content;
    this.c = color;
    this.c.setAlpha(6);
    this.strokeColor = sc;
  }

  display() {
    noStroke();
    fill(this.c);
    const steps = 100;
    for (let i = 0; i < steps; i++) {
      const rectHeight = this.h * i / steps;
      const rectWidth = (this.w - this.h) + rectHeight;
      rect(this.x, this.y, rectWidth, rectHeight, 30);
    }

    fill(this.strokeColor);
    text(this.content, this.x - textWidth(this.content) / 2, this.y + 6);
  }

  isPressed() {
    return mouseIsPressed
      && (mouseX > this.minX && mouseX < this.minX + this.w)
      && (mouseY > this.minY && mouseY < this.minY + this.h);
  }
}
