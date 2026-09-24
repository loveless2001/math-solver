import { formatRational } from "./steps.js";

const ZERO = { $: "Q", negative: false, numerator: 0n, denominator: 1n };
const ONE = { $: "Q", negative: false, numerator: 1n, denominator: 1n };
const MAX_DIMENSION = 4;

export class MatrixProblemError extends Error {
  constructor(message) {
    super(message);
    this.name = "MatrixProblemError";
  }
}

const scalar = (value) => ({ kind: "scalar", value });
const vector = (value) => ({ kind: "vector", value });
const matrix = (value) => ({ kind: "matrix", value });
const zero = (value) => value.numerator === 0n;
const same = (left, right) => left.negative === right.negative && left.numerator === right.numerator && left.denominator === right.denominator;

function fail(message) {
  throw new MatrixProblemError(message);
}

function format(value) {
  if (value.kind === "scalar") return formatRational(value.value);
  if (value.kind === "vector") return `[${value.value.map(formatRational).join(", ")}]`;
  return `[${value.value.map((row) => `[${row.map(formatRational).join(", ")}]`).join(", ")}]`;
}

function dimensions(value) {
  return value.kind === "vector" ? `${value.value.length} entries` : `${value.value.length}×${value.value[0].length}`;
}

function requireMatrix(value, name) {
  if (value.kind !== "matrix") fail(`${name} needs a matrix such as [[1, 2], [3, 4]].`);
  return value.value;
}

function requireSquare(rows, name) {
  if (rows.length !== rows[0].length) fail(`${name} needs a square matrix.`);
}

function record(steps, title, math, detail) {
  steps.push({ title, math, detail });
}

function rowReduction(input, pivotColumns, engine, steps) {
  const rows = input.map((row) => [...row]);
  const pivots = [];
  for (let column = 0; column < pivotColumns && pivots.length < rows.length; column += 1) {
    const pivotRow = pivots.length;
    let source = pivotRow;
    while (source < rows.length && zero(rows[source][column])) source += 1;
    if (source === rows.length) continue;
    if (source !== pivotRow) {
      [rows[pivotRow], rows[source]] = [rows[source], rows[pivotRow]];
      record(steps, "Swap rows", format(matrix(rows)), `Exchange R${pivotRow + 1} and R${source + 1} to get a nonzero pivot.`);
    }
    const pivot = rows[pivotRow][column];
    if (!same(pivot, ONE)) {
      rows[pivotRow] = rows[pivotRow].map((entry) => engine.divide(entry, pivot));
      record(steps, "Scale a row", format(matrix(rows)), `Divide R${pivotRow + 1} by ${formatRational(pivot)} so its pivot is 1.`);
    }
    for (let row = 0; row < rows.length; row += 1) {
      if (row === pivotRow || zero(rows[row][column])) continue;
      const factor = rows[row][column];
      rows[row] = rows[row].map((entry, index) => engine.subtract(entry, engine.multiply(factor, rows[pivotRow][index])));
      record(steps, "Clear a column", format(matrix(rows)), `Replace R${row + 1} with R${row + 1} − (${formatRational(factor)})R${pivotRow + 1}.`);
    }
    pivots.push(column);
  }
  return { rows, pivots };
}

function determinant(rows, engine, steps) {
  requireSquare(rows, "det");
  const working = rows.map((row) => [...row]);
  let negative = false;
  for (let column = 0; column < rows.length; column += 1) {
    let source = column;
    while (source < rows.length && zero(working[source][column])) source += 1;
    if (source === rows.length) {
      record(steps, "Zero determinant", "det = 0", `Column ${column + 1} has no pivot, so the rows are dependent.`);
      return ZERO;
    }
    if (source !== column) {
      [working[column], working[source]] = [working[source], working[column]];
      negative = !negative;
      record(steps, "Swap rows", format(matrix(working)), `Exchange R${column + 1} and R${source + 1}; this reverses the determinant's sign.`);
    }
    for (let row = column + 1; row < rows.length; row += 1) {
      if (zero(working[row][column])) continue;
      const factor = engine.divide(working[row][column], working[column][column]);
      working[row] = working[row].map((entry, index) => engine.subtract(entry, engine.multiply(factor, working[column][index])));
      record(steps, "Eliminate below pivot", format(matrix(working)), `Replace R${row + 1} with R${row + 1} − (${formatRational(factor)})R${column + 1}.`);
    }
  }
  let answer = negative ? engine.subtract(ZERO, ONE) : ONE;
  for (let index = 0; index < rows.length; index += 1) answer = engine.multiply(answer, working[index][index]);
  record(steps, "Multiply diagonal", `det = ${formatRational(answer)}`, "Multiply the diagonal entries; a row swap changes the sign.");
  return answer;
}

