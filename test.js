import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateFare, validateFareInputs, deriveInterimFareAnchors } from "./index.js";

const F10 = 50;
const F200 = 300;

test("flat minimum at and below 10km", () => {
    assert.equal(calculateFare(F10, F200, 0), 50);
    assert.equal(calculateFare(F10, F200, 5), 50);
    assert.equal(calculateFare(F10, F200, 10), 50);
});

test("linear interpolation between 10km and 200km", () => {
    assert.equal(calculateFare(F10, F200, 100), 168.42);
    // continuous at both boundaries
    assert.equal(calculateFare(F10, F200, 10), 50);
    assert.equal(calculateFare(F10, F200, 200), 300);
});

test("average 200km rate applied beyond 200km", () => {
    // perKmAt200 = 300 / 200 = 1.5
    assert.equal(calculateFare(F10, F200, 250), 375);
    assert.equal(calculateFare(F10, F200, 400), 600);
});

test("rejects invalid inputs", () => {
    assert.throws(() => calculateFare(-1, F200, 50), TypeError);
    assert.throws(() => calculateFare(F10, F200, -5), TypeError);
    assert.throws(() => calculateFare(F10, "300", 50), TypeError);
    assert.throws(() => calculateFare(F10, NaN, 50), TypeError);
});

test("validateFareInputs", () => {
    assert.deepEqual(validateFareInputs(50, 300), []);
    assert.deepEqual(validateFareInputs(0, 300), ["fareAt10km must be a positive number"]);
    assert.deepEqual(validateFareInputs(50, -1), ["fareAt200km must be a positive number"]);
    assert.deepEqual(
        validateFareInputs(NaN, undefined),
        ["fareAt10km must be a positive number", "fareAt200km must be a positive number"]
    );
});

test("deriveInterimFareAnchors derives anchors from the old bracket tiers", () => {
    const vehicle = {
        carName: "Test Sedan",
        price: [
            { distance: { a: 1, b: 15.99 }, price: 10.6 },
            { distance: { a: 1, b: 199.99 }, price: 2.12 },
            { distance: { a: 1, b: 15000.99 }, price: 2.2 },
        ],
    };
    const { fareAt10km, fareAt200km } = deriveInterimFareAnchors(vehicle);
    // 10km falls in the first bracket (a:1,b:15.99) -> rate 10.6 * 10
    assert.equal(fareAt10km, 106);
    // 200km falls past the last bracket's b:15000.99 boundary check (200 <= 15000.99,
    // but > 199.99, so the middle bracket doesn't match either) -> falls back to
    // the last bracket's rate, 2.2 * 200 (floating point: 440.00000000000006)
    assert.ok(Math.abs(fareAt200km - 440) < 1e-9);
});

test("deriveInterimFareAnchors throws when the vehicle has no price tiers", () => {
    assert.throws(() => deriveInterimFareAnchors({ carName: "No Tiers", price: [] }), Error);
    assert.throws(() => deriveInterimFareAnchors({ carName: "No Tiers" }), Error);
});
