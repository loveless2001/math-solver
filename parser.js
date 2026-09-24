const DIGIT = /^[0-9]$/;
const MAX_INPUT_LENGTH = 512;
const MAX_TOKENS = 180;
const MAX_LITERAL = 100000n;

export class InputError extends Error {
  constructor(message) {
    super(message);
    this.name = "InputError";
  }
}

function tokenize(input) {
  if (input.length > MAX_INPUT_LENGTH) {
    throw new InputError("Try a shorter problem (up to 512 characters).");
  }

  const tokens = [];
  const normalized = input.replaceAll("−", "-").replaceAll("×", "*").replaceAll("÷", "/");
  for (let index = 0; index < normalized.length;) {
    const char = normalized[index];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    if (DIGIT.test(char) || (char === "." && DIGIT.test(normalized[index + 1] ?? ""))) {
      const start = index;
      while (index < normalized.length && DIGIT.test(normalized[index])) index += 1;
      const whole = normalized.slice(start, index) || "0";
      let fraction = "";
      if (normalized[index] === ".") {
        index += 1;
        const fractionStart = index;
        while (index < normalized.length && DIGIT.test(normalized[index])) index += 1;
        fraction = normalized.slice(fractionStart, index);
        if (!fraction) throw new InputError("Add digits after the decimal point.");
        if (fraction.length > 6) throw new InputError("Use up to six digits after the decimal point.");
      }
      const denominator = 10n ** BigInt(fraction.length);
      const value = BigInt(whole) * denominator + BigInt(fraction || "0");
      if (value > MAX_LITERAL * denominator) {
        throw new InputError("Use numbers up to 100,000 in this first version.");
      }
      tokens.push({ type: "number", value, denominator });
    } else if (/[a-zA-Z]/.test(char)) {
      const start = index;
      while (index < normalized.length && /[a-zA-Z]/.test(normalized[index])) index += 1;
      const name = normalized.slice(start, index).toLowerCase();
      if (name === "x") tokens.push({ type: "x" });
      else if (["det", "inv", "rref", "transpose", "solve", "sqrt", "cbrt", "root"].includes(name)) tokens.push({ type: "function", name });
      else throw new InputError(`I don't recognize “${normalized.slice(start, index)}”. Try sqrt, root, det, inv, rref, transpose, or solve.`);
    } else if ("+-*/^()=[],".includes(char)) {
      tokens.push({ type: char });
      index += 1;
    } else if (char === ".") {
      throw new InputError("Add a digit before or after the decimal point.");
    } else {
      throw new InputError(`I don't recognize “${char}”. Use numbers, x, +, −, ×, ÷, and parentheses.`);
    }
    if (tokens.length > MAX_TOKENS) {
      throw new InputError("Try a shorter problem with fewer operations.");
    }
  }
  return tokens;
}

function gcd(left, right) {
  while (right !== 0n) [left, right] = [right, left % right];
  return left;
}

function number(value, denominator = 1n) {
  const factor = gcd(value, denominator);
  return { $: "Number", value: { $: "Q", negative: false, numerator: value / factor, denominator: denominator / factor } };
}

const binary = (tag, left, right) => ({ $: tag, left, right });

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.index = 0;
  }

  peek() {
    return this.tokens[this.index]?.type;
  }

  take(type) {
    if (this.peek() === type) {
      this.index += 1;
      return true;
    }
    return false;
  }

  parseExpression() {
    let node = this.parseProduct();
    while (this.peek() === "+" || this.peek() === "-") {
      const operator = this.tokens[this.index++].type;
      node = binary(operator === "+" ? "Plus" : "Minus", node, this.parseProduct());
    }
    return node;
  }

  parseProduct() {
    let node = this.parseUnary();
    while (true) {
      if (this.take("*")) {
        node = binary("Times", node, this.parseUnary());
      } else if (this.take("/")) {
        node = binary("Over", node, this.parseUnary());
      } else if (["number", "x", "(", "function"].includes(this.peek())) {
        node = binary("Times", node, this.parseUnary());
      } else {
        return node;
      }
    }
  }

  parseUnary() {
    if (this.take("+")) return this.parseUnary();
    if (this.take("-")) return binary("Minus", number(0n), this.parseUnary());
    return this.parsePower();
  }

  parsePower() {
    const base = this.parsePrimary();
    return this.take("^") ? binary("Power", base, this.parseUnary()) : base;
  }

  parsePrimary() {
    if (this.peek() === "number") {
      const token = this.tokens[this.index++];
      return number(token.value, token.denominator);
    }
    if (this.take("x")) return { $: "Variable" };
    if (this.peek() === "function") {
      const name = this.tokens[this.index++].name;
      const shortMatrixCall = ["det", "inv", "rref", "transpose"].includes(name) && this.peek() === "[";
      const shortRootCall = ["sqrt", "cbrt"].includes(name) && ["number", "x"].includes(this.peek());
      if (!shortMatrixCall && !shortRootCall && !this.take("(")) throw new InputError(`Add parentheses after ${name}.`);
      if (shortMatrixCall || shortRootCall) return { $: "Call", name, args: [this.parsePrimary()] };
      const args = [];
      if (this.peek() !== ")") {
        args.push(this.parseExpression());
        while (this.take(",")) args.push(this.parseExpression());
      }
      if (!this.take(")")) throw new InputError(`Close the parentheses after ${name}.`);
      return { $: "Call", name, args };
    }
    if (this.take("[")) {
      const items = [];
      if (this.peek() !== "]") {
        items.push(this.parseExpression());
        while (this.take(",")) items.push(this.parseExpression());
      }
      if (!this.take("]")) throw new InputError("Close the square bracket in the matrix or vector.");
      return { $: "Array", items };
    }
    if (this.take("(")) {
      const expression = this.parseExpression();
      if (!this.take(")")) throw new InputError("Add a closing parenthesis, or remove the opening one.");
      return expression;
    }
    if (this.peek() === undefined) throw new InputError("The expression ends too soon. Add a number or x.");
    throw new InputError(`Add a number or x before “${this.peek()}”.`);
  }
}

function hasMatrixSyntax(node) {
  if (node.$ === "Array") return true;
  if (node.$ === "Call") return ["det", "inv", "rref", "transpose", "solve"].includes(node.name) || node.args.some(hasMatrixSyntax);
  if (node.$ === "Number" || node.$ === "Variable") return false;
  return hasMatrixSyntax(node.left) || hasMatrixSyntax(node.right);
}

export function parseProblem(input) {
  const tokens = tokenize(input.trim());
  if (tokens.length === 0) throw new InputError("Enter a calculation or an equation to begin.");

  const parser = new Parser(tokens);
  const left = parser.parseExpression();
  if (parser.take("=")) {
    const right = parser.parseExpression();
    if (parser.peek() !== undefined) throw new InputError("Use one equals sign, with an expression on each side.");
    if (hasMatrixSyntax(left) || hasMatrixSyntax(right)) {
      throw new InputError("Use solve(A, b) for a matrix system; matrix equations with = are not supported.");
    }
    return { kind: "equation", left, right };
  }
  if (parser.peek() !== undefined) {
    throw new InputError(`Check the symbol “${parser.peek()}” near the end of the problem.`);
  }
  return { kind: hasMatrixSyntax(left) ? "matrix" : "expression", expression: left };
}
