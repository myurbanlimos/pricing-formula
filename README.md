# myurbanlimos-pricing-formula

Single source of truth for My Urban Limos vehicle fare calculation.

This package exists because pricing logic previously got duplicated
across multiple files in `NextMyUrbanLimos` (and nearly duplicated
again into `myurbanlimos_backend`), and those copies drifted out of
sync, causing real undercharge/wrong-price bugs. **This is now the
only place the formula is implemented.** Both `myurbanlimos_backend`
and `NextMyUrbanLimos` depend on it as a pinned git dependency instead
of reimplementing it.

## Pricing model

Each vehicle is configured with two anchor fares stored in MongoDB
(`vehicles-data` collection): `fareAt10km` and `fareAt200km`. Every
other distance is derived from those two numbers:

| Distance | Fare |
|---|---|
| `distance <= 10km` | flat `fareAt10km` (minimum charge) |
| `10km < distance <= 200km` | linear interpolation between the two anchor points |
| `distance > 200km` | `fareAt200km` plus the **average** per-km rate at 200km (`fareAt200km / 200`) applied to the distance beyond 200km |

For the 10-200km segment:

```
rate = (fareAt200km - fareAt10km) / (200 - 10)
base = fareAt10km - rate * 10
fare = base + rate * distance
```

Beyond 200km, the average rate (not the steeper/shallower marginal
`rate` above) is used deliberately, so a long trip's cost doesn't
compound that marginal rate unboundedly.

## Install

Installed via git URL, pinned to a tag — never `#main`, so a change
here can't silently change behavior in either consumer until they
explicitly bump the pin:

```bash
npm install github:myurbanlimos/pricing-formula#v1.0.0
```

## Usage

```js
import { calculateFare, validateFareInputs } from "myurbanlimos-pricing-formula";

const fare = calculateFare(vehicle.fareAt10km, vehicle.fareAt200km, distanceKm);
// -> number, rounded to 2 decimal places

const errors = validateFareInputs(fareAt10km, fareAt200km);
// -> string[], empty if valid -- use in the admin UI before saving
```

## Changing the formula

1. Edit `index.js` (and `index.d.ts` if the signature changes).
2. Update `test.js` and run `npm test` -- all tests must pass.
3. Bump `version` in `package.json` and commit.
4. Tag the release (`git tag vX.Y.Z && git push --tags`).
5. In **both** `myurbanlimos_backend` and `NextMyUrbanLimos`, update the
   pinned tag in `package.json` and reinstall
   (`npm install github:myurbanlimos/pricing-formula#vX.Y.Z`).
6. Redeploy both. A version bump in only one of them means the two
   apps are quoting different prices for the same vehicle -- treat that
   as a blocking issue, not a follow-up.
