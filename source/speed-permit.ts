import { Train } from "./train";

export class SpeedPermit {
	// controls how long a permit is usually valid
	// a new permit should be submited in this interval
	static validity = 1 * 1000;

	// controls the time before breaking is initiated
	static hold = 0.5 * 1000;

	// controls how much of the maximum deceleration is applied after the hold timeout
	static breakingFactor = 0.1;

	// controls the time until full breaking is enabled
	static emergency = 5 * 1000;

	constructor(
		public issued: Date,
		public speed: number,
		public train: Train
	) {}

	getSpeed(now = new Date()) {
		const elapsed = +now - +this.issued;

		if (elapsed < SpeedPermit.validity + SpeedPermit.hold) {
			return this.speed;
		}

		if (elapsed < SpeedPermit.validity + SpeedPermit.hold + SpeedPermit.emergency) {
			return Math.max(this.speed - this.defaultBreakingDeceleration * (elapsed / 1000), 0);
		}

		return Math.max(this.speed - this.train.maximumDeceleration * (elapsed / 1000), 0);
	}

	get defaultBreakingDeceleration() {
		return this.train.maximumDeceleration * SpeedPermit.breakingFactor;
	}

	getDistance(now = new Date()) {
		let elapsed = +now - +this.issued;

		let distance = 0;
		let speed = this.speed;

		// constant speed
		if (elapsed > 0) {
			const constantTime = Math.min(elapsed, SpeedPermit.validity + SpeedPermit.hold);
			distance += speed * constantTime / 1000;

			elapsed -= SpeedPermit.validity + SpeedPermit.hold;
		}

		// breaking
		if (elapsed > 0) {
			const breakingTime = Math.min(elapsed, SpeedPermit.emergency);

			const finalSpeed = Math.max(speed - this.defaultBreakingDeceleration * breakingTime / 1000, 0);
			distance += (speed + finalSpeed) / 2 * breakingTime / 1000;

			elapsed -= SpeedPermit.emergency;
			speed = finalSpeed;
		}

		// emergency breaking
		if (elapsed > 0) {
			const timeToStop = speed / this.train.maximumDeceleration;
			const breakingTime = Math.min(timeToStop, elapsed);

			const finalSpeed = Math.max(speed - this.train.maximumDeceleration * breakingTime / 1000, 0);
			distance += (speed + finalSpeed) / 2 * breakingTime / 1000;
		}

		return distance;
	}
}
