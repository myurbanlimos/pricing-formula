import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateFare, validateFareInputs } from "./index.js";

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
