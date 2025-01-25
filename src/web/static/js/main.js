let mySocket;
let messages;
let login;

let userName;
let currentScene;

let messagesHeight;

const SCENES = Object.freeze({
    LOGIN: Symbol("Login"),
    CHAT: Symbol("Chat")
});

function setup() {
    createCanvas(windowWidth, windowHeight);
    mySocket = new MySocket();
    messages = new Messages();
    login = new LoginScene();
    currentScene = SCENES.LOGIN;
    messagesHeight = height * 0.9 - 30;
    textFont('Arial', 16);
}

function draw() {
    switch (currentScene) {
        case SCENES.LOGIN:
            login.display();
            break;
        case SCENES.CHAT:
            messages.display();
            break;
        default:
            break;
    }
}
