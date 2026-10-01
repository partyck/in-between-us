const HOME_TEXT_SIZE = 24;

class Home extends Scene {
  constructor() {
    super('home-scene');

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

  draw() {
    textSize(HOME_TEXT_SIZE);
    rectMode(CENTER);
    background(c.bgColor);

    this.m1.move();
    this.m1.repel();
    this.m1.display();
    this.m1.update();

    for (let bubble of this.bubbles) {
      bubble.move();
      bubble.repel();
      bubble.display();
    }

    // The button only works once it has grown to full size and its text is in focus.
    if (this.m1.isReady() && this.m1.isHovered()) {
      changeScene(login);
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
    repelFromPointer(this, this.r);
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
}

// Pushes something at (x, y) away from the pointer once it's within 3r of it, harder the closer it gets.
// This is plain Math on purpose. Written with p5's dist, atan2, map, cos and sin, it pushed bubbles to NaN on the
// iPads once Safari had optimised it, though the same numbers worked out fine anywhere else, and a bubble at NaN
// stops the sketch.
function repelFromPointer(bubble, r) {
  const dx = bubble.x - mouseX;
  const dy = bubble.y - mouseY;
  const d = Math.hypot(dx, dy);
  const strength = 3;
  if (d < r * strength) {
    const angle = Math.atan2(dy, dx);
    // 3 at the pointer, down to 0 at r * strength.
    const force = 3 - 3 * d / (r * strength);
    bubble.x += Math.cos(angle) * force;
    bubble.y += Math.sin(angle) * force;
  }
}

const BUBBLE_M_GROW_MS = 10000;
// Once grown, the text fades in from this blur (a shadowBlur, in sketch pixels) to sharp over BUBBLE_M_FOCUS_MS.
const BUBBLE_M_FOCUS_MS = 3000;
const BUBBLE_M_TEXT_BLUR = 20;

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
    // How far the button has grown towards its full size, from 0 to 1.
    this.growth = 0;
    // How far the text has come into focus after that, from 0 to 1.
    this.focus = 0;
  }

  display() {
    // The straight part between the round ends. It grows from nothing, so the button starts as a round bubble and
    // stretches sideways until the text fits.
    const core = (this.w - this.h) * this.growth;
    noStroke();
    fill(this.c);
    const steps = 100;
    rect(this.x, this.y, core + this.h, this.h, this.h * 0.5);
    for (let i = 0; i < steps; i++) {
      const rectHeight = this.h * i / steps;
      // Circles at first. Fully grown, each layer is (w - h) + rectHeight * 0.5 wide.
      const rectWidth = max(0, core - rectHeight * 0.5) + rectHeight;
      rect(this.x, this.y, rectWidth, rectHeight, 30);
    }

    // The text only appears once the button is big enough to hold it.
    if (this.isGrown()) {
      this.displayText();
    }
  }

  displayText() {
    const x = this.x - textWidth(this.content) / 2;
    const y = this.y + 6;
    fill(this.strokeColor);
    if (this.isReady()) {
      text(this.content, x, y);
      return;
    }
    // Safari ignores drawingContext.filter, but it does blur shadows. So the text is drawn a canvas width to the
    // left, off screen, and only its shadow is shifted back into place. Shadows ignore the canvas transform, so
    // their offset and blur are in device pixels, pixelDensity() times the sketch's.
    const [red, green, blue] = this.strokeColor.levels;
    const shift = width;
    push();
    drawingContext.shadowColor = `rgba(${red}, ${green}, ${blue}, ${this.focus})`;
    drawingContext.shadowBlur = (1 - this.focus) * BUBBLE_M_TEXT_BLUR * pixelDensity();
    drawingContext.shadowOffsetX = shift * pixelDensity();
    text(this.content, x - shift, y);
    pop();
  }

  move() {
    // Same random walk as Bubble.move, but the margin is half the button so it never slides off screen.
    this.y = constrain(this.y + random(-1, 1), this.h * 0.5, height - this.h * 0.5);
    this.x = constrain(this.x + random(-1, 1), this.w * 0.5, width - this.w * 0.5);
  }

  repel() {
    // Reacts like a bubble as wide as the button.
    repelFromPointer(this, this.w * 0.5);
  }

  update() {
    // Driven by deltaTime (ms since the last frame), so each step takes as long at any frame rate.
    if (!this.isGrown()) {
      this.growth = min(this.growth + deltaTime / BUBBLE_M_GROW_MS, 1);
    } else {
      this.focus = min(this.focus + deltaTime / BUBBLE_M_FOCUS_MS, 1);
    }
  }

  isGrown() {
    return this.growth >= 1;
  }

  isReady() {
    return this.focus >= 1;
  }

  isHovered() {
    // display() draws with rectMode(CENTER), so (x, y) is the button's centre, not its corner.
    const isOverX = abs(mouseX - this.x) < this.w * 0.5;
    const isOverY = abs(mouseY - this.y) < this.h * 0.5;
    return isOverX && isOverY;
  }
}
