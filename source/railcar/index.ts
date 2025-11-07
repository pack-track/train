import { Train } from "../train";
import { Coupler } from "./coupler";
import { Traction } from "./traction";
import { Channel } from '@packtrack/layout';

export type RailcarEnd = {
	coupler: Coupler;
	target?: Railcar;
}

export class Railcar {
	// beware head / tail reference the current orientation of the railcar
	// headCoupler / tailCoupler reference the railcar regardless of the current arrangement in a train
	public head: RailcarEnd;
	public tail: RailcarEnd;

	traction: Traction[] = [];
	controllers: Channel[] = [];

	constructor(
		public identifier: string,

		// over couplers
		public length: number,

		// how fast it can be pulled
		public maximalSpeed: number,

		// breaking power
		public maximalDeceleration: number,

		public train: Train,

		// couplers, regardless of train arrangement
		public headCoupler: Coupler,
		public tailCoupler: Coupler
	) {
		this.head = { coupler: headCoupler };
		this.tail = { coupler: tailCoupler };
	}

	get reversed() {
		return this.headCoupler != this.head.coupler;
	}
}
