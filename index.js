/**
 * My Urban Limos — single source of truth for vehicle fare calculation.
 *
 * Pricing model: each vehicle is configured with two anchor fares,
 * fareAt10km and fareAt200km. Every other distance is derived from
 * those two numbers:
 *
 *   - distance <= 10km:          flat fareAt10km (minimum charge)
 *   - 10km < distance <= 200km:  linear interpolation between the two
 *                                 anchor points
 *                                   rate = (fareAt200km - fareAt10km) / 190
 *                                   base = fareAt10km - rate * 10
 *                                   fare = base + rate * distance
 *   - distance > 200km:           fareAt200km plus the AVERAGE per-km
 *                                 rate at 200km (fareAt200km / 200)
 *                                 applied beyond 200km. Deliberately
 *                                 NOT the steeper/shallower marginal
 *                                 linear rate from the 10-200km segment
 *                                 -- using the flatter average keeps
 *                                 very long trips from compounding that
 *                                 marginal rate unboundedly.
 *
 * This must be the ONLY place this formula is implemented. If the
 * pricing model needs to change, change it here, bump the package
 * version, and update the pinned dependency in both
 * myurbanlimos_backend and NextMyUrbanLimos -- never copy this logic
 * into either repo. Duplicated pricing math silently drifting apart is
 * exactly what this package exists to prevent.
 */

function assertFinitePositive(value, name) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
        throw new TypeError(`${name} must be a finite, non-negative number (got ${value})`);
    }
}

/**
 * @param {number} fareAt10km - configured fare at 10km (the flat minimum charge)
 * @param {number} fareAt200km - configured fare at 200km
 * @param {number} distanceKm - trip distance in kilometers
 * @returns {number} fare, rounded to 2 decimal places
 */
export function calculateFare(fareAt10km, fareAt200km, distanceKm) {
    assertFinitePositive(fareAt10km, "fareAt10km");
    assertFinitePositive(fareAt200km, "fareAt200km");
    assertFinitePositive(distanceKm, "distanceKm");

    let fare;
    if (distanceKm <= 10) {
        fare = fareAt10km;
    } else if (distanceKm <= 200) {
        const rate = (fareAt200km - fareAt10km) / (200 - 10);
        const base = fareAt10km - rate * 10;
        fare = base + rate * distanceKm;
    } else {
        const perKmAt200 = fareAt200km / 200;
        fare = fareAt200km + perKmAt200 * (distanceKm - 200);
    }

    return Math.round(fare * 100) / 100;
}

/**
 * Validates a vehicle's two anchor fares without computing anything.
 * Intended for admin-UI form validation before saving to MongoDB.
 * @param {number} fareAt10km
 * @param {number} fareAt200km
 * @returns {string[]} validation error messages (empty array = valid)
 */
export function validateFareInputs(fareAt10km, fareAt200km) {
    const errors = [];
    if (typeof fareAt10km !== "number" || !Number.isFinite(fareAt10km) || fareAt10km <= 0) {
        errors.push("fareAt10km must be a positive number");
    }
    if (typeof fareAt200km !== "number" || !Number.isFinite(fareAt200km) || fareAt200km <= 0) {
        errors.push("fareAt200km must be a positive number");
    }
    return errors;
}

// ── TEMPORARY interim shim ─────────────────────────────────────────────
// ⚠️ Delete deriveInterimFareAnchors (and its use in both consuming repos)
// once fareAt10km/fareAt200km are real fields on every live vehicle
// document in MongoDB's vehicles-data collection.
//
// Context: calculateFare() needs fareAt10km/fareAt200km, but as of the
// myurbanlimos_backend and NextMyUrbanLimos migrations to this package,
// no live vehicle document has those fields set yet -- the admin UI that
// will let someone set them hasn't been built. Every vehicle currently
// only has the old 13-bracket `price: [{distance:{a,b},price}]` tier
// array. Originally this derivation lived only in myurbanlimos_backend
// (src/model/deriveInterimFare.js); it's centralized here so
// NextMyUrbanLimos doesn't need its own duplicate copy of the same logic.
//
// Once the admin UI ships and every vehicle has real fareAt10km/
// fareAt200km values written by a human, delete this function and every
// call site should read those fields directly instead.

/**
 * Replicates the old getPriceByDistance/getPriceByDistanceToCarName
 * bracket-lookup exactly, for a single distance value: first bracket
 * where distance.a <= d <= distance.b, else fall back to the last bracket.
 * @param {Array<{distance:{a:number,b:number},price:number}>} priceTiers
 * @param {number} distanceKm
 * @returns {number} fare at that exact distance, per the old tier algorithm
 */
function fareFromOldTiers(priceTiers, distanceKm) {
    const matched = priceTiers.find(
        (p) => distanceKm >= p.distance.a && distanceKm <= p.distance.b
    );
    const rate = matched ? matched.price : priceTiers[priceTiers.length - 1].price;
    return rate * distanceKm;
}

/**
 * Derives {fareAt10km, fareAt200km} from a live vehicle's existing
 * `price` bracket array, so calculateFare() has something real to work
 * with before the admin UI exists to set these fields directly.
 *
 * Logs a warning every time it's used, specifically so it's easy to grep
 * server/console logs for "DERIVED_FARE_ANCHORS_IN_USE" and confirm
 * whether this shim is still active after the admin UI ships real values.
 *
 * @param {{carName?: string, price: Array<{distance:{a:number,b:number},price:number}>}} vehicle
 *   a live vehicle document (must have `.price`)
 * @returns {{fareAt10km: number, fareAt200km: number}}
 */
export function deriveInterimFareAnchors(vehicle) {
    console.warn(
        `[DERIVED_FARE_ANCHORS_IN_USE] "${vehicle?.carName ?? "unknown vehicle"}" has no ` +
        `fareAt10km/fareAt200km on its MongoDB document -- deriving from its old ` +
        `price-tier array instead. This is temporary (see deriveInterimFareAnchors in ` +
        `myurbanlimos-pricing-formula) and should stop appearing once the admin UI sets ` +
        `real values for every vehicle.`
    );
    if (!Array.isArray(vehicle?.price) || vehicle.price.length === 0) {
        throw new Error(
            `Cannot derive fare anchors for "${vehicle?.carName ?? "unknown vehicle"}": no price tier array present.`
        );
    }
    return {
        fareAt10km: fareFromOldTiers(vehicle.price, 10),
        fareAt200km: fareFromOldTiers(vehicle.price, 200),
    };
}
