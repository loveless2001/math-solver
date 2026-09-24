import { InputError } from "./parser.js";

// Translate the small LaTeX vocabulary that the solver can actually evaluate.
export function normalizeInput(source) {
  if (source.length > 512) throw new InputError("Try a shorter problem (up to 512 characters).");
  let text = source.trim();
  if (text.startsWith("$$") && text.endsWith("$$") && text.length > 4) text = text.slice(2, -2).trim();
  else if (text.startsWith("$") && text.endsWith("$") && text.length > 2) text = text.slice(1, -1).trim();
  else if (text.startsWith("\\(") && text.endsWith("\\)")) text = text.slice(2, -2).trim();
  else if (text.startsWith("\\[") && text.endsWith("\\]")) text = text.slice(2, -2).trim();
  text = text.replaceAll("**", "^");
  const superscripts = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁻": "-" };
  text = text.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+/g, (digits) => `^${[...digits].map((digit) => superscripts[digit]).join("")}`);
  text = text.replace(/\\begin\{([bp])matrix\}([\s\S]*?)\\end\{\1matrix\}/g, (_, kind, body) => {
    const rows = body.split(/\\\\/).map((row) => row.trim()).filter(Boolean);
    if (!rows.length) throw new InputError("Add entries to the LaTeX matrix.");
    return `[${rows.map((row) => `[${row.split("&").map((cell) => normalizeInput(cell)).join(",")}]`).join(",")}]`;
  });
  let index = 0;
  function group() {
    while (/\s/.test(text[index] ?? "") && index < text.length) index += 1;
    if (text[index] !== "{") throw new InputError("Use braces around each LaTeX fraction part, such as \\frac{1}{2}.");
    index += 1;
    let depth = 1;
    const start = index;
    while (index < text.length && depth) {
      if (text[index] === "{") depth += 1;
      if (text[index] === "}") depth -= 1;
      index += 1;
    }
    if (depth) throw new InputError("Close the braces in the LaTeX expression.");
    return normalizeInput(text.slice(start, index - 1));
  }
  let output = "";
  while (index < text.length) {
    const char = text[index];
    if (char === "\\") {
      const command = /^\\([a-zA-Z]+)/.exec(text.slice(index));
      if (!command) throw new InputError("Check the LaTeX command near the backslash.");
      index += command[0].length;
      const name = command[1];
      if (name === "frac" || name === "dfrac" || name === "tfrac") {
        const numerator = group();
        const denominator = group();
        output += `((${numerator})/(${denominator}))`;
      } else if (name === "sqrt") {
        let degree;
        if (text[index] === "[") {
          const close = text.indexOf("]", index + 1);
          if (close < 0) throw new InputError("Close the index in the LaTeX root.");
          degree = normalizeInput(text.slice(index + 1, close));
          index = close + 1;
        }
        const radicand = group();
        output += degree === undefined ? `sqrt(${radicand})` : `root(${degree},${radicand})`;
      } else if (name === "operatorname" || name === "mathrm") {
        const word = group();
        if (!["det", "inv", "rref", "transpose", "solve", "sqrt", "cbrt", "root", "x"].includes(word)) {
          throw new InputError(`This version cannot solve \\${name}{${word}}.`);
        }
        output += word;
      } else if (["times", "cdot", "cdotp", "ast"].includes(name)) output += "*";
      else if (name === "div") output += "/";
      else if (["left", "right"].includes(name)) { /* The following delimiter is read normally. */ }
      else if (["det", "inv", "rref", "transpose", "solve", "cbrt", "root"].includes(name)) output += name;
      else throw new InputError(`This version cannot solve \\${name}. See Symbols & syntax for supported input.`);
    } else if (char === "{") { output += "("; index += 1; }
    else if (char === "}") { output += ")"; index += 1; }
    else if (char === "·" || char === "⋅" || char === "×") { output += "*"; index += 1; }
    else if (char === "÷") { output += "/"; index += 1; }
    else if (char === "√") { output += "sqrt"; index += 1; }
    else if (char === "−" || char === "–") { output += "-"; index += 1; }
    else if (char === "&") throw new InputError("Use & only inside a LaTeX matrix environment.");
    else { output += char; index += 1; }
  }
  return output;
}

const NS = "http://www.w3.org/1998/Math/MathML";
function mathNode(tag, value) {
  const node = document.createElementNS(NS, tag);
  if (value !== undefined) node.textContent = value;
  return node;
}
function row(...children) {
  const node = mathNode("mrow");
  node.append(...children);
  return node;
}
function closingParenthesis(tokens, opening) {
  let depth = 0;
  for (let index = opening; index < tokens.length; index += 1) {
    if (tokens[index] === "(") depth += 1;
    if (tokens[index] === ")") depth -= 1;
    if (depth === 0) return index;
  }
  return -1;
}

