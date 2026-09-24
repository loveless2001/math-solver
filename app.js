import Engine from "./engine.bend";
import { InputError, parseProblem } from "./parser.js";
import { MathProblemError, solveProblem } from "./steps.js";
import { MatrixProblemError } from "./matrix.js";
import { BuilderInputError, buildMatrixExpression, matrixShape } from "./matrix-builder.js";
import { normalizeInput, presentMath } from "./notation.js";
import { ExtendedMathError } from "./extended-math.js";

const form = document.querySelector("#problem-form");
const input = document.querySelector("#problem-input");
const region = document.querySelector("#result-region");
const emptyState = region.firstElementChild.cloneNode(true);
const matrixForm = document.querySelector("#matrix-form");
const matrixOperation = document.querySelector("#matrix-operation");
const matrixRows = document.querySelector("#matrix-rows");
const matrixColumns = document.querySelector("#matrix-cols");
const matrixBColumns = document.querySelector("#matrix-b-cols");
const matrixEntryFields = document.querySelector("#matrix-entry-fields");
const matrixValues = new Map();
const latexPreview = document.querySelector("#input-latex");
const renderedPreview = document.querySelector("#input-rendered");
const previewStatus = document.querySelector("#preview-status");
const suggestionList = document.querySelector("#input-suggestions");

function resetResult() {
  region.replaceChildren(emptyState.cloneNode(true));
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function mathBlock(source, className) {
  const presentation = presentMath(source);
  const node = element("div", className);
  node.append(presentation.node);
  return { node, latex: presentation.latex };
}

function rootsBlock(values, approximate, className) {
  const node = element("div", className);
  const latex = [];
  for (const value of values) {
    const line = mathBlock(`x ${approximate ? "≈" : "="} ${value}`, "solution-line rendered-math");
    node.append(line.node);
    latex.push(line.latex);
  }
  return { node, latex: latex.join(",\\; ") };
}

function copyButton(latex) {
  const button = element("button", "copy-latex", "Copy LaTeX");
  button.type = "button";
  button.setAttribute("aria-label", `Copy LaTeX: ${latex}`);
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(latex);
      button.textContent = "Copied!";
      window.setTimeout(() => { button.textContent = "Copy LaTeX"; }, 1800);
    } catch {
      button.textContent = "Copy failed";
      window.setTimeout(() => { button.textContent = "Copy LaTeX"; }, 1800);
    }
  });
  return button;
}

function showResult(result) {
  region.replaceChildren();
  const answer = element("div", "answer-box");
  const answerMath = result.solutions?.length > 1
    ? rootsBlock(result.solutions, result.approximate, "answer-math answer-solutions")
    : mathBlock(result.result, "answer-math rendered-math");
  const answerHeader = element("div", "answer-header");
  answerHeader.append(element("span", "", result.heading), copyButton(answerMath.latex));
  answer.append(answerHeader, answerMath.node);
  const heading = element("div", "steps-heading");
  heading.append(element("h3", "", "Step by step"), element("span", "", `${result.steps.length} steps`));
  const list = element("ol", "steps-list");
  for (const [index, step] of result.steps.entries()) {
    const item = element("li", "step");
    const body = element("div", "step-body");
    const stepMath = step.solutions?.length > 1
      ? rootsBlock(step.solutions, step.approximate, "step-math step-solutions")
      : mathBlock(step.math, "step-math rendered-math");
    const title = element("div", "step-title-row");
    title.append(element("div", "step-title", step.title), copyButton(stepMath.latex));
    body.append(title, stepMath.node, element("p", "step-detail", step.detail));
    item.append(element("span", "step-number", String(index + 1)), body);
    list.append(item);
  }
  region.append(answer, heading, list);
}

function showError(message) {
  const box = element("div", "error-box");
  box.append(element("strong", "", "Let's adjust that problem"), element("p", "", message));
  region.replaceChildren(box);
}

function showProblemError(error) {
  if (error instanceof InputError || error instanceof MathProblemError || error instanceof MatrixProblemError || error instanceof BuilderInputError || error instanceof ExtendedMathError) {
    showError(error.message);
    return;
  }
  const message = String(error?.message || error);
  showError(message.includes("largest immediate")
    ? "These numbers are too large for this version. Try smaller values."
    : "The calculation could not be completed. Try a shorter problem with smaller numbers.");
}

