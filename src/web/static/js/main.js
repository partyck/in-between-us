let socketService;
let home;
let login;
let chat;

let userName;
let currentScene;

const SCENES = Object.freeze({
	HOME: Symbol("Home"),
	LOGIN: Symbol("Login"),
	CHAT: Symbol("Chat")
});

function setup() {
	createCanvas(windowWidth, windowHeight);
	socketService = new SocketService();
	home = new Home();
	login = new LoginScene();
	chat = new Chat();
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
		case SCENES.LOGIN:
			login.display();
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
		case SCENES.CHAT:
			chat.show();
			break;
		default:
			break;
	}
	currentScene = newScene;
}