function inverse(rows, engine, steps) {
  requireSquare(rows, "inv");
  const size = rows.length;
  const augmented = rows.map((row, index) => [...row, ...rows.map((_, column) => index === column ? ONE : ZERO)]);
  record(steps, "Augment with identity", format(matrix(augmented)), "Place the identity matrix to the right of the original matrix.");
  const reduced = rowReduction(augmented, size, engine, steps);
  if (reduced.pivots.length !== size) fail("This matrix is singular, so it has no inverse.");
  const answer = reduced.rows.map((row) => row.slice(size));
  record(steps, "Read the inverse", format(matrix(answer)), "The left half is now the identity; the right half is the inverse.");
  return matrix(answer);
}

function coefficientTerm(value, name) {
  const magnitude = formatRational({ ...value, negative: false });
  return `${magnitude === "1" ? "" : magnitude.includes("/") ? `(${magnitude})` : magnitude}${name}`;
}

function parameterAnswer(rows, pivots, columns, engine) {
  const free = Array.from({ length: columns }, (_, index) => index).filter((index) => !pivots.includes(index));
  const assignments = Array(columns);
  free.forEach((column, index) => { assignments[column] = `x${column + 1} = t${index + 1}`; });
  pivots.forEach((column, row) => {
    const constant = rows[row][columns];
    let expression = zero(constant) ? "" : formatRational(constant);
    free.forEach((freeColumn, index) => {
      const coefficient = engine.subtract(ZERO, rows[row][freeColumn]);
      if (zero(coefficient)) return;
      const term = coefficientTerm(coefficient, `t${index + 1}`);
      expression += expression
        ? ` ${coefficient.negative ? "−" : "+"} ${term}`
        : `${coefficient.negative ? "−" : ""}${term}`;
    });
    assignments[column] = `x${column + 1} = ${expression || "0"}`;
  });
  return assignments.join(", ");
}

function solveSystem(coefficients, target, engine, steps) {
  const rows = requireMatrix(coefficients, "solve");
  if (target.kind !== "vector" || target.value.length !== rows.length) {
    fail(`solve needs a vector with ${rows.length} entries, one for each matrix row.`);
  }
  const columns = rows[0].length;
  const augmented = rows.map((row, index) => [...row, target.value[index]]);
  record(steps, "Form the augmented matrix", format(matrix(augmented)), "Append the right-hand side as the last column.");
  const reduced = rowReduction(augmented, columns, engine, steps);
  for (const row of reduced.rows) {
    if (row.slice(0, columns).every(zero) && !zero(row[columns])) {
      record(steps, "Check consistency", "0 = " + formatRational(row[columns]), "This row is impossible, so the system has no solution.");
      return { result: "No solution", heading: "Inconsistent system" };
    }
  }
  if (reduced.pivots.length < columns) {
    const result = parameterAnswer(reduced.rows, reduced.pivots, columns, engine);
    record(steps, "Describe all solutions", result, "Each t is a free parameter and may be any real number.");
    return { result, heading: "Infinitely many solutions" };
  }
  const answer = reduced.pivots.map((_, row) => reduced.rows[row][columns]);
  const result = answer.map((value, index) => `x${index + 1} = ${formatRational(value)}`).join(", ");
  const checked = rows.map((row) => row.reduce((total, entry, index) => engine.add(total, engine.multiply(entry, answer[index])), ZERO));
  if (!checked.every((value, index) => same(value, target.value[index]))) throw new Error("Matrix solution failed substitution.");
  record(steps, "Check the solution", `${format(vector(checked))} = ${format(target)}`, "Multiplying the original matrix by the solution reproduces the right-hand side.");
  return { result, heading: "Solution" };
}

function entrywise(left, right, operator) {
  if (left.kind !== right.kind || left.kind === "scalar") fail("Matrix addition and subtraction need matching matrix or vector shapes.");
  if (left.kind === "vector") {
    if (left.value.length !== right.value.length) fail("Vectors must have the same number of entries.");
    return vector(left.value.map((entry, index) => operator(entry, right.value[index])));
  }
  if (left.value.length !== right.value.length || left.value[0].length !== right.value[0].length) {
    fail("Matrices must have the same dimensions for addition or subtraction.");
  }
  return matrix(left.value.map((row, i) => row.map((entry, j) => operator(entry, right.value[i][j]))));
}

function scale(value, factor, engine) {
  if (value.kind === "vector") return vector(value.value.map((entry) => engine.multiply(entry, factor)));
  return matrix(value.value.map((row) => row.map((entry) => engine.multiply(entry, factor))));
}

function dot(left, right, engine) {
  return left.reduce((total, entry, index) => engine.add(total, engine.multiply(entry, right[index])), ZERO);
}