function solveText(text) {
  try {
    const normalized = normalizeInput(text);
    const problem = parseProblem(normalized);
    showResult(solveProblem(problem, normalized, Engine));
  } catch (error) {
    showProblemError(error);
  }
  if (window.matchMedia("(max-width: 980px)").matches) {
    document.querySelector(".result-card").scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function solveCurrent() {
  solveText(input.value);
}

function rememberVisibleCells() {
  for (const cell of matrixEntryFields.querySelectorAll("[data-cell]")) {
    matrixValues.set(cell.dataset.cell, cell.value);
  }
}

function matrixCell(key, label) {
  const field = element("input", "matrix-cell");
  field.type = "text";
  field.inputMode = "text";
  field.autocomplete = "off";
  field.spellcheck = false;
  field.required = true;
  field.placeholder = "0";
  field.dataset.cell = key;
  field.value = matrixValues.get(key) ?? "";
  field.setAttribute("aria-label", label);
  return field;
}

function matrixGrid(name, key, rows, columns) {
  const section = element("section", "matrix-entry");
  const heading = element("div", "matrix-entry-heading");
  heading.append(element("strong", "", name), element("span", "", columns === 1 && key === "v" ? `${rows} entries` : `${rows} × ${columns}`));
  const scroll = element("div", "matrix-scroll");
  const table = element("table", "matrix-table");
  table.append(element("caption", "sr-only", `${name}, ${rows} rows and ${columns} columns`));
  const head = document.createElement("thead");
  const headRow = document.createElement("tr");
  headRow.append(element("th", "row-marker", ""));
  for (let column = 0; column < columns; column += 1) {
    const marker = element("th", "", `C${column + 1}`);
    marker.scope = "col";
    headRow.append(marker);
  }
  head.append(headRow);
  table.append(head);
  const body = document.createElement("tbody");
  for (let row = 0; row < rows; row += 1) {
    const tableRow = document.createElement("tr");
    const marker = element("th", "row-marker", `R${row + 1}`);
    marker.scope = "row";
    tableRow.append(marker);
    for (let column = 0; column < columns; column += 1) {
      const cell = document.createElement("td");
      const location = key === "v" ? `Vector b, entry ${row + 1}` : `${name}, row ${row + 1}, column ${column + 1}`;
      cell.append(matrixCell(`${key}:${row}:${column}`, location));
      tableRow.append(cell);
    }
    body.append(tableRow);
  }
  table.append(body);
  scroll.append(table);
  section.append(heading, scroll);
  return section;
}

function currentShape() {
  return matrixShape(matrixOperation.value, matrixRows.value, matrixColumns.value, matrixBColumns.value);
}

function renderMatrixBuilder() {
  rememberVisibleCells();
  const operation = matrixOperation.value;
  const square = operation === "det" || operation === "inverse";
  document.querySelector("#matrix-cols-field").hidden = square;
  matrixColumns.disabled = square;
  document.querySelector("#matrix-b-cols-field").hidden = operation !== "multiply";
  matrixBColumns.disabled = operation !== "multiply";
  const shape = currentShape();
  const details = [`A: ${shape.a.rows} × ${shape.a.columns}`];
  if (shape.b) details.push(`B: ${shape.b.rows} × ${shape.b.columns}`);
  if (shape.vector) details.push(`b: ${shape.vector} entries`);
  if (shape.scalar) details.push("one multiplier");
  document.querySelector("#matrix-shape-note").textContent = details.join("  ·  ");
  matrixEntryFields.replaceChildren(matrixGrid("Matrix A", "a", shape.a.rows, shape.a.columns));
  if (shape.b) matrixEntryFields.append(matrixGrid("Matrix B", "b", shape.b.rows, shape.b.columns));
  if (shape.vector) matrixEntryFields.append(matrixGrid("Vector b", "v", shape.vector, 1));
  if (shape.scalar) {
    const label = element("label", "scalar-entry", "Multiplier");
    label.append(matrixCell("scalar", "Multiplier"));
    matrixEntryFields.append(label);
  }
}

function visibleValues(shape) {
  const grid = (key, rows, columns) => Array.from({ length: rows }, (_, row) =>
    Array.from({ length: columns }, (_, column) => matrixValues.get(`${key}:${row}:${column}`) ?? ""));
  return {
    a: grid("a", shape.a.rows, shape.a.columns),
    b: shape.b ? grid("b", shape.b.rows, shape.b.columns) : undefined,
    vector: shape.vector ? grid("v", shape.vector, 1).map((row) => row[0]) : undefined,
    scalar: shape.scalar ? matrixValues.get("scalar") ?? "" : undefined,
  };
}

matrixForm.addEventListener("change", (event) => {
  if (!event.target.matches("select")) return;
  renderMatrixBuilder();
  resetResult();
});

matrixForm.addEventListener("input", (event) => {
  if (event.target.dataset.cell) matrixValues.set(event.target.dataset.cell, event.target.value);
  resetResult();
});

matrixForm.addEventListener("submit", (event) => {
  event.preventDefault();
  rememberVisibleCells();
  try {
    const shape = currentShape();
    solveText(buildMatrixExpression(matrixOperation.value, shape, visibleValues(shape)));
  } catch (error) {
    showProblemError(error);
  }
});

document.querySelector("#fill-zeros").addEventListener("click", () => {
  for (const cell of matrixEntryFields.querySelectorAll("[data-cell]")) {
    if (cell.dataset.cell !== "scalar" && cell.value.trim() === "") {
      cell.value = "0";
      matrixValues.set(cell.dataset.cell, "0");
    }
  }
  resetResult();
});

const tabs = [document.querySelector("#guided-tab"), document.querySelector("#typed-tab"), document.querySelector("#symbols-tab")];
function selectTab(tab) {
  for (const item of tabs) {
    const active = item === tab;
    item.setAttribute("aria-selected", String(active));
    item.tabIndex = active ? 0 : -1;
    document.getElementById(item.getAttribute("aria-controls")).hidden = !active;
  }
  resetResult();
}

for (const tab of tabs) tab.addEventListener("click", () => selectTab(tab));
document.querySelector(".entry-modes").addEventListener("keydown", (event) => {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const target = event.key === "Home" ? tabs[0] : event.key === "End" ? tabs.at(-1)
    : tabs[(tabs.indexOf(document.activeElement) + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
  selectTab(target);
  target.focus();
});

renderMatrixBuilder();
selectTab(tabs[0]);

function replaceSelection(text, cursorOffset = text.length) {
  const start = input.selectionStart;
  const end = input.selectionEnd;
  input.setRangeText(text, start, end, "end");
  input.focus();
  input.setSelectionRange(start + cursorOffset, start + cursorOffset);
  resetResult();
  updateInputHelpers();
}

function insertFromButton(event) {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.closest("#symbols-panel")) selectTab(document.querySelector("#typed-tab"));
  if (button.dataset.insert) {
    replaceSelection(button.dataset.insert);
  } else if (button.dataset.template === "fraction") {
    replaceSelection("()/()", 1);
  } else if (button.dataset.template === "parentheses") {
    replaceSelection("()", 1);
  } else if (["det", "inv", "rref", "transpose"].includes(button.dataset.template)) {
    replaceSelection(`${button.dataset.template}()`, button.dataset.template.length + 1);
  } else if (button.dataset.template === "solve") {
    replaceSelection("solve(,)", 6);
  } else if (button.dataset.template === "sqrt") {
    replaceSelection("sqrt()", 5);
  } else if (button.dataset.template === "root") {
    replaceSelection("root(,)", 5);
  } else if (button.dataset.action === "clear") {
    input.value = "";
    input.focus();
    resetResult();
    updateInputHelpers();
  } else if (button.dataset.action === "backspace") {
    const start = input.selectionStart;
    const end = input.selectionEnd;
    if (start === end && start > 0) input.setSelectionRange(start - 1, end);
    replaceSelection("");
  }
}

document.querySelector(".math-keyboard").addEventListener("click", insertFromButton);
document.querySelector("#symbols-panel").addEventListener("click", insertFromButton);

document.querySelector(".example-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-example]");
  if (!button) return;
  input.value = button.dataset.example;
  updateInputHelpers();
  solveCurrent();
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  solveCurrent();
});

input.addEventListener("keydown", (event) => {
  if (!suggestionList.hidden && ["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"].includes(event.key) && !(event.ctrlKey || event.metaKey)) {
    if (event.key === "Escape") { hideSuggestions(); event.preventDefault(); return; }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const options = [...suggestionList.querySelectorAll("[role=option]")];
      activeSuggestion = (activeSuggestion + (event.key === "ArrowDown" ? 1 : options.length - 1)) % options.length;
      options.forEach((option, index) => option.setAttribute("aria-selected", String(index === activeSuggestion)));
      input.setAttribute("aria-activedescendant", options[activeSuggestion].id);
      return;
    }
    if ((event.key === "Enter" || event.key === "Tab") && activeSuggestion >= 0) {
      event.preventDefault();
      acceptSuggestion(suggestionList.querySelectorAll("[role=option]")[activeSuggestion]);
      return;
    }
  }
  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    solveCurrent();
  }
});

