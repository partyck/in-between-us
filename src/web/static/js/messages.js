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

    add(message, newUserName, prompt) {
        if (newUserName === userName) {
            let newMessage = this.messages.find((message) => {
                return message.content === prompt;
            });
            if (newMessage) {
                let distance = newMessage.rephrase(message);
                this.messages.forEach((message) => {
                    if (message.content !== newMessage.content) {
                        message.y = message.y + distance;
                    }
                });
            }
        } else {
            let newMessage = new Message(message, newUserName)
            this.messages.forEach((message) => { message.move(newMessage.height) });
            this.messages.push(newMessage);
        }
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
            let newMessage = new Message(message, userName);
            messages.messages.forEach((message) => { message.move(newMessage.height) });
            messages.messages.push(newMessage);

            let messageHistory = messages.messages.slice(-10).map(message => { return { 'name': message.userName, 'content': message.content } });
            mySocket.sendMessage(userName, message, messageHistory);
            messages.messageInput.value("");
        }
    }
}
