import Engine from "../engine.bend";
import { parseProblem } from "../parser.js";
import { solveProblem } from "../steps.js";

let checks = 0;
function expect(actual, wanted, label) {
  checks += 1;
  if (actual !== wanted) throw new Error(`${label}: expected ${wanted}, got ${actual}`);
}

function result(input) {
  return solveProblem(parseProblem(input), input, Engine);
}

expect(result("2(x + 3) = 14").result, "x = 4", "distribute and solve");
expect(result("1/2 + 3/4").result, "5/4", "exact fractions");
expect(result("3x + 2 = x + 10").result, "x = 4", "variables on both sides");
expect(result("x + 5 = 2").result, "x = −3", "negative solution");
expect(result("x/2 + 1/3 = 5/6").result, "x = 1", "fractional equation");
expect(result("2 + 3 × 4").result, "14", "operation precedence");
expect(result("−3 ÷ 4 + 1/2").result, "−1/4", "signed fractions");
expect(result("2(x + 3) + x").result, "3x + 6", "linear simplification");
expect(result("2x + 3 = 2x + 3").result, "All real values of x", "identity");
expect(result("2x + 3 = 2x + 4").result, "No value of x", "contradiction");

const steps = result("3x + 2 = x + 10").steps;
expect(steps.some((step) => step.math === "2x + 2 = 10"), true, "move x terms step");
expect(steps.some((step) => step.math === "2x = 8"), true, "move constants step");
expect(steps.at(-1).math, "14 = 14", "substitution check");

for (const [input, issue] of [
  ["x*x=1", "linear"],
  ["1/0", "Division by zero"],
  ["1.5+2", "fraction"],
  ["1+", "ends too soon"],
  ["1=2=3", "one equals sign"],
]) {
  let message = "";
  try { result(input); } catch (error) { message = String(error.message); }
  expect(message.includes(issue), true, `clear error for ${input}`);
}

// Compare simple generated equations against an independent integer oracle.
for (let a = -5; a <= 5; a += 1) {
  if (a === 0) continue;
  for (let b = -3; b <= 3; b += 1) {
    const c = a * 2 + b;
    const input = `${a}x + (${b}) = ${c}`;
    expect(result(input).result, "x = 2", `generated equation ${input}`);
  }
}

console.log(`${checks} Math Steps checks passed`);
