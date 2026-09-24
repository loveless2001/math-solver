import { solveMatrixProblem } from "./matrix.js";
import { lowerExactMatrixMath, needsExtendedSolver, solveExtendedProblem } from "./extended-math.js";

const ZERO = { $: "Q", negative: false, numerator: 0n, denominator: 1n };

export class MathProblemError extends Error {
  constructor(message) {
    super(message);
    this.name = "MathProblemError";
  }
}

function isZero(value) {
  return value.numerator === 0n;
}

function isOne(value) {
  return !value.negative && value.numerator === value.denominator;
}

function magnitude(value) {
  return value.denominator === 1n
    ? String(value.numerator)
    : `${value.numerator}/${value.denominator}`;
}

export function formatRational(value) {
  return `${value.negative && !isZero(value) ? "−" : ""}${magnitude(value)}`;
}

function xTerm(value) {
  if (isOne(value)) return "x";
  if (value.negative && value.numerator === value.denominator) return "−x";
  const absolute = magnitude(value);
  const coefficient = value.denominator === 1n ? absolute : `(${absolute})`;
  return `${value.negative ? "−" : ""}${coefficient}x`;
}

export function formatLinear(line) {
  const { coefficient, constant } = line;
  if (isZero(coefficient)) return formatRational(constant);
  if (isZero(constant)) return xTerm(coefficient);
  return `${xTerm(coefficient)} ${constant.negative ? "−" : "+"} ${magnitude(constant)}`;
}

function normalInput(input) {
  return input.trim().replaceAll("*", "×").replaceAll("-", "−");
}

function hasVariable(expression) {
  if (expression.$ === "Variable") return true;
  if (expression.$ === "Number") return false;
  return hasVariable(expression.left) || hasVariable(expression.right);
}

function problemMessage(problem) {
  if (problem.$ === "DivisionByZero") {
    return "Division by zero is undefined. Check the denominator.";
  }
  return "This version handles polynomial expressions up to degree 2 in x. Division by an expression containing x is not supported.";
}

function lineFor(expression, engine) {
  const result = engine.evaluate(expression);
  if (result.$ === "Failed") throw new MathProblemError(problemMessage(result.problem));
  return result.line;
}

function operationSteps(expression, engine, steps) {
  if (expression.$ === "Number" || expression.$ === "Variable") return;
  operationSteps(expression.left, engine, steps);
  operationSteps(expression.right, engine, steps);
  const left = lineFor(expression.left, engine);
  const right = lineFor(expression.right, engine);
  const result = lineFor(expression, engine);
  if (!isZero(left.coefficient) || !isZero(right.coefficient)) return;
  const symbol = { Plus: "+", Minus: "−", Times: "×", Over: "÷" }[expression.$];
  steps.push({
    title: "Calculate",
    math: `${formatRational(left.constant)} ${symbol} ${formatRational(right.constant)} = ${formatRational(result.constant)}`,
    detail: expression.$ === "Over" ? "Divide the fractions and reduce the result." : "Work through this operation, then simplify the fraction.",
  });
}

function makeExpressionResult(problem, input, engine) {
  const evaluated = engine.evaluate(problem.expression);
  if (evaluated.$ === "Failed") throw new MathProblemError(problemMessage(evaluated.problem));

  const steps = [{ title: "Start", math: normalInput(input), detail: "Read the expression as written." }];
  const result = formatLinear(evaluated.line);
  if (isZero(evaluated.line.coefficient)) {
    operationSteps(problem.expression, engine, steps);
    if (steps.at(-1).math !== result) {
      steps.push({ title: "Exact result", math: result, detail: "The fraction is in lowest terms." });
    }
    return { kind: "calculation", heading: "Exact answer", result, steps };
  }
  steps.push({
    title: "Collect like terms",
    math: result,
    detail: "Distribute multiplication, then group the x terms and the constants.",
  });
  return { kind: "simplification", heading: "Simplified expression", result, steps };
}

function checkSolution(answer, engine) {
  const leftValue = engine.add(engine.multiply(answer.left.coefficient, answer.value), answer.left.constant);
  const rightValue = engine.add(engine.multiply(answer.right.coefficient, answer.value), answer.right.constant);
  if (formatRational(leftValue) !== formatRational(rightValue)) {
    throw new Error("The answer did not pass substitution. Please report this problem.");
  }
  return `${formatRational(leftValue)} = ${formatRational(rightValue)}`;
}

function makeEquationResult(problem, input, engine) {
  const answer = engine.solve(problem.left, problem.right);
  if (answer.$ === "CannotSolve") throw new MathProblemError(problemMessage(answer.problem));

  const usesX = hasVariable(problem.left) || hasVariable(problem.right);
  const steps = [{ title: "Start", math: normalInput(input), detail: "Write down the original equation." }];
  const left = answer.left;
  const right = answer.right;
  const collected = `${formatLinear(left)} = ${formatLinear(right)}`;
  if (collected !== steps[0].math) {
    steps.push({
      title: "Simplify each side",
      math: collected,
      detail: "Distribute multiplication and combine like terms on each side.",
    });
  }

  if (answer.$ === "EveryValue" || answer.$ === "NoValue") {
    const same = answer.$ === "EveryValue";
    steps.push({
      title: "Remove matching x terms",
      math: `${formatRational(left.constant)} = ${formatRational(right.constant)}`,
      detail: "Subtract the same x term from both sides.",
    });
    steps.push({
      title: same ? "Both sides agree" : "The sides disagree",
      math: same ? "true" : "false",
      detail: same
        ? (usesX ? "The equation holds for every value of x." : "Both sides have the same value.")
        : (usesX ? "No value of x can make these constants equal." : "The two sides have different values."),
    });
    return {
      kind: "equation",
      heading: same ? (usesX ? "Every x is a solution" : "True equality") : (usesX ? "No solution" : "False equality"),
      result: same ? (usesX ? "All real values of x" : "True") : (usesX ? "No value of x" : "False"),
      steps,
    };
  }

  if (!isZero(right.coefficient)) {
    steps.push({
      title: "Move x terms left",
      math: `${formatLinear({ coefficient: answer.coefficient, constant: left.constant })} = ${formatRational(right.constant)}`,
      detail: `Subtract ${formatLinear({ coefficient: right.coefficient, constant: ZERO })} from both sides.`,
    });
  }
  if (!isZero(left.constant)) {
    steps.push({
      title: "Move constants right",
      math: `${formatLinear({ coefficient: answer.coefficient, constant: ZERO })} = ${formatRational(answer.target)}`,
      detail: `Subtract ${formatRational(left.constant)} from both sides.`,
    });
  }
  const result = `x = ${formatRational(answer.value)}`;
  if (!isOne(answer.coefficient)) {
    steps.push({
      title: "Divide by the coefficient",
      math: result,
      detail: `Divide both sides by ${formatRational(answer.coefficient)}.`,
    });
  }
  steps.push({
    title: "Check the answer",
    math: checkSolution(answer, engine),
    detail: "Substitute the result into the original equation. Both sides agree.",
  });
  return { kind: "equation", heading: "Solution", result, steps };
}

export function solveProblem(problem, input, engine) {
  if (problem.kind === "matrix") {
    return solveMatrixProblem({ ...problem, expression: lowerExactMatrixMath(problem.expression) }, input, engine);
  }
  if (problem.kind === "equation" ? needsExtendedSolver(problem.left) || needsExtendedSolver(problem.right)
    : needsExtendedSolver(problem.expression)) return solveExtendedProblem(problem, input);
  return problem.kind === "equation"
    ? makeEquationResult(problem, input, engine)
    : makeExpressionResult(problem, input, engine);
}
