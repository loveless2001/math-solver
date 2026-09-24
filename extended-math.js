const ZERO = { exact: true, n: 0n, d: 1n };
const ONE = { exact: true, n: 1n, d: 1n };
const TWO = { exact: true, n: 2n, d: 1n };
const FOUR = { exact: true, n: 4n, d: 1n };
const MAX_PART = 281474976710655n;

export class ExtendedMathError extends Error {
  constructor(message) {
    super(message);
    this.name = "ExtendedMathError";
  }
}

const abs = (value) => value < 0n ? -value : value;
function gcd(left, right) {
  while (right) [left, right] = [right, left % right];
  return left;
}

function rational(n, d = 1n) {
  if (d === 0n) throw new ExtendedMathError("Division by zero is undefined.");
  if (d < 0n) { n = -n; d = -d; }
  const factor = gcd(abs(n), d);
  n /= factor;
  d /= factor;
  if (abs(n) > MAX_PART || d > MAX_PART) {
    throw new ExtendedMathError("This result is too large for the current power and root solver. Try smaller numbers.");
  }
  return { exact: true, n, d };
}

function approximate(value) {
  if (!Number.isFinite(value) || Math.abs(value) > Number(MAX_PART)) {
    throw new ExtendedMathError("This result is too large or outside the real numbers.");
  }
  return { exact: false, value };
}

const fromQ = (q) => rational(q.negative ? -q.numerator : q.numerator, q.denominator);
const toNumber = (value) => value.exact ? Number(value.n) / Number(value.d) : value.value;
const isZero = (value) => value.exact ? value.n === 0n : Math.abs(value.value) < 1e-12;
const isNegative = (value) => toNumber(value) < 0;
const neg = (value) => value.exact ? rational(-value.n, value.d) : approximate(-value.value);
const add = (left, right) => left.exact && right.exact
  ? rational(left.n * right.d + right.n * left.d, left.d * right.d)
  : approximate(toNumber(left) + toNumber(right));
const sub = (left, right) => add(left, neg(right));
const mul = (left, right) => left.exact && right.exact
  ? rational(left.n * right.n, left.d * right.d)
  : approximate(toNumber(left) * toNumber(right));
function div(left, right) {
  if (isZero(right)) throw new ExtendedMathError("Division by zero is undefined.");
  return left.exact && right.exact
    ? rational(left.n * right.d, left.d * right.n)
    : approximate(toNumber(left) / toNumber(right));
}

function integerRoot(value, degree) {
  if (value < 0n) return null;
  let low = 0n;
  let high = value + 1n;
  while (high - low > 1n) {
    const mid = (low + high) / 2n;
    if (mid ** BigInt(degree) <= value) low = mid;
    else high = mid;
  }
  return low ** BigInt(degree) === value ? low : null;
}

function root(degree, value) {
  if (!degree.exact || degree.d !== 1n || degree.n < 2n || degree.n > 12n) {
    throw new ExtendedMathError("Use an integer root index from 2 to 12.");
  }
  const index = Number(degree.n);
  if (isNegative(value) && index % 2 === 0) {
    throw new ExtendedMathError("An even root of a negative number has no real value.");
  }
  if (value.exact) {
    const numerator = integerRoot(abs(value.n), index);
    const denominator = integerRoot(value.d, index);
    if (numerator !== null && denominator !== null) {
      return rational(value.n < 0n ? -numerator : numerator, denominator);
    }
  }
  const numeric = toNumber(value);
  return approximate(numeric < 0 ? -Math.pow(-numeric, 1 / index) : Math.pow(numeric, 1 / index));
}

