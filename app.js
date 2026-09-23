import Engine from "./engine.bend";
import { InputError, parseProblem } from "./parser.js";
import { MathProblemError, solveProblem } from "./steps.js";

const form = document.querySelector("#problem-form");
const input = document.querySelector("#problem-input");
const region = document.querySelector("#result-region");
const emptyState = region.firstElementChild.cloneNode(true);

function resetResult() {
  region.replaceChildren(emptyState.cloneNode(true));
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function showResult(result) {
  region.replaceChildren();
  const answer = element("div", "answer-box");
  answer.append(element("span", "", result.heading), element("strong", "", result.result));
  const heading = element("div", "steps-heading");
  heading.append(element("h3", "", "Step by step"), element("span", "", `${result.steps.length} steps`));
  const list = element("ol", "steps-list");
  for (const [index, step] of result.steps.entries()) {
    const item = element("li", "step");
    const body = element("div", "step-body");
    body.append(
      element("div", "step-title", step.title),
      element("div", "step-math", step.math),
      element("p", "step-detail", step.detail),
    );
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

function solveCurrent() {
  try {
    const problem = parseProblem(input.value);
    showResult(solveProblem(problem, input.value, Engine));
  } catch (error) {
    if (error instanceof InputError || error instanceof MathProblemError) {
      showError(error.message);
      return;
    }
    const message = String(error?.message || error);
    showError(message.includes("largest immediate")
      ? "These numbers are too large for this version. Try smaller values."
      : "The calculation could not be completed. Try a shorter problem with smaller numbers.");
  }
}

function replaceSelection(text, cursorOffset = text.length) {
  const start = input.selectionStart;
  const end = input.selectionEnd;
  input.setRangeText(text, start, end, "end");
  input.focus();
  input.setSelectionRange(start + cursorOffset, start + cursorOffset);
  resetResult();
}

document.querySelector(".math-keyboard").addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.insert) {
    replaceSelection(button.dataset.insert);
  } else if (button.dataset.template === "fraction") {
    replaceSelection("()/()", 1);
  } else if (button.dataset.template === "parentheses") {
    replaceSelection("()", 1);
  } else if (button.dataset.action === "clear") {
    input.value = "";
    input.focus();
    resetResult();
  } else if (button.dataset.action === "backspace") {
    const start = input.selectionStart;
    const end = input.selectionEnd;
    if (start === end && start > 0) input.setSelectionRange(start - 1, end);
    replaceSelection("");
  }
});

document.querySelector(".example-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-example]");
  if (!button) return;
  input.value = button.dataset.example;
  solveCurrent();
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  solveCurrent();
});

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    solveCurrent();
  }
});

input.addEventListener("input", resetResult);
