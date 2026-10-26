// A screen of the app. Each scene owns one root element in index.html, which is shown while the scene is current.
// Scenes can also handle socket events by defining onConnect, onRoom, onMessage, onPartnerLeft, onChatEnd or
// onReconnect.
class Scene {
  constructor(rootId) {
    this.root = select(`#${rootId}`);
  }

  enter() {
    this.root.removeClass('hidden');
  }

  exit() {
    this.root.addClass('hidden');
  }

  // Called every frame while the scene is current. It runs between push() and pop(), so any drawing state it sets
  // (rectMode, textSize, colorMode...) is undone before the next frame.
  draw() { }
}
