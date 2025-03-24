import { SectionPosition } from "@packtrack/layout";

export class MeasuredPosition {
	constructor(
		public time: Date,
		public location: SectionPosition,
		public reversed: boolean,
		public trainOffset: number
	) {}

	get head() {
		if (this.reversed) {
			return this.location.advance(-this.trainOffset);
		}

		return this.location.advance(this.trainOffset);
	}
}
