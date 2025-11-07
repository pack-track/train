import { SectionPosition, Span } from "@packtrack/layout";
import { MeasuredPosition } from "./measured-location";
import { PredictedPosition } from "./predicted-location";
import { Railcar } from "./railcar";
import { Traction } from "./railcar/traction";
import { SpeedPermit } from "./speed-permit";
import { Coupler } from "./railcar/coupler";
import { TrainChain } from "./chain";

export class Train {
	lastPositioner: MeasuredPosition;

	railcars: Railcar[] = [];
	changed: Date;

	speedPermits: SpeedPermit[] = [];

	constructor(
		public identifier: string,
		public chain: TrainChain,
		public created: Date,
		position: SectionPosition,
		public reversed: boolean
	) {
		// convert the initial position into a measurement
		// PackTrack msut assume that this data is correct
		this.lastPositioner = new MeasuredPosition(new Date(), position, reversed, 0);

		// set an empty speed permit until one is set
		this.permit(0);
	}

	permit(speed: number, issued = new Date()) {
		this.speedPermits.push(new SpeedPermit(issued, speed, this));
	}

	get railcarCount(): number {
		return this.railcars.length;
	}

	get coupledLength(): number {
		let sum = 0;

		for (let unit of this.railcars) {
			sum += unit.length;
		}

		return sum;
	}

	get headCoupler() {
		return this.railcars.at(0).head.coupler;
	}

	get headCouplerType() {
		return this.headCoupler?.type;
	}

	get tailCoupler() {
		return this.railcars.at(-1).tail.coupler;
	}

	get tailCouplerType() {
		return this.tailCoupler?.type;
	}

	// the traction unit with the least acceleration
	get maximalAcceleration() {
		const accelerators: Traction[] = [];

		for (let railcar of this.railcars) {
			accelerators.push(...railcar.traction);
		}

		// trains without traction
		if (accelerators.length == 0) {
			return 0;
		}

		accelerators.sort((a, b) => a.maximalAcceleration - b.maximalAcceleration);

		return accelerators[0].maximalAcceleration;
	}

	// average of all deccelerations
	get maximumDeceleration() {
		let total = 0;

		for (let railcar of this.railcars) {
			total += railcar.maximalDeceleration;
		}

		return total / this.railcars.length;
	}

	get currentSpeedPermit() {
		return this.speedPermits.at(-1);
	}

	// speed the train should be going right now
	get currentSpeed() {
		return this.currentSpeedPermit.getSpeed();
	}

	// calculates the current head location based on the trains last known position measurement
	get head() {
		if (!this.lastPositioner) {
			return;
		}

		let distance = 0;

		const firstPermit = this.speedPermits.findIndex(permit => permit.issued > this.lastPositioner.time) - 1;

		for (let permitIndex = Math.max(firstPermit, 0); permitIndex < this.speedPermits.length; permitIndex++) {
			const current = this.speedPermits[permitIndex];
			const next = this.speedPermits[permitIndex + 1];

			distance += current.getDistance(next?.issued ?? new Date());
		}

		const nominalHead = this.lastPositioner.head.advance(distance);

		return new PredictedPosition(
			this.lastPositioner.head,
			nominalHead,
			nominalHead.advance(distance / 2)
		);
	}

	get tail() {
		const head = this.head;
		const length = this.coupledLength;

		return new PredictedPosition(
			head.minimal.advance(-length),
			head.nominal.advance(-length),
			head.maximal.advance(-length)
		)
	}

	nominalTrail() {
		const head = this.head.nominal;

		return head.section.trail(head.offset, this.reversed, -this.coupledLength);
	}

	// the range where the train could be
	//
	// there can only ever be one train in one span
	// no route can ever change within this span
	span() {
		return Span.trail(this.tail.minimal, this.head.maximal);
	}

	split(coupler: Coupler) {
		const targetHeadIndex = this.railcars.findIndex(unit => unit.head.coupler && unit.head.coupler == coupler);

		if (targetHeadIndex != -1) {
			return {
				before: this.railcars.slice(0, targetHeadIndex),
				after: this.railcars.slice(targetHeadIndex)
			}
		}

		const targetTailIndex = this.railcars.findIndex(unit => unit.tail.coupler && unit.tail.coupler == coupler);

		if (targetTailIndex != -1) {
			return {
				before: this.railcars.slice(0, targetTailIndex + 1),
				after: this.railcars.slice(targetTailIndex + 1)
			}
		}

		throw new Error(`Coupler of '${coupler.railcar.identifier}' not in train '${this.identifier}'`);
	}

	reverse() {
		this.railcars.reverse();

		for (let railcar of this.railcars) {
			const coupler = railcar.head;
			railcar.head = railcar.tail;
			railcar.tail = coupler;
		}
	}
}