function power(base, exponent) {
  const exponentNumber = toNumber(exponent);
  if (Math.abs(exponentNumber) > 20) throw new ExtendedMathError("Use powers with exponent magnitude up to 20.");
  if (isZero(base) && exponentNumber <= 0) throw new ExtendedMathError("Zero to a zero or negative power is undefined.");
  if (exponent.exact && exponent.d === 1n && base.exact) {
    const count = abs(exponent.n);
    const result = rational(base.n ** count, base.d ** count);
    return exponent.n < 0n ? div(ONE, result) : result;
  }
  if (exponent.exact && exponent.d <= 12n && base.exact) {
    const baseRoot = root(rational(exponent.d), base);
    if (baseRoot.exact) return power(baseRoot, rational(exponent.n));
  }
  const numericBase = toNumber(base);
  if (numericBase < 0 && (!exponent.exact || exponent.d % 2n === 0n)) {
    throw new ExtendedMathError("This power has no real value for a negative base.");
  }
  const magnitude = Math.pow(Math.abs(numericBase), exponentNumber);
  const signed = numericBase < 0 && exponent.exact && abs(exponent.n) % 2n === 1n ? -magnitude : magnitude;
  return approximate(signed);
}

function format(value) {
  if (value.exact) {
    const numerator = `${value.n < 0n ? "−" : ""}${abs(value.n)}`;
    return value.d === 1n ? numerator : `${numerator}/${value.d}`;
  }
  const rounded = Number(value.value.toFixed(6));
  return String(Object.is(rounded, -0) ? 0 : rounded).replace("-", "−");
}

function polynomial(...coefficients) {
  return [coefficients[0] ?? ZERO, coefficients[1] ?? ZERO, coefficients[2] ?? ZERO];
}
const degree = (coefficients) => !isZero(coefficients[2]) ? 2 : !isZero(coefficients[1]) ? 1 : 0;
const plus = (left, right) => polynomial(...left.map((value, index) => add(value, right[index])));
const minus = (left, right) => polynomial(...left.map((value, index) => sub(value, right[index])));
function times(left, right) {
  const result = [ZERO, ZERO, ZERO];
  for (let i = 0; i <= 2; i += 1) for (let j = 0; j <= 2; j += 1) {
    if (isZero(left[i]) || isZero(right[j])) continue;
    if (i + j > 2) throw new ExtendedMathError("This version handles polynomial expressions up to degree 2 in x.");
    result[i + j] = add(result[i + j], mul(left[i], right[j]));
  }
  return result;
}

function evaluate(node) {
  if (node.$ === "Number") return polynomial(fromQ(node.value));
  if (node.$ === "Variable") return polynomial(ZERO, ONE);
  if (node.$ === "Array") throw new ExtendedMathError("Use powers and roots on numbers or x, not on matrices.");
  if (node.$ === "Call") {
    if (!["sqrt", "cbrt", "root"].includes(node.name)) {
      throw new ExtendedMathError("Use matrix functions separately from powers and roots.");
    }
    const expected = node.name === "root" ? 2 : 1;
    if (node.args.length !== expected) throw new ExtendedMathError(`${node.name} needs ${expected} argument${expected === 1 ? "" : "s"}.`);
    const args = node.args.map(evaluate);
    if (args.some((arg) => degree(arg) !== 0)) {
      throw new ExtendedMathError("Roots containing x are not supported; use a numeric radicand.");
    }
    const result = node.name === "sqrt" ? root(TWO, args[0][0])
      : node.name === "cbrt" ? root(rational(3n), args[0][0]) : root(args[0][0], args[1][0]);
    return polynomial(result);
  }
  const left = evaluate(node.left);
  const right = evaluate(node.right);
  if (node.$ === "Plus") return plus(left, right);
  if (node.$ === "Minus") return minus(left, right);
  if (node.$ === "Times") return times(left, right);
  if (node.$ === "Over") {
    if (degree(right) !== 0) throw new ExtendedMathError("Division by an expression containing x is not supported.");
    return polynomial(...left.map((coefficient) => div(coefficient, right[0])));
  }
  if (node.$ === "Power") {
    if (degree(right) !== 0) throw new ExtendedMathError("The exponent must be a number.");
    if (degree(left) === 0) return polynomial(power(left[0], right[0]));
    if (!right[0].exact || right[0].d !== 1n || right[0].n < 0n || right[0].n > 2n) {
      throw new ExtendedMathError("Powers containing x need a nonnegative integer exponent up to 2.");
    }
    let result = polynomial(ONE);
    for (let i = 0; i < Number(right[0].n); i += 1) result = times(result, left);
    return result;
  }
  throw new ExtendedMathError("I could not evaluate this expression.");
}

