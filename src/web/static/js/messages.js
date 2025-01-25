const SIDE = Object.freeze({
    RECEIVER: Symbol("Receiver"),
    SENDER: Symbol("Sender")
});

class Messages {

    constructor() {
        this.messages = [];
        this.textAreaContainer = createDiv();
        this.textAreaContainer.id('textAreaContainer');
        this.textAreaContainer.hide();

        this.messageInput = createElement('textarea');
        this.messageInput.position(width * 0.4, height * 0.9);
        this.messageInput.size(width * 0.65, 50);
        this.messageInput.class('chat-input');
        this.messageInput.parent(this.textAreaContainer);

        let sendButton = createButton('send');
        sendButton.position(width * 0.9, height * 0.9);
        sendButton.size(width * 0.2, 50);
        sendButton.parent(this.textAreaContainer);
        sendButton.class('send-button');

        sendButton.mousePressed(this.newMessage);
        this.messageInput.changed(this.newMessage);
    }

    add(message, newUserName) {
        this.messages.push(new Message(message, newUserName));
    }

    show() {
        this.textAreaContainer.show();
    }

    display() {
        background(50);
        this.messages.slice().reverse().forEach((message, index) => {
            message.display(index);
        });
    }

    newMessage() {
        let message = messages.messageInput.value();
        if (message) {
            mySocket.sendMessage(userName, message);
            messages.messageInput.value("");
        }
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
        fill(this.strokeColor);
        text(this.content, 10, messagesHeight - height * 0.1 * index, width * 0.8);
    }
}