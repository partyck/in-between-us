class Message {
	constructor(content, newUserName, bgColor = c.receivedMessageC, isWaiting = true) {
		this.MAX_MESSAGE_WIDTH = width * 0.8;
		this.MAX_MESSAGE_HEIGHT = height - 100 - height * 0.05 - 30;
		this.content = content;
		this.userName = newUserName;
		this.calculateTextWidthAndHeight();
		this.y = this.MAX_MESSAGE_HEIGHT - this.height;
		this.animation_s = 80;
		this.bgColor = bgColor;

		if (this.userName === userName) {
			this.x = this.width < this.MAX_MESSAGE_WIDTH ? width - this.width - 10 : width - this.MAX_MESSAGE_WIDTH - 10;
			this.strokeColor = color(255);
			this.waiting = isWaiting;
		} else {
			this.x = 10;
			this.strokeColor = color(10);
			this.waiting = false;
		}
	}

	rephrase(newContent) {
		this.waiting = false;
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
		const padding = 8;
		let currentFillColor;
		let rectX, rectY, rectW, rectH;

		// Calculate base rectangle dimensions with padding
		const baseRectX = this.x - padding;
		const baseRectY = this.y - padding;
		const baseRectW = this.width + (padding * 2);
		const baseRectH = this.height + (padding * 2);

		if (this.animation_s > 0) {
			let increment = (100 - this.animation_s) / 100;
			currentFillColor = lerpColor(color("#585656"), this.bgColor, increment);

			rectX = baseRectX + this.width / 2 * (1 - increment);
			rectY = baseRectY;
			rectW = baseRectW * increment;
			rectH = baseRectH;

			fill(currentFillColor);
			rect(rectX, rectY, rectW, rectH, 15, 15, 15, 15);
			this.animation_s--;

		} else if (this.waiting) {
			const segments = 50;
			const interFactor = (sin(frameCount * 0.02) + 1) / 2;
			let currentColor1 = lerpColor(this.bgColor, color(255), interFactor);
			let currentColor2 = lerpColor(color(255), this.bgColor, interFactor);

			for (let index = segments; index > 0; index--) {
				let increment = index / segments;
				currentFillColor = lerpColor(currentColor1, currentColor2, increment);

				rectX = baseRectX + this.width / 2 * (1 - increment);
				rectY = baseRectY;
				rectW = baseRectW * increment;
				rectH = baseRectH;

				fill(currentFillColor);
				rect(rectX, rectY, rectW, rectH, 15, 15, 15, 15);
			}
			fill(this.strokeColor);
			text(this.content, this.x, this.y, this.MAX_MESSAGE_WIDTH);

		} else {
			currentFillColor = this.bgColor;
			rectX = baseRectX;
			rectY = baseRectY;
			rectW = baseRectW;
			rectH = baseRectH;

			fill(currentFillColor);
			rect(rectX, rectY, rectW, rectH, 15, 15, 15, 15);
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