const completions = [
  { key: "det", insert: "det(", label: "det( ) · determinant" },
  { key: "inv", insert: "inv(", label: "inv( ) · inverse" },
  { key: "rref", insert: "rref(", label: "rref( ) · row reduction" },
  { key: "transpose", insert: "transpose(", label: "transpose( )" },
  { key: "solve", insert: "solve(", label: "solve(A,b) · linear system" },
  { key: "sqrt", insert: "sqrt()", cursor: 5, label: "sqrt( ) · square root" },
  { key: "cbrt", insert: "cbrt()", cursor: 5, label: "cbrt( ) · cube root" },
  { key: "root", insert: "root(,)", cursor: 5, label: "root(n,x) · nth root" },
  { key: "\\frac", insert: "\\frac{}{}", cursor: 6, label: "\\frac{a}{b} · fraction" },
  { key: "\\sqrt", insert: "\\sqrt{}", cursor: 6, label: "\\sqrt{x} · square root" },
  { key: "\\times", insert: "\\times ", label: "\\times · multiply" },
  { key: "\\cdot", insert: "\\cdot ", label: "\\cdot · multiply" },
  { key: "\\div", insert: "\\div ", label: "\\div · divide" },
];
let activeSuggestion = -1;
let suggestionStart = 0;
let suggestionHideTimer;

