import { Layout, SectionPosition } from "@packtrack/layout";
import { Coupler } from "./railcar/coupler";
import { TrainChain } from "./chain";
import { CouplerType } from "./railcar/coupler-type";
import { MeasuredPosition } from "./measured-location";
import { Train } from "./train";
import { SpeedPermit } from "./speed-permit";
import { Railcar } from "./railcar";
import { Traction } from "./railcar/traction";

type ValueResolver = String | Number | Boolean | (typeof Date) | (typeof SectionPosition) | ((value: String) => any) | null;

export class Snapshot {
	static export(document: Document, chain: TrainChain) {
		const root = document.createElement('snapshot');
		root.setAttribute('hash', chain['lastHash']);
		root.setAttribute('version', '1');

		const couplerTypes = document.createElement('coupler-types');
		root.appendChild(couplerTypes);

		const couplerTypeMap = new Map<CouplerType, number>();

		for (let railcar of chain.railcars) {
			for (let coupler of [railcar.headCoupler, railcar.tailCoupler]) {
				if (coupler) {
					if (!couplerTypeMap.has(coupler.type)) {
						couplerTypeMap.set(coupler.type, couplerTypeMap.size);

						const type = document.createElement('coupler-type');
						this.exportItem(type, coupler.type, 'name');

						couplerTypes.appendChild(type);
					}
				}
			}
		}

		const railcars = document.createElement('railcars');
		root.appendChild(railcars);

		for (let source of chain.railcars) {
			const railcar = document.createElement('railcar');

			this.exportItem(railcar, source,
				'identifier',
				'maximalSpeed',
				'maximalDeceleration'
			);

			railcars.appendChild(railcar);

			for (let sourceTraction of source.traction) {
				const traction = document.createElement('traction');

				this.exportItem(traction, sourceTraction,
					'maximalAcceleration',
					'maximalSpeed'
				);

				railcar.appendChild(traction);
			}

			for (let sourceCoupler of [source.headCoupler, source.tailCoupler]) {
				if (sourceCoupler) {
					const coupler = document.createElement('coupler');
					coupler.setAttribute('side', sourceCoupler == source.headCoupler ? 'head' : 'tail');
					coupler.setAttribute('type', couplerTypeMap.get(sourceCoupler.type).toString());

					this.exportItem(coupler, sourceCoupler,
						'identifier',
						'backlash'
					);

					railcar.appendChild(coupler);
				}
			}
		}

		const trains = document.createElement('trains');
		root.appendChild(trains);

		for (let source of chain.trains) {
			const train = document.createElement('train');
			this.exportItem(train, source,
				'identifier',
				'created',
				'changed',
				'reversed'
			);

			trains.appendChild(train);

			const lastPositioner = document.createElement('last-positioner');
			this.exportItem(lastPositioner, source.lastPositioner,
				'time',
				'reversed',
				'trainOffset',
				'location'
			);

			train.appendChild(lastPositioner);

			const railcars = document.createElement('railcars');
			train.appendChild(railcars);

			for (let railcar of source.railcars) {
				const reference = document.createElement('railcar');
				reference.setAttribute('identifier', railcar.identifier);
				reference.setAttribute('direction', railcar.reversed ? 'reverse' : 'forward');

				railcars.appendChild(reference);
			}

			const speedPermits = document.createElement('speed-permits');
			train.appendChild(speedPermits);

			for (let sourcePermit of source.speedPermits) {
				const permit = document.createElement('speed-permit');
				this.exportItem(permit, sourcePermit,
					'issued',
					'speed'
				);

				speedPermits.appendChild(permit);
			}
		}

		return root;
	}

