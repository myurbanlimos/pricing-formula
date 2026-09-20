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
