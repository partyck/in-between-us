class Message {
	constructor(content, newUserName) {
		this.MAX_MESSAGE_WIDTH = width * 0.8;
		this.MAX_MESSAGE_HEIGHT = height * 0.8;
		this.content = content;
		this.userName = newUserName;
		this.calculateTextWidthAndHeight();
		this.y = this.MAX_MESSAGE_HEIGHT - this.height;
		this.animation_s = 80;

		if (this.userName === userName) {
			this.x = this.width < this.MAX_MESSAGE_WIDTH ? width - this.width - 10 : width - this.MAX_MESSAGE_WIDTH - 10;
			this.bgColor = c.sendMessageBGC1;
			this.strokeColor = color(255);
		} else {
			this.x = 10;
			this.bgColor = c.receivedMessageC;
			this.strokeColor = color(10);
		}
	}

	rephrase(newContent) {
		this.content = newContent;
		let old_height = this.height;
		this.calculateTextWidthAndHeight();
		this.y = this.MAX_MESSAGE_HEIGHT - this.height;
		this.x = this.width < this.MAX_MESSAGE_WIDTH ? width - this.width - 10 : width - this.MAX_MESSAGE_WIDTH - 10;
		this.animation_s = 50;
		this.bgColor = c.sendMessageBGC2;
		this.strokeColor = color(255);
		return old_height - this.height;
	}

	move(displacement) {
		this.y = this.y - (displacement) - 20;
	}

	display() {
		noStroke();
		if (this.animation_s > 0) {
			let increment = (100 - this.animation_s) / 100;
			fill(lerpColor(color("#585656"), this.bgColor, increment));
			let padding = 8;
			rect((this.x - padding) + this.width / 2 * (1 - increment), this.y - padding, (this.width + (padding * 2)) * increment, this.height + (padding * 2), 15, 15, 15, 15);
			this.animation_s--;
		}
		else {
			fill(this.bgColor);
			let padding = 8;
			rect(this.x - padding, this.y - padding, this.width + (padding * 2), this.height + (padding * 2), 15, 15, 15, 15);
			fill(this.strokeColor);
			text(this.content, this.x, this.y, this.MAX_MESSAGE_WIDTH);
		}

	}

	calculateTextWidthAndHeight() {
		const lines = this.content.split('\n');
		let lineCount = 0;
		let maxWidth = 0;

		lines.forEach((paraf) => {
			const words = paraf.split(' ');
			let line = '';

			for (let i = 0; i < words.length; i++) {
				const testLine = line + words[i] + ' ';
				const testLineWidth = textWidth(testLine);

				if (testLineWidth > this.MAX_MESSAGE_WIDTH) {
					line = words[i] + ' ';
					lineCount++;
					maxWidth = this.MAX_MESSAGE_WIDTH;
				} else {
					line = testLine;
				}
			}

			if (line !== '') {
				lineCount++;
				maxWidth = Math.max(maxWidth, textWidth(line));
			}
		});

		this.height = lineCount * textLeading();
		this.width = maxWidth;

		return lineCount * textLeading();
	}
}