function rootPresentation(name, body) {
  let index = "2";
  let radicand = body;
  if (name === "cbrt") index = "3";
  if (name === "root") {
    let depth = 0;
    let comma = -1;
    for (let i = 0; i < body.length; i += 1) {
      if (body[i] === "(") depth += 1;
      if (body[i] === ")") depth -= 1;
      if (body[i] === "," && depth === 0) { comma = i; break; }
    }
    if (comma < 0) return null;
    index = body.slice(0, comma);
    radicand = body.slice(comma + 1);
  }
  const value = presentMath(radicand);
  const rootIndex = presentMath(index);
  const node = mathNode(index === "2" ? "msqrt" : "mroot");
  node.append(value.node.firstChild);
  if (index !== "2") node.append(rootIndex.node.firstChild);
  return { node, latex: index === "2" ? `\\sqrt{${value.latex}}` : `\\sqrt[${rootIndex.latex}]{${value.latex}}` };
}

function plain(source) {
  const root = mathNode("mrow");
  const tokens = source.match(/(?:\d+\.\d+|\.\d+|\d+)|[A-Za-z]+\d*|\s+|./gu) ?? [];
  let latex = "";
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (/^\s+$/.test(token)) { latex += " "; continue; }
    if (token === "(") {
      const top = closingParenthesis(tokens, i);
      const bottom = top >= 0 && tokens[top + 1] === "/" && tokens[top + 2] === "(" ? closingParenthesis(tokens, top + 2) : -1;
      if (bottom >= 0) {
        const numerator = presentMath(tokens.slice(i + 1, top).join(""));
        const denominator = presentMath(tokens.slice(top + 3, bottom).join(""));
        const fraction = mathNode("mfrac");
        fraction.append(numerator.node.firstChild, denominator.node.firstChild);
        root.append(fraction);
        latex += `\\frac{${numerator.latex}}{${denominator.latex}}`;
        i = bottom;
        continue;
      }
    }
    if (["sqrt", "cbrt", "root"].includes(token) && tokens[i + 1] === "(") {
      const close = closingParenthesis(tokens, i + 1);
      if (close >= 0) {
        const presentation = rootPresentation(token, tokens.slice(i + 2, close).join(""));
        if (presentation) {
          root.append(presentation.node);
          latex += presentation.latex;
          i = close;
          continue;
        }
      }
    }
    const shortRoot = /^(sqrt|cbrt)(\d+)$/.exec(token);
    if (shortRoot) {
      const presentation = rootPresentation(shortRoot[1], shortRoot[2]);
      root.append(presentation.node);
      latex += presentation.latex;
      continue;
    }
    if (token === "√" && tokens[i + 1]) {
      const next = tokens[i + 1];
      const presentation = next === "(" && closingParenthesis(tokens, i + 1) >= 0
        ? rootPresentation("sqrt", tokens.slice(i + 2, closingParenthesis(tokens, i + 1)).join(""))
        : rootPresentation("sqrt", next);
      root.append(presentation.node);
      latex += presentation.latex;
      i = next === "(" ? closingParenthesis(tokens, i + 1) : i + 1;
      continue;
    }
    if (token === "^" && root.lastChild && tokens[i + 1]) {
      let end = i + 1;
      if (tokens[end] === "-") end += 1;
      if (tokens[end] === "(" && closingParenthesis(tokens, end) >= 0) end = closingParenthesis(tokens, end);
      while (tokens[end + 1] === "^" && tokens[end + 2]) {
        end += 2;
        if (tokens[end] === "(" && closingParenthesis(tokens, end) >= 0) end = closingParenthesis(tokens, end);
      }
      const exponentSource = tokens.slice(i + 1, end + 1).join("");
      const exponent = presentMath(exponentSource.startsWith("(") && exponentSource.endsWith(")")
        ? exponentSource.slice(1, -1) : exponentSource);
      const base = root.lastChild;
      const sup = mathNode("msup");
      sup.append(base, exponent.node.firstChild);
      root.append(sup);
      latex += `^{${exponent.latex}}`;
      i = end;
      continue;
    }
    if (/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(token) && tokens[i + 1] === "/" && /^(?:\d+(?:\.\d+)?|\.\d+)$/.test(tokens[i + 2] ?? "")) {
      const numerator = token;
      const denominator = tokens[i + 2];
      const fraction = mathNode("mfrac");
      fraction.append(mathNode("mn", numerator), mathNode("mn", denominator));
      root.append(fraction);
      latex += `\\frac{${numerator}}{${denominator}}`;
      i += 2;
    } else if (/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(token)) { root.append(mathNode("mn", token)); latex += token; }
    else if (/^[A-Za-z]+\d*$/.test(token)) {
      const subscript = /^([xtR])(\d+)$/.exec(token);
      if (subscript) {
        const node = mathNode("msub");
        node.append(mathNode("mi", subscript[1]), mathNode("mn", subscript[2]));
        root.append(node);
        latex += `${subscript[1]}_{${subscript[2]}}`;
      } else if (["det", "inv", "rref", "transpose", "solve", "sqrt", "cbrt", "root"].includes(token)) {
        root.append(mathNode("mi", token));
        latex += `\\operatorname{${token}}`;
      } else if (["true", "false"].includes(token.toLowerCase())) {
        root.append(mathNode("mtext", token));
        latex += `\\text{${token}}`;
      } else { root.append(mathNode("mi", token)); latex += token; }
    } else {
      const symbol = { "*": "×", "-": "−", "/": "÷" }[token] ?? token;
      root.append(mathNode("mo", symbol));
      latex += { "×": "\\times ", "*": "\\times ", "÷": "\\div ", "/": "\\div ", "−": "-", "←": "\\leftarrow ", "≈": "\\approx ", "±": "\\pm " }[token] ?? (symbol === "−" ? "-" : symbol);
    }
  }
  return { latex: latex.trim(), node: root };
}

