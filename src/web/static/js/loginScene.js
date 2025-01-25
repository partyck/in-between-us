class LoginScene {

    constructor() {
        this.loginButton = createButton('Welcome');
        this.loginButton.position(width * 0.5, height * 0.3);
        this.loginButton.size(width * 0.5, height * 0.1);
        this.loginButton.class('login-button');
        this.container = createDiv();
        this.container.id('form');
        this.container.hide();

        let inputE = createInput();
        inputE.position(width * 0.5, height * 0.5);
        inputE.parent(this.container);
        inputE.class('name-input');
        inputE.attribute('placeholder', 'Tell me your name... ');

        this.submitButton = createButton('ok');
        this.submitButton.position(width * 0.5, height * 0.6);
        this.submitButton.size(width * 0.5, 50);
        this.submitButton.class('login-button');
        this.submitButton.parent(this.container);

        this.loginButton.mousePressed(() => {
            if (this.loginButton.html() === 'Welcome') {
                this.container.show();
                this.loginButton.html('back');
            }
            else {
                background(50);
                this.container.hide();
                this.loginButton.html('Welcome');
            }
        });

        this.submitButton.mousePressed(() => {
            if (inputE.value()) {
                userName = inputE.value();
                this.container.hide();
                this.loginButton.hide();
                colorMode(RGB);
                messages.show();
                currentScene = SCENES.CHAT;
            }
        });

    }

    display() {
        background(50);
        colorMode(HSL);
        let buttonHue = frameCount % 360;
        if (this.loginButton.html() === 'Welcome') {
            this.loginButton.style("background-color", `hsl(${buttonHue}deg 100 50)`);
        }
        else {
            this.loginButton.style("background-color", `#0037ae`);
            this.submitButton.style("background-color", `hsl(${buttonHue}deg 100 50)`);
        }

    }

}