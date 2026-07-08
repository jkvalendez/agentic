import { test } from "node:test";
import assert from "node:assert/strict";
import { add, multiply, isEven } from "../src/math.js";

test("add() should add two numbers", () => {
  assert.equal(add(2, 3), 5);       // will FAIL because of the bug in math.js
});

test("multiply() should multiply two numbers", () => {
  assert.equal(multiply(4, 5), 20); // passes
});

test("isEven() should detect even numbers", () => {
  assert.equal(isEven(4), true);    // passes
  assert.equal(isEven(7), false);   // passes
});
