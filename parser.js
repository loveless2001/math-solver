const DIGIT = /^[0-9]$/;
const MAX_INPUT_LENGTH = 120;
const MAX_TOKENS = 80;
const MAX_LITERAL = 100000n;

export class InputError extends Error {
  constructor(message) {
    super(message);
    this.name = "InputError";
  }
}

function tokenize(input) {
  if (input.length > MAX_INPUT_LENGTH) {
    throw new InputError("Try a shorter problem (up to 120 characters).");
  }

  const tokens = [];
  const normalized = input.replaceAll("−", "-").replaceAll("×", "*").replaceAll("÷", "/");
  for (let index = 0; index < normalized.length;) {
    const char = normalized[index];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    if (DIGIT.test(char)) {
      const start = index;
      while (index < normalized.length && DIGIT.test(normalized[index])) index += 1;
      const value = BigInt(normalized.slice(start, index));
      if (value > MAX_LITERAL) {
        throw new InputError("Use numbers up to 100,000 in this first version.");
      }
      tokens.push({ type: "number", value });
    } else if (char === "x" || char === "X") {
      tokens.push({ type: "x" });
      index += 1;
    } else if ("+-*/()=".includes(char)) {
      tokens.push({ type: char });
      index += 1;
    } else if (char === ".") {
      throw new InputError("Use a fraction such as 1/2 for an exact answer.");
    } else if (char === "^") {
      throw new InputError("Powers are planned for a later version. Try a linear problem for now.");
    } else {
      throw new InputError(`I don't recognize “${char}”. Use numbers, x, +, −, ×, ÷, and parentheses.`);
    }
    if (tokens.length > MAX_TOKENS) {
      throw new InputError("Try a shorter problem with fewer operations.");
    }
  }
  return tokens;
}

const number = (value) => ({
  $: "Number",
  value: { $: "Q", negative: false, numerator: value, denominator: 1n },
});

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
      } else if (this.peek() === "number" || this.peek() === "x" || this.peek() === "(") {
        node = binary("Times", node, this.parseUnary());
      } else {
        return node;
      }
    }
  }

  parseUnary() {
    if (this.take("+")) return this.parseUnary();
    if (this.take("-")) return binary("Minus", number(0n), this.parseUnary());
    return this.parsePrimary();
  }

  parsePrimary() {
    if (this.peek() === "number") return number(this.tokens[this.index++].value);
    if (this.take("x")) return { $: "Variable" };
    if (this.take("(")) {
      const expression = this.parseExpression();
      if (!this.take(")")) throw new InputError("Add a closing parenthesis, or remove the opening one.");
      return expression;
    }
    if (this.peek() === undefined) throw new InputError("The expression ends too soon. Add a number or x.");
    throw new InputError(`Add a number or x before “${this.peek()}”.`);
  }
}

export function parseProblem(input) {
  const tokens = tokenize(input.trim());
  if (tokens.length === 0) throw new InputError("Enter a calculation or an equation to begin.");

  const parser = new Parser(tokens);
  const left = parser.parseExpression();
  if (parser.take("=")) {
    const right = parser.parseExpression();
    if (parser.peek() !== undefined) throw new InputError("Use one equals sign, with an expression on each side.");
    return { kind: "equation", left, right };
  }
  if (parser.peek() !== undefined) {
    throw new InputError(`Check the symbol “${parser.peek()}” near the end of the problem.`);
  }
  return { kind: "expression", expression: left };
}
