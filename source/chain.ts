import { Railcar } from "./railcar";
import { Coupler } from "./railcar/coupler";
import { Train } from "./train";

export class TrainChain {
	trains: Train[] = [];

	// contains all railcars active on the layout
	railcars: Railcar[] = [];

	onDisband = (train: Train, railcars: Railcar[]) => console.log('disbaned', train.identifier, railcars.map(unit => unit.identifier));

	private lastHash = '';

	// adds a railcar to the chain
	//
	// each railcar quickly acts as a single train when being created
	// it can be immediately coupled after being created
	async comission(railcar: Railcar, time: Date) {
		this.hash('add', railcar.identifier);

		const train = new Train(await this.createIdentifier(), this, time, null, false);
		railcar.train = train;
		train.railcars.push(railcar);

		this.trains.push(train);
		this.railcars.push(railcar);

		return train;
	}

	// remove a railcar from the chain
	//
	// if a railcar is removed from the middle of a train, it will be fused
	// beware that couplers must match when fusing
	// disbands trains if empty
	async withdraw(railcar: Railcar, time: Date) {
		if (!this.railcars.includes(railcar)) {
			throw new Error(`Railcar '${railcar.identifier}' not in chain`);
		}

		const train = this.trains.find(train => train.railcars.includes(railcar));
		const index = train.railcars.indexOf(railcar);

		const before = train.railcars[index - 1];
		const after = train.railcars[index + 1];

		// fusing couplers must match
		if (before && after) {
			if (before.tail.coupler.type != after.head.coupler.type) {
				throw new Error(`Railcar '${railcar.identifier}' cannot be removed from '${train.identifier}', railcars around it do not have the same coupler type and cannot be connected.`);
			}
		}

		this.hash('withdraw', railcar.identifier);

		railcar.train = null;
		train.railcars.splice(index, 1);

		// disband empty train
		if (train.railcars.length == 0) {
			this.trains.splice(this.trains.indexOf(train), 1);
			this.onDisband(train, [railcar]);
		}

		this.railcars.splice(this.railcars.indexOf(railcar));
	}

	// decouples two railcars
	//
	// the railcar owning the breaking coupler will keep the train identifier, while the peer will get a new train
	async uncouple(breakingCoupler: Coupler, time: Date) {
		this.hash('uncouple', breakingCoupler.identifier);

		const sourceUnit = this.railcars.find(railcar => railcar.headCoupler == breakingCoupler || railcar.tailCoupler == breakingCoupler);
		const sourceTrain = this.trains.find(train => train.railcars.includes(sourceUnit));

		// get all railcars after the broken coupler
		const split = sourceTrain.split(breakingCoupler);

		if (split.before.length == 0 || split.after.length == 0) {
			throw new Error(`Cannot uncouple loose coupler '${breakingCoupler.identifier}'`);
		}

		// remove link between the last railcar and the first railcar of the split off train
		split.before.at(-1).tail.target = null;
		split.after.at(0).head.target = null;

		let before: Railcar[];
		let after: Railcar[];

		if (sourceUnit.tail.coupler && sourceUnit.tail.coupler == breakingCoupler) {
			before = split.before;
			after = split.after;
		} else {
			before = split.after;
			after = split.before;
		}

		// shrink old train
		sourceTrain.railcars = before;
		sourceTrain.changed = time;

		// find the splitting distance
		// TODO make this time independent
		const position = sourceTrain.lastPositioner?.location.advance(-sourceTrain.coupledLength);

		// create new train with the loose railcars if they are not attached to somewhere
		const train = new Train(await this.createIdentifier(), this, time, position, sourceTrain.reversed);
		train.railcars = after;

		for (let railcar of train.railcars) {
			railcar.train = train;
		}

		this.trains.push(train);
	}

