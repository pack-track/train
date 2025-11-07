import { Railcar } from ".";
import { CouplerType } from "./coupler-type";

export class Coupler {
	constructor(
		public identifier: string,
		public type: CouplerType,
		public backlash: number,
		public railcar: Railcar
	) { }
}
