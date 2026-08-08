import assert from "node:assert/strict";
import test from "node:test";
import { applyCurrencyInputKey, applyCurrencyInputKeyWithState, formatCurrencyInput, resetCurrencyInput } from "../lib/currency-input";

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

test("digits after comma fill decimals without changing the integer", () => {
  const state = {separatorDigits: null as 0 | 1 | null};
  let value = applyCurrencyInputKeyWithState("0,12", ",", state);
  assert.equal(value, "12,00");
  value = applyCurrencyInputKeyWithState(value, "3", state);
  assert.equal(value, "12,03");
  value = applyCurrencyInputKeyWithState(value, "4", state);
  assert.equal(value, "12,34");
  value = applyCurrencyInputKeyWithState(value, "5", state);
  assert.equal(value, "123,45");
});

test("typing 10 comma 50 produces 10,50", () => {
  const state = {separatorDigits: null as 0 | 1 | null};
  let value = "";
  for (const key of ["1", "0", ",", "5", "0"]) {
    value = applyCurrencyInputKeyWithState(value, key, state);
  }
  assert.equal(value, "10,50");
});

test("currency input backspace shifts digits toward cents", () => {
  assert.equal(applyCurrencyInputKey("12,34", "backspace"), "1,23");
  assert.equal(formatCurrencyInput("15.5"), "15,50");
});

test("reset clears the decimal entry state before typing a new amount", () => {
  const state = {separatorDigits: null as 0 | 1 | null};
  applyCurrencyInputKeyWithState("12,00", ",", state);
  let value = resetCurrencyInput(state);
  for (const key of ["1", "0", ",", "5", "0"]) {
    value = applyCurrencyInputKeyWithState(value, key, state);
  }
  assert.equal(value, "10,50");
});
