const SIDE = Object.freeze({
    RECEIVER: Symbol("Receiver"),
    SENDER: Symbol("Sender")
});

class Messages {

    constructor() {
        this.messages = [];
    }

    add(message, newUserName) {
        this.messages.push(new Message(message, newUserName));
    }

    display() {
        this.messages.slice().reverse().forEach((message, index) => {
            message.display(index);
        });
    }
}

class Message {
    constructor(content, newUserName) {
        this.content = content;
        this.side = newUserName === userName ? SIDE.SENDER : SIDE.RECEIVER;
        if (this.side === SIDE.SENDER) {
            this.strokeColor = color(20, 100, 200);
        } else {
            this.strokeColor = color(200, 200, 200);
        }
    }

    display(index) {
        textWrap(WORD);
        stroke(this.strokeColor);
        fill(this.strokeColor);
        text(this.content, 10, messagesHeight - height * 0.1 * index, width * 0.8);
    }
}