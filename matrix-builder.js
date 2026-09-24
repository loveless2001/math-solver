const OPERATIONS = new Set([
  "det", "inverse", "rref", "transpose", "add", "subtract", "multiply", "scale", "matrixVector", "solve",
]);

export class BuilderInputError extends Error {
  constructor(message) {
    super(message);
    this.name = "BuilderInputError";
  }
}

function dimension(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 4) {
    throw new BuilderInputError("Choose a matrix size from 1 to 4.");
  }
  return number;
}

export function matrixShape(operation, rows, columns, bColumns) {
  if (!OPERATIONS.has(operation)) throw new BuilderInputError("Choose a matrix operation.");
  const aRows = dimension(rows);
  const square = operation === "det" || operation === "inverse";
  const aColumns = square ? aRows : dimension(columns);
  const shape = { a: { rows: aRows, columns: aColumns } };
  if (operation === "add" || operation === "subtract") {
    shape.b = { rows: aRows, columns: aColumns };
  } else if (operation === "multiply") {
    shape.b = { rows: aColumns, columns: dimension(bColumns) };
  } else if (operation === "matrixVector") {
    shape.vector = aColumns;
  } else if (operation === "solve") {
    shape.vector = aRows;
  } else if (operation === "scale") {
    shape.scalar = true;
  }
  return shape;
}

function entry(value, label) {
  const normalized = String(value ?? "").trim().replaceAll("−", "-");
  if (!normalized) throw new BuilderInputError(`Enter a value for ${label}.`);
  if (!/^[+-]?(?:\d+(?:\.\d{1,6})?|\.\d{1,6}|\d+\/\d+)$/.test(normalized)) {
    throw new BuilderInputError(`Use a whole number, decimal, or fraction in ${label}.`);
  }
  return normalized;
}

function matrixLiteral(values, shape, label) {
  if (!Array.isArray(values) || values.length !== shape.rows) {
    throw new BuilderInputError(`Enter ${shape.rows} rows for matrix ${label}.`);
  }
  const rows = values.map((row, rowIndex) => {
    if (!Array.isArray(row) || row.length !== shape.columns) {
      throw new BuilderInputError(`Enter ${shape.columns} values in row ${rowIndex + 1} of matrix ${label}.`);
    }
    return `[${row.map((value, columnIndex) => entry(value, `matrix ${label}, row ${rowIndex + 1}, column ${columnIndex + 1}`)).join(",")}]`;
  });
  return `[${rows.join(",")}]`;
}

function vectorLiteral(values, length) {
  if (!Array.isArray(values) || values.length !== length) {
    throw new BuilderInputError(`Enter ${length} values in vector b.`);
  }
  return `[${values.map((value, index) => entry(value, `vector b, entry ${index + 1}`)).join(",")}]`;
}

export function buildMatrixExpression(operation, shape, values) {
  if (!OPERATIONS.has(operation)) throw new BuilderInputError("Choose a matrix operation.");
  const a = matrixLiteral(values.a, shape.a, "A");
  if (operation === "det") return `det(${a})`;
  if (operation === "inverse") return `inv(${a})`;
  if (operation === "rref") return `rref(${a})`;
  if (operation === "transpose") return `transpose(${a})`;
  if (operation === "scale") return `${entry(values.scalar, "the multiplier")}*${a}`;
  if (operation === "matrixVector") return `${a}*${vectorLiteral(values.vector, shape.vector)}`;
  if (operation === "solve") return `solve(${a},${vectorLiteral(values.vector, shape.vector)})`;
  const b = matrixLiteral(values.b, shape.b, "B");
  return `${a}${{ add: "+", subtract: "-", multiply: "*" }[operation]}${b}`;
}
