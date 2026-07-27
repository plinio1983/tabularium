import assert from "node:assert/strict";
import test from "node:test";
import { lastDayOfMonthInput } from "../components/ExpenseForm";

test("saldo IVA usa l'ultimo giorno del periodo contabile", () => {
  assert.equal(lastDayOfMonthInput("2026-07"), "2026-07-31");
  assert.equal(lastDayOfMonthInput("2026-02"), "2026-02-28");
  assert.equal(lastDayOfMonthInput("2028-02"), "2028-02-29");
});

