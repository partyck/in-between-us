const HOME_TEXT_SIZE = 24;

class Home extends Scene {
  constructor() {
    super('home-scene');
    this.logoCovered = false;
    this.logoIcon = select('.logo-icon');
    this.logoIcon.mousePressed(() => {
      if (this.clicEenable) {
        changeScene(login);
      }
    });

    const bubblesLength = width * height * 0.0002;
    this.bubbles = [];
    for (let i = 0; i < bubblesLength; i++) {
      let x = random(width);
      let y = random(height);
      let r = random(20, 100);
      this.bubbles.push(new Bubble(x, y, r));
    }
    // BubbleM measures its text when it's created, so it needs the text size draw() uses.
    push();
    textSize(HOME_TEXT_SIZE);
    this.m1 = new BubbleM(width * 0.5, height * 0.5, "touch here to connect", color(0, 242, 96), color(255));
    pop();
  }

  get clicEenable() {
    return this.logoCovered && this.m1.blurAmount <= 0;
  }

  draw() {
    textSize(HOME_TEXT_SIZE);
    rectMode(CENTER);
    background(c.bgColor);

    this.m1.move();
    this.m1.display();
    this.m1.update();

    for (let bubble of this.bubbles) {
      bubble.move();
      bubble.repel();
      bubble.display();
    }

    this.bubblesCoilide();
  }

  bubblesCoilide() {
    let { x: bX, y: bY } = this.logoIcon.position();
    let bW = this.logoIcon.elt.offsetWidth;
    let bH = this.logoIcon.elt.offsetHeight;
    this.logoCovered = !this.bubbles.some((bubble) => {
      return bubble.colides(bX - bW * 0.5, bY - bH * 0.5, bW, bH);
    });

    if (this.clicEenable) {
      // console.log('clicEenable');

      if (this.m1.isPressed()) {
        changeScene(login);
      }
      let buttonHue = frameCount % 360;
      this.logoIcon.style("text-shadow", `2px 2px 9px hsl(${buttonHue}deg 100 50)`);
      this.logoIcon.addClass('mousePointer');
    } else {
      this.logoIcon.style("text-shadow", `0px 0px 0px rgb(0 0 0 / 0%)`);
      this.logoIcon.removeClass('mousePointer');
    }
  }
}


// A bubble looks like r stacked circles of alpha 6/255 (radii 0..r): a point at distance d from the
// centre is under r - d of them, so its opacity is 1 - (1 - 6/255)^(r - d). A radial gradient following
// that curve draws the same thing in one fill instead of r.
const BUBBLE_LAYER_ALPHA = 6 / 255;
const BUBBLE_GRADIENT_STOPS = 10;

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

    this.falloff = [];
    for (let i = 0; i <= BUBBLE_GRADIENT_STOPS; i++) {
      const offset = i / BUBBLE_GRADIENT_STOPS;
      const layers = r * (1 - offset);
      this.falloff.push([offset, 1 - Math.pow(1 - BUBBLE_LAYER_ALPHA, layers)]);
    }
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
    const [red, green, blue] = lerpColor(this.c1, this.c2, this.osc).levels;
    const gradient = drawingContext.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.r);
    for (const [offset, alpha] of this.falloff) {
      gradient.addColorStop(offset, `rgba(${red}, ${green}, ${blue}, ${alpha})`);
    }
    // save/restore so setting fillStyle directly doesn't leave p5's cached fill out of sync.
    drawingContext.save();
    drawingContext.fillStyle = gradient;
    drawingContext.beginPath();
    drawingContext.arc(this.x, this.y, this.r, 0, TWO_PI);
    drawingContext.fill();
    drawingContext.restore();
    this.osc = (sin(frameCount * (this.r / 10000)) + 1) / 2;
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

class BubbleM {
  constructor(x, y, content, color, sc) {
    this.x = x;
    this.y = y;
    this.w = textWidth(content) + 70;
    this.h = textLeading() + 28;
    this.content = content;
    this.c = color;
    this.c.setAlpha(6);
    this.strokeColor = sc;
    this.blurAmount = 1;
  }

  display() {
    noStroke();
    fill(this.c);
    const steps = 100;
    rect(this.x, this.y, this.w, this.h, 15, 15, 15, 15);
    for (let i = 0; i < steps; i++) {
      const rectHeight = this.h * i / steps;
      const rectWidth = (this.w - this.h) + rectHeight * 0.5;
      rect(this.x, this.y, rectWidth, rectHeight, 30);
    }
    fill(this.strokeColor);

    drawingContext.filter = `blur(${this.blurAmount * 10}px)`;
    text(this.content, this.x - textWidth(this.content) / 2, this.y + 6);
    drawingContext.filter = 'none';
  }

  move() {
    // Same random walk as Bubble.move, but the margin is half the button so it never slides off screen.
    this.y = constrain(this.y + random(-1, 1), this.h * 0.5, height - this.h * 0.5);
    this.x = constrain(this.x + random(-1, 1), this.w * 0.5, width - this.w * 0.5);
  }

  update() {
    if (this.blurAmount > 0) {
      this.blurAmount -= 0.001;
    }
  }

  isPressed() {
    const isOverX = mouseX > this.x && mouseX < this.x + this.w;
    const isOverY = mouseY > this.y && mouseY < this.y + this.h;
    return isOverX && isOverY;
  }
}
