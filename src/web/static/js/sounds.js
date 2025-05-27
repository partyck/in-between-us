class Sound {

  constructor() {
    this.playing = false;
    userStartAudio();
    this.osc1 = new p5.Oscillator('triangle'); // Triangle wave can sound a bit softer/more "digital"
    this.env1 = new p5.Envelope();
    this.env1.setADSR(0.005, 0.05, 0.1, 0.15); // Very quick attack, short decay
    this.env1.setRange(0.5, 0);

    this.osc2 = new p5.Oscillator('triangle');
    this.env2 = new p5.Envelope();
    this.env2.setADSR(0.005, 0.05, 0.1, 0.15);
    this.env2.setRange(0.5, 0);
  }

  newMessage() {
    this._play(this._newMessageSound);
  }

  _play(sound) {
    if (getAudioContext().state !== 'running') {
      getAudioContext().resume().then(() => {
        console.log("AudioContext resumed!");
        if (!this.playing) {
          sound();
        }
      });
    } else {
      if (!this.playing) {
        sound();
      }
    }
  }

  _newMessageSound = () => {
    this.playing = true;

    this.osc1.freq(1046.50);
    this.osc1.start();
    this.env1.play(this.osc1);

    setTimeout(() => {
      this.osc2.freq(1396.91);
      this.osc2.start();
      this.env2.play(this.osc2);
    }, 100);

    let duration2 = this.env2.aTime + this.env2.dTime + this.env2.rTime;
    let totalTime = 0.100 + duration2 + 0.1;

    setTimeout(() => {
      this.osc1.stop();
      this.osc2.stop();
      this.playing = false;
    }, totalTime * 1000);
  }
}