function splitTopLevel(source) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < source.length; i += 1) {
    if (source[i] === "[") depth += 1;
    if (source[i] === "]") depth -= 1;
    if (source[i] === "," && depth === 0) { parts.push(source.slice(start, i).trim()); start = i + 1; }
  }
  parts.push(source.slice(start).trim());
  return parts;
}

function arrayAt(source, start) {
  let depth = 0;
  for (let end = start; end < source.length; end += 1) {
    if (source[end] === "[") depth += 1;
    if (source[end] === "]") depth -= 1;
    if (depth === 0) {
      const items = splitTopLevel(source.slice(start + 1, end));
      if (!items.length || items.some((item) => !item)) return null;
      const matrix = items.every((item) => item.startsWith("[") && arrayAt(item, 0)?.end === item.length);
      const rows = matrix ? items.map((item) => splitTopLevel(item.slice(1, -1))) : items.map((item) => [item]);
      if (rows.some((entries) => entries.length !== rows[0].length)) return null;
      const table = mathNode("mtable");
      const texRows = [];
      for (const entries of rows) {
        const tr = mathNode("mtr");
        const texCells = [];
        for (const entry of entries) {
          const cell = mathNode("mtd");
          const rendered = presentMath(entry);
          cell.append(rendered.node);
          tr.append(cell);
          texCells.push(rendered.latex);
        }
        table.append(tr);
        texRows.push(texCells.join(" & "));
      }
      return { end: end + 1, node: row(mathNode("mo", "["), table, mathNode("mo", "]")), latex: `\\begin{bmatrix}${texRows.join(" \\\\ ")}\\end{bmatrix}` };
    }
  }
  return null;
}

// A display formatter for solver strings and in-progress input. It never executes TeX or HTML.
export function presentMath(source) {
  if (["No solution", "No real solutions", "No value of x", "All real values of x", "True", "False"].includes(source)) {
    const math = mathNode("math");
    math.setAttribute("display", "block");
    math.append(mathNode("mtext", source));
    return { latex: `\\text{${source}}`, node: math };
  }
  source = source.replace(/\(\(([-−]?\d+)\)\/\((\d+)\)\)/g, "$1/$2");
  source = source.replaceAll("²", "^2").replaceAll("³", "^3");
  const root = mathNode("mrow");
  let latex = "";
  let start = 0;
  for (let i = 0; i < source.length; i += 1) {
    if (source[i] !== "[") continue;
    const array = arrayAt(source, i);
    if (!array) continue;
    const prefix = plain(source.slice(start, i));
    root.append(prefix.node, array.node);
    latex += prefix.latex + array.latex;
    i = array.end - 1;
    start = array.end;
  }
  const suffix = plain(source.slice(start));
  root.append(suffix.node);
  latex += suffix.latex;
  const math = mathNode("math");
  math.setAttribute("display", "block");
  math.append(root);
  return { latex: latex.trim(), node: math };
}
