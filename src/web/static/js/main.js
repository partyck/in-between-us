let socketService;
let home;
let login;
let waiting;
let chat;
let c;

let userName;
let recipientName;
let currentScene;
let timerToRefresh = 60 * 60;


const SCENES = Object.freeze({
  HOME: Symbol("Home"),
  LOGIN: Symbol("Login"),
  CHAT: Symbol("Chat"),
  WAITING: Symbol("Waiting")
});

function setup() {
  createCanvas(windowWidth, windowHeight);
  textFont('Arial', 16);
  textWrap(WORD);
  textLeading(20);
  init();
}

function init() {
  c = new Constants();
  socketService = new SocketService();
  home = new Home();
  login = new LoginScene();
  waiting = new Waiting();
  chat = new Chat();
  changeScene(SCENES.HOME);
}

function draw() {
  switch (currentScene) {
    case SCENES.HOME:
      home.display();
      break;
    case SCENES.LOGIN:
      login.display();
      updateTimer();
      break;
    case SCENES.WAITING:
      waiting.display();
      updateTimer();
      break;
    case SCENES.CHAT:
      chat.display();
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
    case SCENES.LOGIN:
      login.show();
      break;
    case SCENES.WAITING:
      waiting.show();
      break;
    case SCENES.CHAT:
      chat.show();
      break;
    default:
      break;
  }
  currentScene = newScene;
  timerToRefresh = 60 * 60;
}

function backHome() {
  userName = null;
  recipientName = null;
  init();
}

function updateTimer() {
  if (timerToRefresh < 0) {
    location.reload();
  }
  else {
    timerToRefresh--;
  }
}

