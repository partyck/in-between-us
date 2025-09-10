class Constants {
  constructor() {
    this.bgColor = color(225, 237, 242);
    this.sendMessageBGC1 = color(214, 171, 237);
    this.sendMessageBGC2 = color(20, 100, 200);
    this.receivedMessageC = color(205, 212, 232);
    this.tones = [
      {
        toneA: { name: "Informal", rgb: { r: 0, g: 242, b: 96 }, hsl: { h: 144, s: 100, l: 47 } },
        toneB: { name: "Formal", rgb: { r: 5, g: 117, b: 230 }, hsl: { h: 210, s: 96, l: 46 } },
        selected: 0
      },
      {
        toneA: { name: "Friendly", rgb: { r: 144, g: 238, b: 144 }, hsl: { h: 120, s: 73, l: 75 } },
        toneB: { name: "Hostile", rgb: { r: 235, g: 66, b: 66 }, hsl: { h: 0, s: 81, l: 59 } },
        selected: 0
      },
      {
        toneA: { name: "Humorous", rgb: { r: 255, g: 255, b: 28 }, hsl: { h: 60, s: 100, l: 55 } },
        toneB: { name: "Serious", rgb: { r: 0, g: 195, b: 255 }, hsl: { h: 194, s: 100, l: 50 } },
        selected: 0
      },
      {
        toneA: { name: "Supportive", rgb: { r: 135, g: 206, b: 250 }, hsl: { h: 203, s: 92, l: 75 } },
        toneB: { name: "Dismissive", rgb: { r: 169, g: 169, b: 169 }, hsl: { h: 0, s: 0, l: 66 } },
        selected: 0
      },
      {
        toneA: { name: "Respectful", rgb: { r: 252, g: 92, b: 125 }, hsl: { h: 348, s: 96, l: 67 } },
        toneB: { name: "Rude", rgb: { r: 106, g: 130, b: 251 }, hsl: { h: 230, s: 95, l: 70 } },
        selected: 0
      },
      {
        toneA: { name: "Relaxed", rgb: { r: 169, g: 128, b: 255 }, hsl: { h: 259, s: 100, l: 75 } },
        toneB: { name: "Tense", rgb: { r: 255, g: 111, b: 111 }, hsl: { h: 0, s: 100, l: 72 } },
        selected: 0
      },
      {
        toneA: { name: "Empathetic", rgb: { r: 255, g: 192, b: 203 }, hsl: { h: 350, s: 100, l: 88 } },
        toneB: { name: "Cold", rgb: { r: 176, g: 224, b: 230 }, hsl: { h: 187, s: 52, l: 80 } },
        selected: 0
      },
      {
        toneA: { name: "Flirty", rgb: { r: 255, g: 105, b: 237 }, hsl: { h: 307, s: 100, l: 71 } },
        toneB: { name: "Distant", rgb: { r: 137, g: 255, b: 253 }, hsl: { h: 179, s: 100, l: 77 } },
        selected: 0
      },
    ];
  }
}

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}