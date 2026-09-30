// Shown when the server disconnects this screen because the same station connected on another screen. It never
// reloads by itself, so two screens set up as the same station don't keep taking the connection from each other.
class Closed extends Scene {

  constructor() {
    super('closed-scene');
    select('.closed-reload-button').mousePressed(() => location.reload());
    select('.closed-setup-button').mousePressed(() => setupScene.show());
  }

  draw() {
    background(c.bgColor);
  }
}
