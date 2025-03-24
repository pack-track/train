import { Device, Layout, SectionPosition } from "@packtrack/layout";
import { CouplerType } from "./railcar/coupler-type";
import { Train } from "./train";
import { Railcar } from "./railcar";
import { Traction } from "./railcar/traction";
import { Coupler } from "./railcar/coupler";

export class TrainIndex {
	layout: Layout;
	trains: Train[] = [];

	couplerTypes: CouplerType[] = [];

	static from(document: any, layout: Layout) {
		const index = new TrainIndex();
		index.layout = layout;

		const source = document.firstChild!;

		if (layout.name != source.getAttribute('railway')) {
			throw new Error(`Invalid train index '${source.getAttribute('railway')}' for layout '${layout.name}'`);
		}

		const version = source.getAttribute('version');

		if (version == '1') {
			let child = source.firstChild;

			while (child) {
				if (child.tagName == 'train') {
					index.trains.push(index.loadTrain(child));
				}

				child = child.nextSibling;
			}
		} else {
			throw new Error(`Unsupported train index file version '${version}'`);
		}

		return index;
	}

	loadTrain(source: any) {
		const name = source.getAttribute('name');

		if (this.trains.find(train => train.name == name)) {
			throw new Error(`Duplicate train '${name}'`);
		}

		let head: SectionPosition;
		const railcars: Railcar[] = [];

		let child = source.firstChild;

		while (child) {
			if (child.tagName == 'head') {
				const sectionName = child.getAttribute('section');
				const offset = child.getAttribute('offset');
				const reversed = child.getAttribute('reversed') == 'true';

				for (let district of this.layout.allDistricts) {
					for (let section of district.sections) {
						if (section.domainName == sectionName) {
							head = new SectionPosition(section, offset, reversed);
						}
					}
				}
			}

			child = child.nextSibling;
		}

		if (!head) {
			throw new Error(`Train '${name}' has no position`);
		}

		const train = new Train(name, this, head, head.reversed);

		child = source.firstChild;

		while (child) {
			if (child.tagName == 'railcar') {
				train.railcars.push(this.loadRailcar(child, train));
			}

			child = child.nextSibling;
		}

		return train;
	}

	loadRailcar(source: any, train: Train) {
		const railcar = new Railcar(
			source.getAttribute('name'),
			+source.getAttribute('length'),
			+source.getAttribute('max-speed'),
			+source.getAttribute('max-deceleration'),
			train,
		);

		let child = source.firstChild;

		while (child) {
			if (child.tagName == 'traction') {
				const traction = new Traction(
					+child.getAttribute('max-acceleration'),
					+child.getAttribute('max-speed')
				);

				railcar.traction.push(traction);
			}

			if (child.tagName == 'coupler') {
				const coupler = new Coupler(
					this.findCouplerType(child.getAttribute('type')),
					+child.getAttribute('backlash')
				);

				railcar.coupler[child.getAttribute('side')] = coupler;
			}

			if (child.tagName == 'controller') {
				const device = this.layout.findDevice(child.getAttribute('device'));
				const channel = this.layout.findChannel(device, child.getAttribute('channel'));

				railcar.controllers.push(channel);
			}

			child = child.nextSibling;
		}

		return railcar;
	}

	findCouplerType(name: string) {
		const existing = this.couplerTypes.find(coupler => coupler.name == name);

		if (existing) {
			return existing;
		}

		const type = new CouplerType(name);
		this.couplerTypes.push(type);

		return type;
	}
}
