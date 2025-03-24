# Speed Permit
A speed permit allows a train to drive at a certain speed.
This permit has to be constantly renewed, to make sure that each train is constantly informed about the current state of the system.
If the permit does not renew, a multiple staged, controlled shutdown automatically starts.
This state is predictable for both the train and the director.

Timings and stepping are defined in `source/speed-permit.ts`.

Any train spacing must always assume that no speed permits can be issued and a run-off train is running at the set speed.
Accurate weight and breaking capacaties are required to allow for safe dense packing.
Safety factors for breaking must be applied in the train index, the train index must always be able to assume the values can be calculated upon, even in an error condition.

## Stage 1: Normal Operation
During this time, the speed permit is fully active with no breaking applied.
The speed permit is usually valid for **1000 miliseconds**.

If not renewed, stage 2 will automatically be activated.

## Stage 2: Hold
During hold, no breaks are applied but the driver is notified about the lag.
This can occur naturally, especially when the network is congested or a small delay is induced.
The lag is usually below **500 milliseconds**, which is the duration of normal hold.

Stage three will automatically be started, if no new permit is issued.

## Stage 3: Breaking
During the next **5000 milliseconds**, **10%** of the full breaking capacity is applied.
This is to prevent network interruptions from causing emergency shutdowns.

The train should slowly decelerate, but if the permit is still not renewed, emergency will automatically be initiated.

## Stage 4: Emergency Breaking
The train will be brougth to a full stop.
A new speed permit is required for it to start again.
