const MARGIN = 20;
const PADDING = 30;

class Message {
	constructor(content, newUserName, bgColor = c.receivedMessageC, isWaiting = true) {
		this.MAX_MESSAGE_WIDTH = width * 0.8;
		this.MAX_MESSAGE_HEIGHT = height - 100 - height * 0.05 - 40;
		this.content = content;
		this.bgColor = bgColor;
		this.calculateTextWidthAndHeight();
		this.y = this.MAX_MESSAGE_HEIGHT - this.height * 0.5;
		this.animation_s = 80;
		this.fromSender = newUserName === userName;
		this.osc = 1;
		this.userName = newUserName;

		if (this.fromSender) {
			this.x = this.width < this.MAX_MESSAGE_WIDTH ? width - this.width * 0.5 - MARGIN : width - this.MAX_MESSAGE_WIDTH * 0.5 - MARGIN;
			this.strokeColor = color(255);
			this.waiting = isWaiting;
		} else {
			this.x = this.width < this.MAX_MESSAGE_WIDTH ? this.width * 0.5 + MARGIN : this.MAX_MESSAGE_WIDTH * 0.5 + MARGIN;
			this.strokeColor = color(255);
			this.waiting = false;
		}
	}

	rephrase(newContent) {
		this.waiting = false;
		this.content = newContent;
		let old_height = this.height;
		this.calculateTextWidthAndHeight();
		this.y = this.MAX_MESSAGE_HEIGHT - this.height * 0.5;
		this.x = this.width < this.MAX_MESSAGE_WIDTH ? width - this.width * 0.5 - MARGIN : width - this.MAX_MESSAGE_WIDTH * 0.5 - MARGIN;
		this.animation_s = 50;
		this.bgColor = c.sendMessageBGC2;
		this.strokeColor = color(255);
		return old_height - this.height;
	}

	move(displacement) {
		this.y = this.y - (displacement) - PADDING * 2;
	}

	display() {
		noStroke();
		if (this.animation_s > 0) {
			let increment = (100 - this.animation_s) / 100;
			this.animation_s--;

			const currentFillColor = lerpColor(color("#585656"), this.bgColor, increment);

			const rectW = (this.width + (PADDING * 2)) * increment;
			const rectH = this.height + (PADDING * 2);
			this.drawBubble(rectW, rectH, currentFillColor);
			return;
		}

		if (this.waiting) {
			const currentFillColor = lerpColor(this.bgColor, color("#0059ffff"), this.osc);
			this.osc = (sin(frameCount * 0.01) + 1) / 2;

			const rectW = this.width + (PADDING * 2);
			const rectH = this.height + (PADDING * 2);
			this.drawBubble(rectW, rectH, currentFillColor);
			this.drawText();
			return;
		}
		const rectW = this.width + (PADDING * 2);
		const rectH = this.height + (PADDING * 2);
		this.drawBubble(rectW, rectH, this.bgColor);
		this.drawText();
	}

	drawBubble(w, h, color) {
		color.setAlpha(10);
		fill(color);
		const steps = 50;
		for (let i = 0; i < steps; i++) {
			const rectHeight = h * i / steps;
			const rectWidth = (w - h) + rectHeight;
			rect(this.x, this.y, rectWidth, rectHeight, 30);
		}
	}

	drawText() {
		fill(this.strokeColor);
		const textX = this.x - this.width * 0.5;
		const textY = this.y - this.height * 0.5;
		push();
		rectMode(CORNER);
		text(this.content, textX, textY, this.MAX_MESSAGE_WIDTH);
		pop();
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
	}
}
