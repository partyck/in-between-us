let mySocket;

function setup() {
    createCanvas(windowWidth, windowHeight);
    mySocket = new MySocket();
    background(color(0));

    createInputArea();

}

function draw() {
}

function createInputArea() {

    // let form = createElement('form');
    // form.addClass('msger-inputarea');
    // form.id('form');
    // form.position(0, height - 60);
    // Create the input and button in the canvas.
    let nameInput = createInput();
    nameInput.position(0, height - 100);
    nameInput.size(width - 100, 50);
    // nameInput.addClass('msger-input');
    // nameInput.parent('form');

    let button = createButton('submit');
    button.addClass('msger-send-btn');
    // button.parent('form');
    button.position(nameInput.x + nameInput.width, height - 200);

    // Use the mousePressed() method to call the greet()
    // function when the button is pressed.
    button.mousePressed(newMessage);

    // Also call greet when input is changed and enter/return button is pressed
    nameInput.changed(newMessage);
}

function newMessage() {

}

function mouseReleased() {
    stroke(255);
    fill(255, 0, 0);
    ellipse(mouseX, mouseY, 50, 50);
    mySocket.emitClick(mouseX, mouseY);
}