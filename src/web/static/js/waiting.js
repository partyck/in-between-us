class Waiting extends Scene {

  constructor() {
    super('waiting-scene');
    this.waitingText = select('.waiting-text');
  }

  draw() {
    background(c.bgColor);
    let buttonHue = frameCount % 360;
    this.waitingText.style("text-shadow", `2px 2px 9px hsl(${buttonHue}deg 100 50)`);
    updateTimer();
  }

  // Shows the waiting screen and asks the server for a partner.
  join() {
    changeScene(this);
    socketService.login(userName);
  }

  onRoom(room) {
    if (room.userA.station === socketService.station) {
      recipientName = room.userB.userName;
    }
    else {
      recipientName = room.userA.userName;
    }
    changeScene(chat);
  }

  // A reconnect gets a new session id, so the server no longer knows this client: queue up again.
  onReconnect() {
    this.join();
  }
}
