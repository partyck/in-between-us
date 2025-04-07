let socketService;
let home;
let login;
let waiting;
let chat;
let c;

let userName;
let recipientName;
let currentScene;

const SCENES = Object.freeze({
  HOME: Symbol("Home"),
  LOGIN: Symbol("Login"),
  CHAT: Symbol("Chat"),
  WAITING: Symbol("Waiting")
});

function setup() {
  createCanvas(windowWidth, windowHeight);
  c = new Constants();
  socketService = new SocketService();
  home = new Home();
  changeScene(SCENES.HOME);
  textFont('Arial', 16);
  textWrap(WORD);
  textLeading(20);
}

function draw() {
  switch (currentScene) {
    case SCENES.HOME:
      home.display();
      break;
    default:
      break;
  }
}

function changeScene(newScene) {
  switch (newScene) {
    case SCENES.HOME:
      home.show();
      break;
    default:
      break;
  }
  currentScene = newScene;
}
