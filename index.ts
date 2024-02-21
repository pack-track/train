import { Tile } from "@packtrack/layout/tile";
import { MeasuredPosition } from "./measured-location";
import { PredictedPosition } from "./predicted-location";

export class Train {
	lastPositioner: MeasuredPosition;

	length: number;

	speed: number;
	reversed: boolean;
	maximalAcceleration: number;

	// calculates the current head location based on the trains last known position measurement
	get head() {
		if (!this.lastPositioner) {
			return;
		}

		const elapsedSeconds = (+new Date() - +this.lastPositioner.time) / 1000;

		return new PredictedPosition(
			this.lastPositioner.head,
			this.lastPositioner.head.advance(this.speed * elapsedSeconds),
			this.lastPositioner.head.advance(this.speed * elapsedSeconds + (this.maximalAcceleration * elapsedSeconds ** 2) / 2)
		);
	}

	nominalTrail() {
		const head = this.head.nominal;

		return head.section.trail(head.offset, this.reversed, this.length);
	}

	toSVG() {
		const trail = this.nominalTrail();
		const tiles: Tile[] = [];

		let start = 0;
		let end = 0;

		let length = 0;

		for (let sectionIndex = 0; sectionIndex < trail.sections.length; sectionIndex++) {
			const section = trail.sections[sectionIndex];

			const range = section.getTilesInRange(this.head.nominal, trail.tip);

			if (sectionIndex == 0) {
				start = range.offset.start;
			} else if (sectionIndex == trail.sections.length - 1) {
				end = range.offset.end;
			}
			
			for (let tile of range.tiles) {
				length += tile.pattern.length;
			}

			tiles.unshift(...range.tiles);
		}

		const tip = tiles[tiles.length - 1];

		return `
			<g id="train">
				<style>

					g#train path {
						stroke: blue;
						stroke-dasharray: 0 ${start} ${length - end - start};

						start: ${start};
						end: ${end};
					}

				</style>

				<text x="${tip.x}" y="${tip.y}" font-size="1">
					TRAIN
				</text>

				<path d="${tiles.map((tile, index) => tile.toSVGPath(index != 0)).join(', ')}" />
			</g>
		`;
	}
}