import Engine from "../engine.bend";
import { parseProblem } from "../parser.js";
import { solveProblem } from "../steps.js";
import { buildMatrixExpression, matrixShape } from "../matrix-builder.js";
import { normalizeInput } from "../notation.js";

let checks = 0;
function expect(actual, wanted, label) {
  checks += 1;
  if (actual !== wanted) throw new Error(`${label}: expected ${wanted}, got ${actual}`);
}

function result(input) {
  const normalized = normalizeInput(input);
  return solveProblem(parseProblem(normalized), normalized, Engine);
}

expect(result("2(x + 3) = 14").result, "x = 4", "distribute and solve");
expect(result("\\frac{1}{2} + \\frac{3}{4}").result, "5/4", "LaTeX fractions");
expect(result("$\\frac{1}{2} + \\frac{3}{4}$").result, "5/4", "delimited LaTeX");
expect(result("2x+3=11").result, "x = 4", "implicit multiplication shorthand");
expect(result("2\\left(x+3\\right)=14").result, "x = 4", "LaTeX delimiters");
expect(result("2\\cdot 3 + 1").result, "7", "LaTeX multiplication");
expect(result("\\det\\begin{bmatrix}1 & 2 \\\\ 3 & 4\\end{bmatrix}").result, "−2", "LaTeX matrix and function shorthand");
expect(result("det[[1,2],[3,4]]").result, "−2", "unparenthesized matrix function");
expect(result("1/2 + 3/4").result, "5/4", "exact fractions");
expect(result("3x + 2 = x + 10").result, "x = 4", "variables on both sides");
expect(result("x + 5 = 2").result, "x = −3", "negative solution");
expect(result("x/2 + 1/3 = 5/6").result, "x = 1", "fractional equation");
expect(result("2 + 3 × 4").result, "14", "operation precedence");
expect(result("−3 ÷ 4 + 1/2").result, "−1/4", "signed fractions");
expect(result("2(x + 3) + x").result, "3x + 6", "linear simplification");
expect(result("2x + 3 = 2x + 3").result, "All real values of x", "identity");
expect(result("2x + 3 = 2x + 4").result, "No value of x", "contradiction");
expect(result("1.5 + 2").result, "7/2", "decimal stays exact");
expect(result("1.2 * 2.5").result, "3", "decimal product stays exact");
expect(result(".5 + .25").result, "3/4", "leading-dot decimals");
expect(result("0.5x + 1 = 2").result, "x = 2", "decimal coefficient");
expect(result("2^3^2").result, "512", "right associative powers");
expect(result("2**3").result, "8", "double-star power shorthand");
expect(result("-2^2").result, "−4", "unary minus after power");
expect(result("(-2)^2").result, "4", "parenthesized negative power");
expect(result("2^-3").result, "1/8", "negative exponent");
expect(result("0.5^2").result, "1/4", "decimal base power stays exact");
expect(result("(-8)^(2/3)").result, "4", "odd root of negative base followed by even power");
expect(result("9^0.5").result, "3", "fractional power with exact root");
expect(result("sqrt(9) + √16").result, "7", "exact square roots");
expect(result("\\sqrt[3]{8} + root(3,-8)").result, "0", "exact cube roots");
expect(result("root(2,0.04)").result, "1/5", "exact root of decimal");
expect(result("\\sqrt{2}").result, "≈ 1.414214", "irrational square root is labeled approximate");
expect(result("x^2 - 5x + 6 = 0").result, "x = 2, 3", "two exact quadratic roots");
expect(result("x² = 2").result, "x ≈ −1.414214, 1.414214", "two approximate quadratic roots");
expect(result("(x+1)^2=0").result, "x = −1", "repeated quadratic root");
expect(result("x*x=1").result, "x = −1, 1", "implicit quadratic multiplication");
expect(result("x^2+1=0").result, "No real solutions", "quadratic with no real roots");
const irrationalQuadratic = result("sqrt(2)x^2-2=0");
expect(irrationalQuadratic.heading, "Approximate real solutions", "irrational coefficient gives approximate roots");
expect(irrationalQuadratic.steps.some((step) => step.title === "Collect terms" && step.math.startsWith("≈")), true,
  "irrational coefficient is labeled approximate in steps");
expect(irrationalQuadratic.steps.some((step) => step.title === "Find the discriminant" && step.math.includes("≈")), true,
  "irrational discriminant is labeled approximate in steps");

