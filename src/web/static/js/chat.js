// Over a chat, ghost messages come exponentially more often: every GHOST_DELAY_HALF_LIFE_MS of chat halves the
// silence they wait for, from 30–45 s at the start. Both screens start the chat on the same room event, so they keep
// the same pace.
const GHOST_DELAY_HALF_LIFE_MS = 60 * 1000;
// By then ghost messages come as fast as OpenAI writes them, one at a time. So the finale asks for a burst instead: the
// screen whose visitor is next sends send-ghost-burst, and one OpenAI call writes many messages for both visitors. The
// server sends them one by one, faster and faster, then chat-end. From here on nothing else is sent, ghost or typed.
const FINALE_AT_MS = 5 * 60 * 1000;
// If chat-end never comes, say because the partner's screen froze before asking for the finale, the screen goes home
// this long after the finale started anyway.
const FINALE_MAX_MS = 90 * 1000;
// After chat-end, the screen goes home once it has been this long without a message.
const CHAT_END_HOLD_MS = 6000;

class Chat extends Scene {

  constructor() {
    super('chat-scene');
    this.messages = [];

    this.recipientNameE = select('.recipient-name');
    this.messageInput = select('.chat-input');
    this.sendButton = select('.send-button');
    this.closeButton = select('.home-button');
    this.closeButton.mousePressed(() => {
      socketService.logout();
      location.reload();
    });
    this.sendButton.mousePressed(this.newMessage);

    this.toneController = new ToneController();
    this.bgC = c.bgColor;

    this.sound = new Sound();
  }

  // The newest bubble is the typed message's own prompt, so it's left out.
  get messageHistory() {
    return this.history().slice(-10, -1);
  }

  // A ghost message answers the newest message, so it's included (F5).
  get ghostHistory() {
    return this.history().slice(-10);
  }

  // A bubble that's fading out was never delivered, so the partner never saw it.
  history() {
    return this.messages.filter(message => !message.isFading()).map(message => { return { 'name': message.userName, 'content': message.content } });
  }

  // `station` is the sender's, set by the server. It tells whose message this is, since both visitors can have the same
  // name (P8).
  add(message, newUserName, station, prompt, tone1, tone2, newColor) {
    const isOwn = station === socketService.station;
    this.lastMessageAt = performance.now();
    this.isWaiting = !isOwn;
    this.toneController.addTones(tone1, tone2);

    if (isOwn) {
      let newMessage = this.messages.find((message) => {
        return !message.isFading() && message.content === prompt;
      });
      if (newMessage) {
        newMessage.rephrase(message);
      }
      else {
        this.messages.push(new Message(message, newUserName, station, c.sendMessageBGC2, false));
      }
    }
    else {
      this.sound.newMessage();
      this.messages.push(new Message(message, newUserName, station));
    }
    this.layout();
  }

  // Stacks the bubbles from the bottom of the chat up, newest at the bottom, from their order in this.messages and
  // their current heights. Everything that adds, rewrites or removes a bubble calls it. Moving bubbles by offsets went
  // wrong when a rewrite came back after the partner's next message: the rewritten bubble jumped to the bottom, on top
  // of the partner's (P3).
  layout() {
    let below = null;
    this.messages.slice().reverse().forEach((message) => {
      message.placeAbove(below);
      below = message;
    });
  }

  enter() {
    super.enter();
    this.recipientNameE.elt.textContent = `You are talking to ${recipientName}`;
    this.toneController.setToneValue();
    // Every chat starts the ghost timer afresh (F6). Both times are performance.now() times.
    this.startedAt = performance.now();
    // When the last message was sent or received. A new partner gets the full silence before a ghost message.
    this.lastMessageAt = this.startedAt;
    // True while the partner's message is the newest, so a ghost message may speak for this visitor.
    this.isWaiting = true;
    // Seconds of silence before a ghost message at the start of the chat.
    this.waiting = random(30, 45);
    // True while this screen's ghost message is with the server, so it sends no other.
    this.ghostInFlight = false;
    // Set once this screen has asked for the finale, and once chat-end has come.
    this.finaleRequested = false;
    this.finaleOver = false;
  }

  exit() {
    super.exit();
    this.messages = [];
  }

  draw() {
    background(this.bgC);
    this.toneController.display();

    textFont(MESSAGE_FONT, MESSAGE_TEXT_SIZE);
    this.messages.slice().reverse().forEach((message) => {
      message.display();
    });
    this.removeFadedMessage();

    this.ghostMessage();
    this.endChat();
  }

