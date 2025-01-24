let messageInput;
let userName;

let mySocket;
let messages;
let messagesHeight;

function setup() {
    createCanvas(windowWidth, windowHeight);
    mySocket = new MySocket();
    messages = new Messages();
    createLoginArea();
    messagesHeight = height * 0.9 - 30;
}

function draw() {
    background(50);
    messages.display();
}

function createLoginArea() {
    let loginButton = createButton('login');
    loginButton.position(width * 0.25, height * 0.3);
    loginButton.size(width * 0.5, height * 0.1);
    let container = createDiv();
    container.id('form');
    container.hide();

    let lablelE = createP('tell me your name... ');
    lablelE.position(width * 0.25, height * 0.45);
    lablelE.parent(container);

    let inputE = createInput();
    inputE.position(width * 0.25, height * 0.5);
    inputE.size(width * 0.5, 20);
    inputE.parent(container);

    let submitButton = createButton('ok');
    submitButton.position(width * 0.25, height * 0.5 + 30);
    submitButton.size(width * 0.5, 20);
    submitButton.parent(container);

    loginButton.mousePressed(() => {
        if (loginButton.html() === 'login') {
            container.show();
            loginButton.html('hide');
        }
        else {
            container.hide();
            loginButton.html('login');
        }
    });

    submitButton.mousePressed(() => {
        if (inputE.value()) {
            userName = inputE.value();
            container.hide();
            loginButton.hide();
            createInputArea();
        }
    });
}

function createInputArea() {
    messageInput = createElement('textarea');
    messageInput.position(width * 0.05, height * 0.9);
    messageInput.size(width * 0.7, 50);

    let sendButton = createButton('send');
    sendButton.position(messageInput.x + messageInput.width + width * 0.05, height * 0.9);
    sendButton.size(width * 0.15, 50);

    sendButton.mousePressed(newMessage);
    messageInput.changed(newMessage);
}

function newMessage() {
    let message = messageInput.value();
    if (message) {
        mySocket.sendMessage(userName, message);
        messageInput.value("");
    }
}
