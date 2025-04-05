const title = 'In between us.';

class Home {
  constructor() {
    textSize(24);
    colorMode(HSL);

    this.blurAmount = 1;
    this.logoCovered = false;
    this.w = textWidth(title);
    this.h = textAscent() + textDescent();

    this.logoIcon = createSpan(title);
    this.logoIcon.class('logoIcon');
    this.logoIcon.position((width - this.w) * 0.5, (height - this.h) * 0.5);
    this.logoIcon.size(this.w, this.h);
    this.logoIcon.hide();
    this.logoIcon.mousePressed(() => {
      if (this.clicEenable) {
        this.logoIcon.hide();
        changeScene(SCENES.LOGIN);
      }
    });

    this.bubbles = [];
    for (let i = 0; i < 500; i++) {
      let x = random(width);
      let y = random(height);
      let r = random(2, 20);
      this.bubbles.push(new Bubble(x, y, r));
    }
  }

  get clicEenable() {
    return this.logoCovered && this.blurAmount <= 0;
  }

  show() {
    this.logoIcon.show();
  }

  display() {
    background(255);
    this.logoIcon.style('filter', `blur(${this.blurAmount * 10}px)`);

    if (this.blurAmount > 0) {
      this.blurAmount -= 0.005;
    }

    for (let bubble of this.bubbles) {
      bubble.move();
      bubble.repel();
      bubble.display(this.blurAmount);
    }

    this.bubblesCoilide();
  }

  bubblesCoilide() {
    this.logoCovered = !this.bubbles.some((bubble) => {
      let { x, y } = this.logoIcon.position();
      return bubble.colides(x, y, this.w, this.h);
    });

    if (this.clicEenable) {
      let buttonHue = frameCount % 360;
      this.logoIcon.style("text-shadow", `2px 2px 9px hsl(${buttonHue}deg 100 50)`);
      this.logoIcon.addClass('mousePointer');
    } else {
      this.logoIcon.style("text-shadow", `0px 0px 0px rgb(0 0 0 / 0%)`);
      this.logoIcon.removeClass('mousePointer');
    }
  }
}


class Bubble {
  constructor(x, y, r) {
    this.x = x;
    this.y = y;
    this.r = r;
  }

  move() {
    this.y = constrain(this.y + random(-1, 1), 20, height - 20);
    this.x = constrain(this.x + random(-1, 1), 20, width - 20);
  }

  repel() {
    let d = dist(this.x, this.y, mouseX, mouseY);
    if (d < this.r * 6) {
      let angle = atan2(this.y - mouseY, this.x - mouseX);
      let force = map(d, 0, this.r * 6, 3, 0);
      this.x += cos(angle) * force;
      this.y += sin(angle) * force;
    }
  }

  display() {
    noFill();
    stroke('#2663fc');
    strokeWeight(2);
    ellipse(this.x, this.y, this.r * 2);
  }

  colides(buttonX, buttony, buttonWidth, buttonHeigth) {
    // returns true if it colides with the logo
    let closestX = constrain(this.x, buttonX, buttonX + buttonWidth);
    let closestY = constrain(this.y, buttony, buttony + buttonHeigth);
    let distanceX = this.x - closestX;
    let distanceY = this.y - closestY;
    let distanceSquared = distanceX * distanceX + distanceY * distanceY;
    return distanceSquared < this.r * this.r;
  }
}