  // Once a dropped message has faded out, its bubble goes, and the older bubbles above it move down into its place.
  removeFadedMessage() {
    const index = this.messages.findIndex((message) => message.isGone());
    if (index < 0) return;
    this.messages.splice(index, 1);
    this.layout();
  }

  newMessage = () => {
    let message = this.messageInput.value();
    if (message && !this.isFinale()) {
      let newMessage = new Message(message, userName, socketService.station, this.toneController.toneColor);
      this.messages.push(newMessage);
      this.layout();
      const startedAt = this.startedAt;
      socketService.sendMessage(userName, message, this.toneController.tonePayload(), this.messageHistory, (ack) => {
        // The server dropped it, so no rewrite will replace the bubble. It fades out instead of waiting forever.
        if (ack?.delivered === false) {
          newMessage.fadeOut();
          this.takeTurnBack(startedAt);
        }
      });
      this.messageInput.value("");
      this.lastMessageAt = performance.now();
      // The visitor has answered, so no ghost message speaks for them while OpenAI rewrites it (F8).
      this.isWaiting = false;
    }
  }

  // A message from this screen was dropped, so the partner never got it, and it's this visitor's turn again. A ghost
  // message may speak for them after a new silence. The answer to a message from an earlier chat changes nothing.
  takeTurnBack(startedAt) {
    if (startedAt !== this.startedAt) return;
    this.isWaiting = true;
    this.lastMessageAt = performance.now();
  }

  onMessage(data) {
    this.add(data.message, data.userName, data.station, data.prompt, data.tone1, data.tone2, data.color);
  }

  onPartnerLeft() {
    // In the finale the partner's screen has gone home, or is about to. This one follows after the pause. Waiting would
    // pair this visitor again.
    if (this.isFinale()) {
      this.finaleOver = true;
      return;
    }
    waiting.join();
  }

  onReconnect() {
    // The server forgot this chat with the old socket, so in the finale no chat-end would come.
    if (this.isFinale()) {
      location.reload();
      return;
    }
    waiting.join();
  }

  onChatEnd() {
    this.finaleOver = true;
  }

  ghostMessage() {
    if (!this.isWaiting || this.ghostInFlight || this.finaleRequested || this.finaleOver) return;
    if (this.isFinale()) {
      this.finale();
      return;
    }
    // Timed by the clock, not by counting frames at frameRate(), so a slow frame (like the first one after the iPad
    // wakes up) can't send it early. Written so that a NaN waits instead of sending: NaN >= anything is false.
    const silence = performance.now() - this.lastMessageAt;
    if (!(silence >= this.ghostDelay())) return;
    const startedAt = this.startedAt;
    this.ghostInFlight = true;
    socketService.sendGhostMessage(userName, this.toneController.tonePayload(), this.ghostHistory, (ack) => {
      if (startedAt !== this.startedAt) return;
      this.ghostInFlight = false;
      if (ack?.delivered === false) this.takeTurnBack(startedAt);
    });
    this.lastMessageAt = performance.now();
    this.isWaiting = false;
  }

  // Milliseconds of silence before a ghost message. It halves for every GHOST_DELAY_HALF_LIFE_MS between the start of
  // the chat and the start of this silence. Plain Math, like all per-frame maths (see home.js).
  ghostDelay() {
    const elapsed = this.lastMessageAt - this.startedAt;
    return this.waiting * 1000 * Math.pow(0.5, elapsed / GHOST_DELAY_HALF_LIFE_MS);
  }

  // Asks for the burst that ends the chat, for both visitors, starting with this one. Only a screen whose visitor is
  // next asks, once its own last ghost message is back. If both screens ask, the server takes the first.
  finale() {
    this.finaleRequested = true;
    socketService.sendGhostBurst(userName, this.toneController.tonePayload(), this.ghostHistory);
  }

  // After FINALE_AT_MS only the finale is sent. A NaN keeps the chat going: NaN >= anything is false.
  isFinale() {
    return performance.now() - this.startedAt >= FINALE_AT_MS;
  }

  // After chat-end the screen goes home once CHAT_END_HOLD_MS have passed without a message, so the burst's last
  // message stays up for a moment. The reload opens Home afresh. It also closes the socket, so the server ends the
  // pairing and the partner gets userdisconnect, which the finale ignores.
  endChat() {
    if (!this.isFinale()) return;
    const now = performance.now();
    const overdue = now - this.startedAt >= FINALE_AT_MS + FINALE_MAX_MS;
    if (!this.finaleOver && !overdue) return;
    if (!(now - this.lastMessageAt >= CHAT_END_HOLD_MS)) return;
    location.reload();
  }
}
