const CREDENTIALS_STORAGE_KEY = 'station';

// Chooses which installation this screen is, and takes the station key the server checks. The iPads run the page as
// a home-screen app, which always opens at the manifest's start_url, so the choice is kept in localStorage. A
// home-screen app's storage is separate from Safari's, so set it up from inside the app.
class Setup extends Scene {

  constructor() {
    super('setup-scene');
    this.keyInput = select('#station-key-input');
    this.message = select('.setup-message');
    this.stationButtons = selectAll('.station-button');
    this.stationButtons.forEach((button) => {
      button.mousePressed(() => this.chooseStation(button.attribute('data-station')));
    });
    select('.setup-save-button').mousePressed(this.save);
    this.keyInput.elt.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') this.save();
    });
    this.chooseStation(this.savedCredentials()?.station);
  }

  draw() {
    background(c.bgColor);
  }

  // A /#station=A&key=… URL wins over the saved station, e.g. to test both stations in two tabs of one browser.
  savedCredentials() {
    const params = new URLSearchParams(location.hash.slice(1));
    if (params.get('station') && params.get('key')) {
      return { station: params.get('station'), key: params.get('key') };
    }
    try {
      return JSON.parse(localStorage.getItem(CREDENTIALS_STORAGE_KEY));
    } catch (error) {
      return null;
    }
  }

  show(message = '') {
    this.message.elt.textContent = message;
    changeScene(this);
  }

  chooseStation(station) {
    this.station = station;
    this.stationButtons.forEach((button) => {
      button.elt.classList.toggle('selected', button.attribute('data-station') === station);
    });
  }

  save = () => {
    let key = this.keyInput.value().trim();
    if (!this.station || !key) {
      this.message.elt.textContent = 'Choose a station and enter the key.';
      return;
    }
    let credentials = { station: this.station, key };
    try {
      localStorage.setItem(CREDENTIALS_STORAGE_KEY, JSON.stringify(credentials));
    } catch (error) {
      console.log('could not save the station:', error);
    }
    // A station in the URL would win over the saved one on the next load.
    history.replaceState(null, '', location.pathname + location.search);
    this.keyInput.elt.blur();
    this.message.elt.textContent = 'Connecting…';
    socketService.connect(credentials);
  }

  // The server accepted the station and key. A refusal comes back through setupScene.show() instead.
  onConnect() {
    this.keyInput.value('');
    changeScene(home);
  }
}