function containsVariable(node) {
  if (node.$ === "Variable") return true;
  if (node.$ === "Number") return false;
  if (node.$ === "Call") return node.args.some(containsVariable);
  if (node.$ === "Array") return node.items.some(containsVariable);
  return containsVariable(node.left) || containsVariable(node.right);
}

export function needsExtendedSolver(node) {
  if (node.$ === "Number" || node.$ === "Variable") return false;
  if (node.$ === "Array") return node.items.some(needsExtendedSolver);
  if (node.$ === "Call") return ["sqrt", "cbrt", "root"].includes(node.name) || node.args.some(needsExtendedSolver);
  return node.$ === "Power" || (node.$ === "Times" && containsVariable(node.left) && containsVariable(node.right))
    || needsExtendedSolver(node.left) || needsExtendedSolver(node.right);
}

function asQ(value) {
  return { $: "Number", value: { $: "Q", negative: value.n < 0n, numerator: abs(value.n), denominator: value.d } };
}

export function lowerExactMatrixMath(node) {
  if (node.$ === "Number" || node.$ === "Variable") return node;
  if (node.$ === "Array") return { ...node, items: node.items.map(lowerExactMatrixMath) };
  if (node.$ === "Call" && ["sqrt", "cbrt", "root"].includes(node.name) || node.$ === "Power") {
    const result = evaluate(node);
    if (degree(result) !== 0 || !result[0].exact) {
      throw new ExtendedMathError("Matrix entries need exact values; this root or power is irrational.");
    }
    return asQ(result[0]);
  }
  if (node.$ === "Call") return { ...node, args: node.args.map(lowerExactMatrixMath) };
  return { ...node, left: lowerExactMatrixMath(node.left), right: lowerExactMatrixMath(node.right) };
}

function formatPolynomial(coefficients) {
  let output = "";
  for (let index = 2; index >= 0; index -= 1) {
    const value = coefficients[index];
    if (isZero(value)) continue;
    const negative = isNegative(value);
    const magnitude = format(negative ? neg(value) : value);
    const term = index === 0 ? magnitude : `${magnitude === "1" ? "" : magnitude}${index === 2 ? "x²" : "x"}`;
    output += output ? ` ${negative ? "−" : "+"} ${term}` : `${negative ? "−" : ""}${term}`;
  }
  return output || "0";
}

function startStep(input) {
  return { title: "Start", math: input.trim().replaceAll("*", "×").replaceAll("-", "−"), detail: "Read the expression as written." };
}

function expressionText(node) {
  if (node.$ === "Number") return format(fromQ(node.value));
  if (node.$ === "Variable") return "x";
  if (node.$ === "Call") return `${node.name}(${node.args.map(expressionText).join(", ")})`;
  if (node.$ === "Minus" && node.left.$ === "Number" && node.left.value.numerator === 0n) {
    return `−${expressionText(node.right)}`;
  }
  if (node.$ === "Power") return `${expressionText(node.left)}^(${expressionText(node.right)})`;
  const symbol = { Plus: "+", Minus: "−", Times: "×", Over: "÷" }[node.$];
  return `(${expressionText(node.left)} ${symbol} ${expressionText(node.right)})`;
}

function operationSteps(node, steps) {
  if (node.$ === "Number" || node.$ === "Variable") return;
  if (node.$ === "Call") node.args.forEach((arg) => operationSteps(arg, steps));
  else { operationSteps(node.left, steps); operationSteps(node.right, steps); }
  if (node.$ !== "Power" && !(node.$ === "Call" && ["sqrt", "cbrt", "root"].includes(node.name))) return;
  if (containsVariable(node)) return;
  const value = evaluate(node)[0];
  steps.push({
    title: node.$ === "Power" ? "Evaluate the power" : "Take the root",
    math: `${expressionText(node)} ${value.exact ? "=" : "≈"} ${format(value)}`,
    detail: value.exact ? "This value is exact." : "This irrational value is rounded to six decimal places.",
  });
}

