import { SectionPosition } from "@packtrack/layout";

export class PredictedPosition {
	constructor(
		public minimal: SectionPosition,
		public nominal: SectionPosition,
		public maximal: SectionPosition
	) {}

	toString() {
		return `< ${this.minimal} [ ${this.nominal} ] ${this.maximal} >`;
	}

	toPackTrackValue() {
		return `${this.minimal.toPackTrackValue()}<${this.nominal.toPackTrackValue()}<${this.maximal.toPackTrackValue()}`;
	}
}