	// couples two railcars together
	// automatically rearranges trains, creating and deleting them as required
	//
	// the train of source will keep the train, while the target train will be disbanded
	async couple(source: Coupler, target: Coupler, time: Date) {
		this.hash('couple', source.identifier, target.identifier);

		// find the source train and unit
		const sourceUnit = this.railcars.find(railcar => railcar.headCoupler == source || railcar.tailCoupler == source);
		const sourceTrain = this.trains.find(train => train.railcars.includes(sourceUnit));

		// find the target where this coupling attaches to
		const targetUnit = this.railcars.find(railcar => railcar.headCoupler == target || railcar.tailCoupler == target);

		if (sourceUnit == targetUnit) {
			throw new Error(`Source '${targetUnit.identifier}' cannot be coupled to itself (${source.identifier} / ${target.identifier}).`);
		}

		if (targetUnit.head.target && targetUnit.tail.target) {
			throw new Error(`Target '${targetUnit.identifier}' is coupled (${targetUnit.head.target.identifier} / ${targetUnit.tail.target.identifier})`);
		}

		sourceTrain.changed = time;

		const targetTrain = this.trains.find(train => train.railcars.includes(targetUnit));
		targetTrain.changed = time;

		// source tail is directly coupled to target head
		if (
			sourceUnit.tail.coupler &&
			sourceUnit.tail.coupler == source &&
			targetUnit.head.coupler == target
		) {
			sourceTrain.railcars = [...sourceTrain.railcars, ...targetTrain.railcars];

			sourceUnit.tail.target = targetUnit;
			targetUnit.head.target = sourceUnit;
		}

		// source head is coupled to target tail
		if (
			sourceUnit.head.coupler &&
			sourceUnit.head.coupler == source &&
			targetUnit.tail.coupler == target
		) {
			sourceTrain.railcars = [...targetTrain.railcars, ...sourceTrain.railcars];

			sourceUnit.head.target = targetUnit;
			targetUnit.tail.target = sourceUnit;
		}

		// source tail is connected to target tail, flip target
		if (
			sourceUnit.tail.coupler &&
			sourceUnit.tail.coupler == source &&
			targetUnit.tail.coupler == target
		) {
			targetTrain.reverse();
			sourceTrain.railcars = [...sourceTrain.railcars, ...targetTrain.railcars];

			sourceUnit.tail.target = targetUnit;
			targetUnit.head.target = sourceUnit;
		}

		// source train is connected with head to target train, which needs to be flipped
		if (
			sourceUnit.head.coupler &&
			sourceUnit.head.coupler == source &&
			targetUnit.head.coupler == target
		) {
			targetTrain.reverse();
			sourceTrain.railcars = [...targetTrain.railcars, ...sourceTrain.railcars];

			sourceUnit.head.target = targetUnit;
			targetUnit.tail.target = sourceUnit;
		}

		this.trains.splice(this.trains.indexOf(targetTrain), 1);
		this.onDisband(targetTrain, targetTrain.railcars);

		for (let railcar of sourceTrain.railcars) {
			railcar.train = sourceTrain;
		}
	}

	dump() {
		const singles = this.trains.filter(train => train.railcars.length == 1);
		const trains = this.trains.filter(train => train.railcars.length != 1);

		console.group();

		for (let train of trains) {
			console.group(train.identifier);

			for (let unit of train.railcars) {
				console.log(
					unit.head.target ? `<${unit.head.target.identifier}` : '<**',
					`(( ${unit.identifier} ))`,
					unit.tail.target ? `${unit.tail.target.identifier}>` : '**>'
				);
			}

			console.groupEnd();
		}

		console.log(`singles: ${singles.map(single => single.railcars.at(0).identifier).join(' ')}`)

		console.groupEnd();
	}

	private async hash(...data: string[]) {
		for (let chunk of data) {
			const payload = new TextEncoder().encode(this.lastHash + chunk);
			const hash = await crypto.subtle.digest('SHA-1', payload);

			this.lastHash = new TextDecoder().decode(hash);
		}

		return this.lastHash;
	}

	private async createIdentifier() {
		const hash = await this.hash('identifier');

		return hash.substring(0, 6);
	}
}