expect(result("[[1,2],[3,4]] + [[5,6],[7,8]]").result, "[[6, 8], [10, 12]]", "matrix addition");
expect(result("[[2^2,sqrt(4)],[0,1]]").result, "[[4, 2], [0, 1]]", "exact powers and roots in matrix entries");
expect(result("[[0.5,1],[2,3]]").result, "[[1/2, 1], [2, 3]]", "decimal matrix entry");
expect(result("[[1,2],[3,4]] - [[5,6],[7,8]]").result, "[[−4, −4], [−4, −4]]", "matrix subtraction");
expect(result("2*[[1/2,2],[3,4]]").result, "[[1, 4], [6, 8]]", "scalar multiplication with fractions");
expect(result("[[1,2],[3,4]] * [[2,0],[1,2]]").result, "[[4, 4], [10, 8]]", "matrix multiplication");
expect(result("[[1,2],[3,4]] * [5,6]").result, "[17, 39]", "matrix vector multiplication");
expect(result("[1,2] * [3,4]").result, "11", "vector dot product");
expect(result("transpose([[1,2,3],[4,5,6]])").result, "[[1, 4], [2, 5], [3, 6]]", "rectangular transpose");
expect(result("det([[1,2],[3,4]])").result, "−2", "determinant");
expect(result("det([[0,1],[2,3]])").result, "−2", "determinant row swap");
expect(result("det([[1,2],[2,4]])").result, "0", "singular determinant");
expect(result("det([[1,2,3],[0,1,4],[5,6,0]])").result, "1", "three by three determinant");
expect(result("inv([[1,2],[3,4]])").result, "[[−2, 1], [3/2, −1/2]]", "matrix inverse");
expect(result("[[1,2,3],[0,1,4],[5,6,0]] * inv([[1,2,3],[0,1,4],[5,6,0]])").result,
  "[[1, 0, 0], [0, 1, 0], [0, 0, 1]]", "three by three inverse reconstructs identity");
expect(result("inv([[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]])").result,
  "[[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]", "four by four inverse");
expect(result("rref([[1,2,3],[2,4,6]])").result, "[[1, 2, 3], [0, 0, 0]]", "rectangular row reduction");
expect(result("solve([[2,1],[1,-1]],[5,1])").result, "x1 = 2, x2 = 1", "unique linear system");
expect(result("solve([[1,1],[2,2]],[2,4])").result, "x1 = 2 − t1, x2 = t1", "dependent linear system");
expect(result("solve([[1,1]],[0])").result, "x1 = −t1, x2 = t1", "free parameter with zero constant");
expect(result("solve([[1,1],[2,2]],[2,5])").result, "No solution", "inconsistent linear system");
expect(result("solve([[1,1,1],[0,1,1]],[3,2])").result, "x1 = 1, x2 = 2 − t1, x3 = t1", "rectangular free-variable system");

const builderA = [["1", "2"], ["3", "4"]];
const builderB = [["5", "6"], ["7", "8"]];
for (const [operation, values, expected] of [
  ["det", { a: builderA }, "−2"],
  ["inverse", { a: builderA }, "[[−2, 1], [3/2, −1/2]]"],
  ["rref", { a: builderA }, "[[1, 0], [0, 1]]"],
  ["transpose", { a: builderA }, "[[1, 3], [2, 4]]"],
  ["add", { a: builderA, b: builderB }, "[[6, 8], [10, 12]]"],
  ["subtract", { a: builderA, b: builderB }, "[[−4, −4], [−4, −4]]"],
  ["multiply", { a: builderA, b: builderB }, "[[19, 22], [43, 50]]"],
  ["scale", { a: builderA, scalar: "1/2" }, "[[1/2, 1], [3/2, 2]]"],
  ["scale", { a: builderA, scalar: "0.5" }, "[[1/2, 1], [3/2, 2]]"],
  ["matrixVector", { a: builderA, vector: ["5", "6"] }, "[17, 39]"],
  ["solve", { a: [["2", "1"], ["1", "−1"]], vector: ["5", "1"] }, "x1 = 2, x2 = 1"],
]) {
  const shape = matrixShape(operation, 2, 2, 2);
  expect(result(buildMatrixExpression(operation, shape, values)).result, expected, `guided ${operation}`);
}
expect(JSON.stringify(matrixShape("multiply", 2, 3, 4)),
  JSON.stringify({ a: { rows: 2, columns: 3 }, b: { rows: 3, columns: 4 } }), "guided multiplication dimensions");
