import { SectionPosition } from "@packtrack/layout/position";

export class PredictedPosition {
	constructor(
		public minimal: SectionPosition,
		public maximal: SectionPosition,
		public nominal: SectionPosition
	) {}

	toString() {
		return `< ${this.minimal} [ ${this.nominal} ] ${this.maximal} >`;
	}
}