	static import(root: Element, layout: Layout) {
		if (root.getAttribute('version') != '1') {
			throw new Error('Unknown snapshot version');
		}

		const chain = new TrainChain();
		chain['lastHash'] = root.getAttribute('hash');

		const couplerTypeMap = new Map<number, CouplerType>();

		for (let source of root.querySelectorAll('coupler-types > coupler-type') as any) {
			couplerTypeMap.set(couplerTypeMap.size, this.importItem(CouplerType, source, {
				name: String
			}));
		}

		for (let source of root.querySelectorAll('trains > train') as any) {
			const positioner = source.querySelector('last-positioner');

			const position = this.importItem(MeasuredPosition, positioner, {
				time: Date,
				location: SectionPosition,
				reversed: Boolean,
				trainOffset: Number
			}, layout);

			const train = this.importItem(Train, source, {
				identifier: String,
				chain: () => chain,
				created: Date,
				position: null,
				reversed: Boolean
			});

			train.lastPositioner = position;

			for (let sourcePermit of source.querySelectorAll('speed-permits > speed-permit') as any) {
				const permit = this.importItem(SpeedPermit, sourcePermit, {
					issued: Date,
					speed: Number,
					train: null
				});

				permit.train = train;
				train.speedPermits.push(permit);
			}

			chain.trains.push(train);

			for (let reference of source.querySelectorAll('railcars > railcar')) {
				const identifier = reference.getAttribute('identifier');
				const direction = reference.getAttribute('direction');

				for (let sourceRailcar of root.querySelectorAll('railcars > railcar') as any) {
					if (sourceRailcar.parentElement.parentElement == root && sourceRailcar.getAttribute('identifier') == identifier) {
						const railcar = this.importItem(Railcar, sourceRailcar, {
							identifier: String,
							length: Number,
							maximalSpeed: Number,
							maximalDeceleration: Number,
							train: () => train,
							headCoupler: null,
							tailCoupler: null
						});

						train.railcars.push(railcar);
						chain.railcars.push(railcar);

						for (let side of ['head', 'tail']) {
							const source = sourceRailcar.querySelector(`coupler[side="${side}"]`);

							if (source) {
								const coupler = this.importItem(Coupler, source, {
									identifier: String,
									type: value => couplerTypeMap.get(+value),
									backlash: Number,
									railcar: () => railcar
								});

								if (side == 'head') {
									railcar.headCoupler = coupler;

									if (direction == 'forward') {
										railcar.head.coupler = coupler;
									} else {
										railcar.tail.coupler = coupler;
									}
								} else {
									railcar.tailCoupler = coupler;

									if (direction == 'forward') {
										railcar.tail.coupler = coupler;
									} else {
										railcar.head.coupler = coupler;
									}
								}
							}
						}

						for (let tractionSource of sourceRailcar.querySelectorAll('traction')) {
							railcar.traction.push(this.importItem(Traction, tractionSource, {
								maximalAcceleration: Number,
								maximalSpeed: Number
							}));
						}
					}
				}
			}
		}

		return chain;
	}

	private static exportItem<Item>(node: Element, item: Item, ...keys: (keyof Item)[]) {
		for (let key of keys) {
			let value: any = item[key];

			if (value !== null) {
				if (typeof value == 'object') {
					if (value instanceof Date) {
						value = value.toISOString();
					} else if ('section' in value && 'offset' in value && 'reversed' in value) {
						value = `${value.section.domainName}@${value.offset}${value.reversed ? 'r' : 'f'}`;
					}
				} else if (typeof value == 'number') {
					value = value.toString();
				} else if (typeof value == 'boolean') {
					value = value ? 'true' : 'false';
				}

				node.setAttribute(this.encodeName(key as string), value);
			}
		}
	}

	private static importItem<Type>(
		constructor: new (...parameters: any) => Type,
		source: Element,
		mappings: Record<string, ValueResolver>,
		layout?: Layout
	) {
		const parameters = [];

		for (let key in mappings) {
			parameters.push(this.importValue(source, key, mappings[key], layout));
		}

		return new constructor(...parameters);
	}

	private static importValue(source: Element, key: string, value: ValueResolver, layout?: Layout) {
		const attributeName = this.encodeName(key);

		if (!source.hasAttribute(attributeName)) {
			return null;
		}

		const attribute = source.getAttribute(attributeName);

		if (value == SectionPosition) {
			const domainName = attribute.split('@')[0];
			const offset = +attribute.match(/[0-9\.]+[fr]$/)[0].match(/[0-9]+/)[0];
			const reversed = domainName[domainName.length - 1] == 'r';

			for (let district of layout.allDistricts) {
				for (let section of district.sections) {
					if (section.domainName == domainName) {
						return new SectionPosition(
							section,
							offset,
							reversed
						);
					}
				}
			}

			return null;
		} else if (value == Date) {
			return new Date(attribute);
		} else if (value == String) {
			return attribute;
		} else if (value == Number) {
			return +attribute;
		} else if (value == Boolean) {
			return attribute == 'true';
		} else if (value === null) {
			return null;
		} else if (typeof value == 'function') {
			return (value as Function)(source.getAttribute(attributeName));
		}
	}

	private static encodeName(name: string) {
		return name.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`);
	}

	private static decodeName(name: string) {
		return name.replace(/-[a-z]/g, match => match[1].toUpperCase());
	}
}
