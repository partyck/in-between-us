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
  changeScene(home);
}

function draw() {
  // pop() undoes whatever drawing state the scene set, so it can't leak into another scene.
  push();
  currentScene.draw();
  pop();
  // console.log(frameRate());
}

function changeScene(newScene) {
  currentScene?.exit();
  currentScene = newScene;
  currentScene.enter();
  timerToRefresh = 60 * 60;
}

function updateTimer() {
  if (timerToRefresh < 0) {
    location.reload();
  }
  else {
    timerToRefresh--;
  }
}

