let mySocket;
let messages;
let login;

let userName;
let currentScene;

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
    textFont('Arial', 16);
    textWrap(WORD);
    textLeading(20);
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