function solveEquation(coefficients, input) {
  const coefficientsExact = coefficients.every((value) => value.exact);
  const steps = [startStep(input), {
    title: "Collect terms",
    math: `${coefficientsExact ? "" : "≈ "}${formatPolynomial(coefficients)} = 0`,
    detail: coefficientsExact ? "Move everything to one side and combine like powers of x."
      : "Move everything to one side; irrational coefficients are shown rounded to six decimal places.",
  }];
  const [c, b, a] = coefficients;
  if (degree(coefficients) === 0) {
    const same = isZero(c);
    return { kind: "equation", heading: same ? "Every x is a solution" : "No solution", result: same ? "All real values of x" : "No value of x", steps };
  }
  if (degree(coefficients) === 1) {
    const answer = div(neg(c), b);
    const exact = answer.exact;
    const result = `x ${exact ? "=" : "≈"} ${format(answer)}`;
    steps.push({ title: "Divide by the coefficient", math: result, detail: exact ? "The solution is exact." : "The value is rounded to six decimal places." });
    return { kind: "equation", heading: exact ? "Solution" : "Approximate solution", result, steps };
  }
  const discriminant = sub(mul(b, b), mul(FOUR, mul(a, c)));
  steps.push({ title: "Find the discriminant",
    math: `D = (${format(b)})² − 4(${format(a)})(${format(c)}) ${discriminant.exact ? "=" : "≈"} ${format(discriminant)}`,
    detail: "Its sign tells us how many real roots there are." });
  if (isNegative(discriminant) && !isZero(discriminant)) {
    return { kind: "equation", heading: "No real solution", result: "No real solutions", steps };
  }
  const radical = root(TWO, isZero(discriminant) ? ZERO : discriminant);
  steps.push({ title: "Use the quadratic formula", math: "x = (−b ± √D)/(2a)", detail: "Substitute the coefficients and take both signs." });
  steps.push({ title: "Substitute the coefficients",
    math: `x = (−(${format(b)}) ± √(${format(discriminant)}))/(2(${format(a)}))`,
    detail: "Use the coefficient values and both the plus and minus signs." });
  const denominator = mul(TWO, a);
  const answers = [div(sub(neg(b), radical), denominator), div(add(neg(b), radical), denominator)]
    .sort((left, right) => toNumber(left) - toNumber(right));
  const repeated = isZero(discriminant);
  const exact = answers.every((answer) => answer.exact);
  const values = repeated ? [answers[0]] : answers;
  const result = `x ${exact ? "=" : "≈"} ${values.map(format).join(", ")}`;
  steps.push({ title: exact ? "Exact real roots" : "Approximate real roots", math: result,
    solutions: values.map(format), approximate: !exact,
    detail: exact ? "These values satisfy the equation exactly." : "These real roots are rounded to six decimal places." });
  return { kind: "equation", heading: repeated ? "One repeated root" : exact ? "Real solutions" : "Approximate real solutions",
    result, solutions: values.map(format), approximate: !exact, steps };
}

export function solveExtendedProblem(problem, input) {
  if (problem.kind === "equation") {
    const answer = solveEquation(minus(evaluate(problem.left), evaluate(problem.right)), input);
    const calculations = [];
    operationSteps(problem.left, calculations);
    operationSteps(problem.right, calculations);
    answer.steps.splice(1, 0, ...calculations);
    return answer;
  }
  const coefficients = evaluate(problem.expression);
  const steps = [startStep(input)];
  operationSteps(problem.expression, steps);
  const value = degree(coefficients) === 0 ? format(coefficients[0]) : formatPolynomial(coefficients);
  const exact = coefficients.every((value) => value.exact);
  const result = exact ? value : `≈ ${value}`;
  steps.push({ title: exact ? "Simplify exactly" : "Approximate the result", math: result,
    detail: exact ? "Powers and roots that reduce rationally stay exact." : "An irrational root makes this value approximate; it is rounded to six decimal places." });
  return { kind: "calculation", heading: exact ? "Exact answer" : "Approximate answer", result, steps };
}