expect(JSON.stringify(matrixShape("solve", 2, 3, 4)),
  JSON.stringify({ a: { rows: 2, columns: 3 }, vector: 2 }), "guided system dimensions");
expect(JSON.stringify(matrixShape("det", 3, 1, 1)),
  JSON.stringify({ a: { rows: 3, columns: 3 } }), "guided square dimensions");
const largeMatrix = Array.from({ length: 4 }, () => Array(4).fill("-100000/100000"));
const largeExpression = buildMatrixExpression("add", matrixShape("add", 4, 4, 4), { a: largeMatrix, b: largeMatrix });
expect(result(largeExpression).result,
  "[[−2, −2, −2, −2], [−2, −2, −2, −2], [−2, −2, −2, −2], [−2, −2, −2, −2]]",
  "guided four by four fractions fit input limit");

const systemSteps = result("solve([[2,1],[1,-1]],[5,1])").steps;
expect(systemSteps.some((step) => step.title === "Form the augmented matrix"), true, "system shows augmented matrix");
expect(systemSteps.some((step) => step.title === "Clear a column"), true, "system shows elimination");
expect(systemSteps.at(-1).math, "[5, 1] = [5, 1]", "system substitution check");

const steps = result("3x + 2 = x + 10").steps;
expect(steps.some((step) => step.math === "2x + 2 = 10"), true, "move x terms step");
expect(steps.some((step) => step.math === "2x = 8"), true, "move constants step");
expect(steps.at(-1).math, "14 = 14", "substitution check");

for (const [input, issue] of [
  ["1/0", "Division by zero"],
  ["1.1234567+2", "six digits"],
  ["100000.000001", "up to 100,000"],
  ["1+", "ends too soon"],
  ["1=2=3", "one equals sign"],
  ["[[1,2],[3]]", "same number"],
  ["[[1,2],[3,4]] + [[1,2,3],[4,5,6]]", "same dimensions"],
  ["[[1,2]] * [[1,2]]", "inner dimensions"],
  ["inv([[1,2],[2,4]])", "singular"],
  ["det([[1,2,3],[4,5,6]])", "square"],
  ["solve([[1,2],[3,4]],[1])", "2 entries"],
  ["[[1,2],[3,4]] = [1,2]", "solve(A, b)"],
  ["[[1,x],[3,4]]", "must be numbers"],
  ["[[1,2],[3,4]] / 0", "Division by zero"],
  ["[1,2,3,4,5]", "1 to 4"],
  ["0^0", "undefined"],
  ["2^21", "magnitude up to 20"],
  ["sqrt(-1)", "no real"],
  ["root(4,-16)", "no real"],
  ["root(1,8)", "index from 2 to 12"],
  ["x^3=0", "up to 2"],
  ["x/(x+1)=1", "Division by an expression containing x"],
  ["x^-1=1", "up to 2"],
  ["sqrt(x)=2", "Roots containing x"],
  ["[[sqrt(2)]]", "irrational"],
  ["\\frac{1}{", "Close the braces"],
]) {
  let message = "";
  try { result(input); } catch (error) { message = String(error.message); }
  expect(message.includes(issue), true, `clear error for ${input}`);
}

// Generated monic quadratics have known integer roots, including repeated roots.
for (let leftRoot = -3; leftRoot <= 3; leftRoot += 1) {
  for (let rightRoot = leftRoot; rightRoot <= 3; rightRoot += 1) {
    const equation = `x^2 - (${leftRoot + rightRoot})x + (${leftRoot * rightRoot}) = 0`;
    const expected = leftRoot === rightRoot ? `x = ${leftRoot}` : `x = ${leftRoot}, ${rightRoot}`;
    expect(result(equation).result, expected.replaceAll("-", "−"), `generated quadratic ${equation}`);
  }
}

for (const [operation, shape, values, issue] of [
  ["det", matrixShape("det", 2, 2, 2), { a: [["1", ""], ["3", "4"]] }, "matrix A, row 1, column 2"],
  ["scale", matrixShape("scale", 2, 2, 2), { a: builderA, scalar: "1.1234567" }, "whole number, decimal, or fraction"],
  ["det", matrixShape("det", 2, 2, 2), { a: [["1", "2],[0,0"], ["3", "4"]] }, "whole number, decimal, or fraction"],
]) {
  let message = "";
  try { buildMatrixExpression(operation, shape, values); } catch (error) { message = String(error.message); }
  expect(message.includes(issue), true, `guided input error for ${operation}`);
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
