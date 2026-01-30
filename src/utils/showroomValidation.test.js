import assert from "node:assert/strict";
import {
    normalizeInstagramUrl,
    normalizeShowroomName,
    validateInstagramUrl,
    validatePhone,
    validateShowroomName,
} from "./showroomValidation.js";

function expectThrows(fn, message) {
    let threw = false;
    try {
        fn();
    } catch (err) {
        threw = true;
        if (message) assert.equal(err.code, message);
    }
    if (!threw) throw new Error("Expected function to throw");
}

// Valid name passes and normalizes
validateShowroomName("  Atelier Nova ");
assert.equal(normalizeShowroomName("  Atelier Nova "), "atelier nova");

// Only digits fails
expectThrows(() => validateShowroomName("11111"), "SHOWROOM_NAME_INVALID");

// Repeated chars fails
expectThrows(() => validateShowroomName("aaaaaaaaaa"), "SHOWROOM_NAME_INVALID");

// Instagram normalization
assert.equal(
    normalizeInstagramUrl("instagram.com/test/"),
    "https://instagram.com/test"
);

// Invalid instagram host
expectThrows(
    () => validateInstagramUrl("https://example.com/test"),
    "INSTAGRAM_INVALID"
);

// Phone normalization to E.164
const { e164 } = validatePhone("+38 050 555 55 87");
assert.equal(e164, "+380505555587");

// Phone without + is invalid
expectThrows(() => validatePhone("0999999999"), "PHONE_INVALID");

console.log("showroomValidation.test.js passed");
