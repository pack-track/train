import { CouplerType } from "./coupler-type";

export class Coupler {
	constructor(
		public type: CouplerType,
		public backlash: number
	) { }
}