function hideSuggestions() {
  suggestionList.hidden = true;
  suggestionList.replaceChildren();
  input.setAttribute("aria-expanded", "false");
  input.removeAttribute("aria-activedescendant");
  activeSuggestion = -1;
}

function acceptSuggestion(option) {
  if (!option) return;
  const entry = completions[Number(option.dataset.index)];
  const end = input.selectionStart;
  input.setSelectionRange(suggestionStart, end);
  replaceSelection(entry.insert, entry.cursor ?? entry.insert.length);
  hideSuggestions();
}

function updateSuggestions() {
  window.clearTimeout(suggestionHideTimer);
  const before = input.value.slice(0, input.selectionStart);
  const match = /(\\?[a-zA-Z]+)$/.exec(before);
  if (!match) { hideSuggestions(); return; }
  const query = match[1].toLowerCase();
  const matching = completions.map((entry, index) => ({ ...entry, index }))
    .filter((entry) => entry.key.startsWith(query));
  if (!matching.length) { hideSuggestions(); return; }
  suggestionStart = input.selectionStart - match[1].length;
  suggestionList.replaceChildren();
  matching.slice(0, 5).forEach((entry) => {
    const option = element("button", "suggestion", entry.label);
    option.type = "button";
    option.id = `suggestion-${entry.index}`;
    option.dataset.index = String(entry.index);
    option.setAttribute("role", "option");
    option.setAttribute("aria-selected", "false");
    option.addEventListener("mousedown", (event) => event.preventDefault());
    option.addEventListener("click", () => acceptSuggestion(option));
    suggestionList.append(option);
  });
  suggestionList.hidden = false;
  input.setAttribute("aria-expanded", "true");
  activeSuggestion = -1;
  input.removeAttribute("aria-activedescendant");
}

function updatePreview() {
  const text = input.value.trim();
  if (!text) {
    latexPreview.textContent = "Start typing to see LaTeX";
    renderedPreview.replaceChildren(element("span", "preview-placeholder", "Your expression will appear here"));
    previewStatus.textContent = "";
    return;
  }
  try {
    const normalized = normalizeInput(text);
    const presentation = presentMath(normalized);
    latexPreview.textContent = presentation.latex;
    renderedPreview.replaceChildren(presentation.node);
    try { parseProblem(normalized); previewStatus.textContent = "Ready to solve"; }
    catch (error) { previewStatus.textContent = error.message; }
  } catch (error) {
    latexPreview.textContent = text;
    renderedPreview.replaceChildren(element("span", "preview-placeholder", "Finish the LaTeX syntax to preview it"));
    previewStatus.textContent = error.message;
  }
}

function updateInputHelpers() {
  updatePreview();
  updateSuggestions();
}

input.addEventListener("input", () => { resetResult(); updateInputHelpers(); });
input.addEventListener("click", updateSuggestions);
input.addEventListener("keyup", (event) => {
  if (!["ArrowDown", "ArrowUp", "Enter", "Escape"].includes(event.key)) updateSuggestions();
});
input.addEventListener("focus", () => window.clearTimeout(suggestionHideTimer));
input.addEventListener("blur", () => { suggestionHideTimer = window.setTimeout(hideSuggestions, 100); });
updateInputHelpers();
