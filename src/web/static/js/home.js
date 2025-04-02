const title = 'In between us.';

class Home {
  constructor() {
    this.blurAmount = 1;
    textSize(24);
    this.w = textWidth(title);
    this.h = textAscent() + textDescent();

    this.logoIcon = createSpan(title);
    this.logoIcon.class('logoIcon');
    this.logoIcon.position((width - this.w) * 0.5, (height - this.h) * 0.5);
    this.logoIcon.size(this.w, this.h);
    this.clicEenable = false;
    this.logoIcon.mousePressed(() => {
      if (this.blurAmount <= 0 && this.clicEenable) {
        this.logoIcon.hide();
        changeScene(SCENES.LOGIN);
      }
    });

    this.bubbles = [];
    for (let i = 0; i < 500; i++) {
      let x = random(width);
      let y = random(height);
      let r = random(1, 20);
      this.bubbles.push(new Bubble(x, y, r));
    }
  }

  display() {
    // textSize(32);
    background(255);
    this.logoIcon.style('filter', `blur(${this.blurAmount * 10}px)`);

    if (this.blurAmount > 0) {
      this.blurAmount -= 0.005;
    }

    for (let bubble of this.bubbles) {
      bubble.move();
      bubble.repel(mouseX, mouseY);
      bubble.display(this.blurAmount);
    }

    this.bubblesCoilide();
  }

  bubblesCoilide() {
    this.clicEenable = !this.bubbles.some((bubble) => {
      let { x, y } = this.logoIcon.position();
      return bubble.colides(x, y, this.w, this.h);
    });

    if (this.clicEenable) {
      this.logoIcon.addClass('mousePointer');
    } else {
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
    // Keep bubbles from floating away, simulating a flat surface
    this.y = constrain(this.y + random(-1, 1), 20, height - 20);
    this.x = constrain(this.x + random(-1, 1), 20, width - 20);
  }

  repel(px, py) {
    let d = dist(this.x, this.y, px, py);
    if (d < this.r * 5) {
      let angle = atan2(this.y - py, this.x - px);
      let force = map(d, 0, this.r * 5, 3, 0);
      this.x += cos(angle) * force;
      this.y += sin(angle) * force;
    }
  }

  display() {
    noFill();
    stroke(0, 0, 255, 100);
    strokeWeight(2);
    ellipse(this.x, this.y, this.r * 2);

    // Inner reflection
    // noStroke();
    // fill(255, 255, 255, 100);
    // ellipse(this.x - this.r / 3, this.y - this.r / 3, this.r / 2);

    // Outer glow
    // stroke(173, 216, 230, 100);
    // strokeWeight(4);
    // noFill();
    // ellipse(this.x, this.y, this.r * 2.2);
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
