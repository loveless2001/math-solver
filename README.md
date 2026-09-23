# Math Steps

A small, beginner-friendly math helper built with Bend 2. It shows exact answers and intermediate steps for arithmetic, fractions, linear expression simplification, and one-variable linear equations. The virtual keyboard inserts the symbols that this version understands.

## Run locally

Requires Bend 2.0.16 and Python 3.

```bash
bend index.html -o dist
python3 -m http.server 8000 --directory dist
```

Open <http://localhost:8000>. The built site is static and works without a backend or an internet connection.

## Check

```bash
bash verify.sh
```

## Scope

- Exact integer and fraction calculations with `+`, `-`, `*`, `/`, and parentheses.
- Linear expressions in `x`, including distributing constant factors and collecting like terms.
- Linear equations with a unique solution, no solution, or every value as a solution. The displayed steps include substitution for unique solutions.
- Input through normal typing or the virtual keyboard. `×`, `÷`, and `−` are accepted alongside `*`, `/`, and `-`.

The current solver does not handle powers, roots, decimals, nonlinear equations, other variables, or word problems. It limits input length, token count, and number size; very large intermediate values may also be rejected by Bend's `Nat` limit.

The browser parser creates a typed expression tree. Bend evaluates it using reduced rational numbers and solves the resulting linear equation. JavaScript formats those exact results as readable steps. The source is in `engine.bend`, `parser.js`, `steps.js`, and `app.js`.
