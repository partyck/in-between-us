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
        let newMessage = new Message(message, newUserName)
        this.messages.forEach((message) => { message.move(newMessage.height) });
        this.messages.push(newMessage);
    }

    show() {
        this.textAreaContainer.show();
    }

    display() {
        background(50);
        this.messages.slice().reverse().forEach((message) => {
            message.display();
        });
    }

    newMessage() {
        let message = messages.messageInput.value();
        if (message) {
            let messageHistory = messages.messages.slice(-10).map(message => { return { 'name': message.userName, 'content': message.content } });
            mySocket.sendMessage(userName, message, messageHistory);
            messages.messageInput.value("");
        }
    }
}

class Message {
    constructor(content, newUserName) {
        this.MAX_MESSAGE_WIDTH = width * 0.8;
        this.MAX_MESSAGE_HEIGHT = height * 0.8;
        this.content = content;
        this.userName = newUserName;
        this.calculateTextWidthAndHeight();
        this.y = this.MAX_MESSAGE_HEIGHT - this.height;

        if (this.userName === userName) {
            this.x = this.width < this.MAX_MESSAGE_WIDTH ? width - this.width - 10 : width - this.MAX_MESSAGE_WIDTH - 10;
            this.strokeColor = color(20, 100, 200);
        } else {
            this.x = 10;
            this.strokeColor = color(150, 150, 150);
        }
    }

    move(displacement) {
        this.y = this.y - displacement - 20;
    }

    display() {
        fill(this.strokeColor);
        noStroke();
        let padding = 8;
        rect(this.x - padding, this.y - padding, this.width + (padding * 2), this.height + (padding * 2), 15, 15, 15, 15);
        fill(255);
        text(this.content, this.x, this.y, this.MAX_MESSAGE_WIDTH);
    }

    calculateTextWidthAndHeight() {
        const lines = this.content.split('\n');
        let lineCount = 0;
        let maxWidth = 0;

        lines.forEach((paraf) => {
            const words = paraf.split(' ');
            let line = '';

            for (let i = 0; i < words.length; i++) {
                const testLine = line + words[i] + ' ';
                const testLineWidth = textWidth(testLine);

                if (testLineWidth > this.MAX_MESSAGE_WIDTH) {
                    line = words[i] + ' ';
                    lineCount++;
                    maxWidth = this.MAX_MESSAGE_WIDTH;
                } else {
                    line = testLine;
                }
            }

            if (line !== '') {
                lineCount++;
                maxWidth = Math.max(maxWidth, textWidth(line));
            }
        });

        this.height = lineCount * textLeading();
        this.width = maxWidth;

        return lineCount * textLeading();
    }
}