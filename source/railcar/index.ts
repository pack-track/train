import { Train } from "../train";
import { Coupler } from "./coupler";
import { Traction } from "./traction";
import { Channel } from '@packtrack/layout';

export class Railcar {
	coupler: {
		head?: Coupler,
		tail?: Coupler
	} = {};

	traction: Traction[] = [];
	controllers: Channel[] = [];

	constructor(
		public name: string,

		// over couplers
		public length: number,

		// how fast it can be pulled
		public maximalSpeed: number,

		// breaking power
		public maximalDeceleration: number,

		public train: Train
	) { }
}
