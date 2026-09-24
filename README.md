# Math Steps

A small, beginner-friendly math helper built with Bend 2. It shows steps for arithmetic, powers, roots, linear and quadratic equations, and small matrix problems. Results stay exact when rational and are labeled approximate when irrational.

## Run locally

Requires Bend 2.0.16 and Python 3.

```bash
bend index.html -o dist
python3 -m http.server 8000 --directory dist
```

Open <http://localhost:8000>. The built site is static and works without a backend or an internet connection.

## Enter a matrix problem

The **Matrix builder** tab is the default. Choose an operation, set the size of matrix A (and the number of columns in B for matrix multiplication), then fill each labeled cell. The builder adds matching matrix B or vector b cells when needed. Enter whole numbers, decimals, or fractions such as `-3`, `0.5`, and `1/2`; **Fill empty cells with 0** helps with sparse matrices. Click **Show the steps** to solve.

Use **Type a problem** for arithmetic, one-variable equations, or direct matrix expressions. The **Symbols & syntax** tab lists supported operations and inserts examples into the typed field. Switching tabs or sizes keeps the values already entered in the builder.

Typed input accepts ordinary math and a focused subset of LaTeX: `\frac{1}{2}`, `\sqrt{9}`, `\sqrt[3]{8}`, `\times`, `\cdot`, `\div`, `\left(` / `\right)`, `\det`, and `\begin{bmatrix}1 & 2 \\ 3 & 4\end{bmatrix}` (also `pmatrix`). Optional `$...$`, `$$...$$`, `\(...\)`, and `\[...\]` delimiters work too. Use `^`, `**`, or superscript digits for powers; `sqrt(x)`, `cbrt(x)`, and `root(n,x)` for numeric roots. You can omit multiplication signs in expressions such as `2x` and `2(x+3)`, or type `det[[1,2],[3,4]]` without parentheses. Function name and LaTeX command suggestions appear as you type. The typed tab shows live LaTeX source and a rendered preview; answers and steps are rendered and have **Copy LaTeX** buttons.

## Check

```bash
bash verify.sh
```

## Scope

- Exact integer, decimal, and fraction calculations with `+`, `-`, `*`, `/`, and parentheses. Decimal inputs are converted to exact rational values; exact results may be shown as fractions.
- Numeric powers with exponent magnitude up to 20, including negative and rational exponents. Numeric square, cube, and nth roots with index 2 to 12. Irrational real results are approximated to six decimal places.
- Linear expressions in `x`, including distributing constant factors and collecting like terms.
- Linear equations with a unique solution, no solution, or every value as a solution. The displayed steps include substitution for unique solutions.
- Quadratic expressions and equations in `x`, including repeated roots and equations with no real roots.
- Vectors such as `[1,2]` and matrices such as `[[1,2],[3,4]]`, with 1 to 4 entries per row and 1 to 4 rows. Entries can use exact decimals, fractions, integer powers, and roots that evaluate to rational numbers.
- Matrix and vector addition, subtraction, scalar multiplication, matrix multiplication, matrix–vector multiplication, vector dot products, and scalar division. Use `*` or `×` for multiplication.
- `transpose(A)`, `det(A)`, `inv(A)`, and `rref(A)`, where `A` stands for a literal matrix expression. Determinants and inverses require a square matrix; inverses also require a nonsingular matrix.
- `solve(A,b)` for a linear system, where `A` is a literal coefficient matrix and `b` is a literal vector. The result distinguishes unique, inconsistent, and infinitely many solutions. Free parameters are named `t1`, `t2`, etc.
- Input through normal typing, the virtual keyboard, or the symbols tab. `×`, `÷`, and `−` are accepted alongside `*`, `/`, and `-`.

Examples:

```text
[[1,2],[3,4]] * [5,6]
det([[1,2],[3,4]])
inv([[1,2],[3,4]])
rref([[1,2,3],[2,4,6]])
solve([[2,1],[1,-1]],[5,1])
x^2 - 5x + 6 = 0
\sqrt{2} + 0.5
root(3,-8)
```

The solver handles polynomial expressions in `x` through degree 2. It does not handle roots containing `x`, higher-degree equations, complex roots, matrix powers, irrational matrix entries, or word problems. It limits input length, token count, matrix dimensions, number size, exponent magnitude, and root index; very large intermediate values may also be rejected by Bend's `Nat` limit. Use `solve(A,b)` syntax for systems; entering a matrix equation with `=` is not supported.

The browser parser creates a typed expression tree. Bend supplies reduced rational arithmetic and solves linear equations. The matrix solver uses those exact Bend operations for row reduction and other matrix calculations. `extended-math.js` handles powers, roots, and quadratic equations with exact rational arithmetic where possible. JavaScript formats the results as readable steps and renders the supported notation with native MathML, with no external runtime dependency.
