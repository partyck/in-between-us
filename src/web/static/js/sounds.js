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

    // First tone
    this.osc1.freq(1046.50); // C6
    this.osc1.start();
    this.env1.play(this.osc1);

    // Second tone, slightly delayed and different pitch
    setTimeout(() => {
      this.osc2.freq(1396.91); // F6, or maybe a bit higher like G6 (1567.98 Hz)
      // Let's try a higher, sharper second tone.
      this.osc2.freq(1567.98); // G6
      this.osc2.start();
      this.env2.play(this.osc2);
    }, 100); // Play second tone 100ms after the first starts

    // Calculate total duration to reset 'playing' state
    // The sounds play somewhat concurrently but start at different times.
    // The longest sound will be the second one, starting at 100ms.
    // Its duration is env2.aTime + env2.dTime + env2.rTime
    // let duration1 = this.env1.aTime + this.env1.dTime + this.env1.rTime;
    let duration2 = this.env2.aTime + this.env2.dTime + this.env2.rTime;
    let totalTime = 0.100 + duration2 + 0.1; // 100ms delay + duration of second sound + buffer

    setTimeout(() => {
      // Oscillators are stopped by their envelopes fading to zero amplitude.
      // No need to call osc.stop() explicitly if envelope handles it.
      // However, p5.Oscillator keeps running unless stopped.
      // The envelope controls the *amplitude* sent to the master output.
      // To be clean, we should stop them after their envelopes are done.
      // But for this short sound, it might not be strictly necessary as new sounds will reuse/restart them.
      // Let's try without explicit stop first. If there are issues, add them.
      this.osc1.stop();
      this.osc2.stop();
      this.playing = false;
    }, totalTime * 1000);
  }
}