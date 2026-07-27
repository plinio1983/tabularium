import assert from "node:assert/strict";
import test from "node:test";
import { applyCurrencyInputKey, formatCurrencyInput } from "../lib/currency-input";

test("currency input shifts digits from cents to euros", () => {
  let value = "";
  value = applyCurrencyInputKey(value, "1");
  assert.equal(value, "0,01");
  value = applyCurrencyInputKey(value, "2");
  assert.equal(value, "0,12");
  value = applyCurrencyInputKey(value, "3");
  assert.equal(value, "1,23");
  value = applyCurrencyInputKey(value, "4");
  assert.equal(value, "12,34");
});

test("currency input comma converts the displayed digits to an integer", () => {
  assert.equal(applyCurrencyInputKey("41,20", ","), "4120,00");
});

test("currency input backspace shifts digits toward cents", () => {
  assert.equal(applyCurrencyInputKey("12,34", "backspace"), "1,23");
  assert.equal(formatCurrencyInput("15.5"), "15,50");
});