function product(left, right, engine) {
  if (left.kind === "scalar" && right.kind === "scalar") return scalar(engine.multiply(left.value, right.value));
  if (left.kind === "scalar") return scale(right, left.value, engine);
  if (right.kind === "scalar") return scale(left, right.value, engine);
  if (left.kind === "vector" && right.kind === "vector") {
    if (left.value.length !== right.value.length) fail("A dot product needs vectors of equal length.");
    return scalar(dot(left.value, right.value, engine));
  }
  if (left.kind === "matrix" && right.kind === "vector") {
    if (left.value[0].length !== right.value.length) fail(`Cannot multiply ${dimensions(left)} by ${dimensions(right)}; the inner dimensions must match.`);
    return vector(left.value.map((row) => dot(row, right.value, engine)));
  }
  if (left.kind === "vector" && right.kind === "matrix") {
    if (left.value.length !== right.value.length) fail(`Cannot multiply ${dimensions(left)} by ${dimensions(right)}; the inner dimensions must match.`);
    return vector(right.value[0].map((_, column) => dot(left.value, right.value.map((row) => row[column]), engine)));
  }
  if (left.value[0].length !== right.value.length) fail(`Cannot multiply ${dimensions(left)} by ${dimensions(right)}; the inner dimensions must match.`);
  return matrix(left.value.map((row) => right.value[0].map((_, column) => dot(row, right.value.map((rightRow) => rightRow[column]), engine))));
}

function evaluate(node, engine, steps) {
  if (node.$ === "Number") return scalar(node.value);
  if (node.$ === "Variable") fail("Matrix entries must be numbers. Use solve(A, b) to find unknowns.");
  if (node.$ === "Array") {
    if (node.items.length === 0 || node.items.length > MAX_DIMENSION) fail("Use 1 to 4 entries or rows in a vector or matrix.");
    const items = node.items.map((item) => evaluate(item, engine, steps));
    if (items.every((item) => item.kind === "scalar")) return vector(items.map((item) => item.value));
    if (!items.every((item) => item.kind === "vector")) fail("Use a flat vector [1, 2] or equal-length matrix rows [[1, 2], [3, 4]].");
    const width = items[0].value.length;
    if (!items.every((item) => item.value.length === width)) fail("Every matrix row must have the same number of entries.");
    return matrix(items.map((item) => item.value));
  }
  if (node.$ === "Call") {
    const expected = node.name === "solve" ? 2 : 1;
    if (node.args.length !== expected) fail(`${node.name} needs ${expected} argument${expected === 1 ? "" : "s"}.`);
    const args = node.args.map((arg) => evaluate(arg, engine, steps));
    if (node.name === "solve") return { kind: "system", ...solveSystem(args[0], args[1], engine, steps) };
    const rows = requireMatrix(args[0], node.name);
    if (node.name === "det") return scalar(determinant(rows, engine, steps));
    if (node.name === "inv") return inverse(rows, engine, steps);
    if (node.name === "rref") {
      const reduced = rowReduction(rows, rows[0].length, engine, steps);
      record(steps, "Reduced row echelon form", format(matrix(reduced.rows)), `There are ${reduced.pivots.length} pivot columns (rank ${reduced.pivots.length}).`);
      return matrix(reduced.rows);
    }
    const transposed = rows[0].map((_, column) => rows.map((row) => row[column]));
    const result = matrix(transposed);
    record(steps, "Transpose", format(result), "Turn each row into a column.");
    return result;
  }
  const left = evaluate(node.left, engine, steps);
  const right = evaluate(node.right, engine, steps);
  if (left.kind === "system" || right.kind === "system") fail("Use solve(A, b) by itself.");
  let result;
  if (node.$ === "Plus" || node.$ === "Minus") {
    const operation = node.$ === "Plus" ? engine.add : engine.subtract;
    if (left.kind === "scalar" && right.kind === "scalar") result = scalar(operation(left.value, right.value));
    else if (node.$ === "Minus" && left.kind === "scalar" && zero(left.value) && right.kind !== "scalar") result = scale(right, engine.subtract(ZERO, ONE), engine);
    else result = entrywise(left, right, operation);
  } else if (node.$ === "Times") result = product(left, right, engine);
  else {
    if (right.kind !== "scalar") fail("Division by a matrix or vector is undefined. Use inv(A) for an invertible square matrix.");
    if (zero(right.value)) fail("Division by zero is undefined.");
    result = left.kind === "scalar" ? scalar(engine.divide(left.value, right.value)) : scale(left, engine.divide(ONE, right.value), engine);
  }
  if (left.kind !== "scalar" || right.kind !== "scalar") {
    const title = { Plus: "Add entries", Minus: "Subtract entries", Times: "Multiply", Over: "Divide each entry" }[node.$];
    const detail = node.$ === "Times" && left.kind !== "scalar" && right.kind !== "scalar"
      ? "Take each row's dot product with each column or vector."
      : "Apply the operation to corresponding entries using exact fractions.";
    record(steps, title, format(result), detail);
  }
  return result;
}

export function solveMatrixProblem(problem, input, engine) {
  const steps = [{ title: "Start", math: input.trim().replaceAll("*", "×").replaceAll("-", "−"), detail: "Read the matrix expression as written." }];
  const value = evaluate(problem.expression, engine, steps);
  if (value.kind === "system") return { kind: "system", heading: value.heading, result: value.result, steps };
  const result = format(value);
  if (steps.at(-1).math !== result) record(steps, "Exact result", result, "All entries are reduced fractions.");
  return { kind: value.kind, heading: value.kind === "scalar" ? "Exact answer" : value.kind === "vector" ? "Resulting vector" : "Resulting matrix", result, steps };
}
