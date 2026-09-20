/**
 * Calculates a vehicle's fare for a given trip distance from its two
 * configured anchor fares (fareAt10km, fareAt200km). See index.js for
 * the full formula spec.
 *
 * @param fareAt10km - configured fare at 10km (the flat minimum charge)
 * @param fareAt200km - configured fare at 200km
 * @param distanceKm - trip distance in kilometers
 * @returns fare, rounded to 2 decimal places
 * @throws {TypeError} if any argument is not a finite, non-negative number
 */
export declare function calculateFare(
    fareAt10km: number,
    fareAt200km: number,
    distanceKm: number
): number;

/**
 * Validates a vehicle's two anchor fares without computing anything.
 * Intended for admin-UI form validation before saving to MongoDB.
 *
 * @returns validation error messages (empty array = valid)
 */
export declare function validateFareInputs(
    fareAt10km: number,
    fareAt200km: number
): string[];
