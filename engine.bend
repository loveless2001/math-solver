import Base

# Exact rational arithmetic. Zero is always Q{False{}, 0n, 1n}.
type Rational is Data:
  Q{negative: Bool, numerator: Nat, denominator: Nat}

def gcd(fuel: Nat, a: Nat, b: Nat) -> Nat:
  match fuel b:
    case 0n 0n:
      a
    case 0n 1n+bp:
      1n
    case 1n+p 0n:
      a
    case 1n+p 1n+ +bp:
      gcd(p, 1n+bp, Nat.mod(a, 1n+bp))

def nonzero_fraction(negative: Bool, +numerator: Nat, +denominator: Nat) -> Rational:
  +factor = gcd(96n, numerator, denominator)
  Q{negative, Nat.div(numerator, factor), Nat.div(denominator, factor)}

def fraction(negative: Bool, numerator: Nat, denominator: Nat) -> Rational:
  match numerator:
    case 0n:
      Q{False{}, 0n, 1n}
    case 1n+p:
      nonzero_fraction(negative, 1n+p, denominator)

def zero() -> Rational:
  Q{False{}, 0n, 1n}

def one() -> Rational:
  Q{False{}, 1n, 1n}

def is_zero(value: Rational) -> Bool:
  match value:
    case Q{negative, numerator, denominator}:
      Nat.is_eq(numerator, 0n)

def negate(value: Rational) -> Rational:
  match value:
    case Q{negative, numerator, denominator}:
      fraction(Bool.not(negative), numerator, denominator)

def subtract_magnitudes_order(left_negative: Bool, left: Nat, right: Nat, denominator: Nat, order: Cmp) -> Rational:
  match order:
    case LT{}:
      fraction(Bool.not(left_negative), Nat.sub(right, left), denominator)
    case EQ{}:
      zero()
    case GT{}:
      fraction(left_negative, Nat.sub(left, right), denominator)

def subtract_magnitudes(left_negative: Bool, +left: Nat, +right: Nat, denominator: Nat) -> Rational:
  subtract_magnitudes_order(left_negative, left, right, denominator, Nat.cmp(left, right))

def add_parts(left_negative: Bool, right_negative: Bool, left: Nat, right: Nat, denominator: Nat) -> Rational:
  match left_negative right_negative:
    case False{} False{}:
      fraction(False{}, Nat.add(left, right), denominator)
    case True{} True{}:
      fraction(True{}, Nat.add(left, right), denominator)
    case False{} True{}:
      subtract_magnitudes(False{}, left, right, denominator)
    case True{} False{}:
      subtract_magnitudes(True{}, left, right, denominator)

def add(left: Rational, right: Rational) -> Rational:
  match left right:
    case Q{ln, lx, +ld} Q{rn, rx, +rd}:
      add_parts(ln, rn, Nat.mul(lx, rd), Nat.mul(rx, ld), Nat.mul(ld, rd))

def subtract(left: Rational, right: Rational) -> Rational:
  add(left, negate(right))

def different_sign(left: Bool, right: Bool) -> Bool:
  match left right:
    case False{} False{}:
      False{}
    case True{} True{}:
      False{}
    case False{} True{}:
      True{}
    case True{} False{}:
      True{}

def multiply(left: Rational, right: Rational) -> Rational:
  match left right:
    case Q{ln, lx, ld} Q{rn, rx, rd}:
      fraction(different_sign(ln, rn), Nat.mul(lx, rx), Nat.mul(ld, rd))

# The caller checks that right is nonzero.
def divide(left: Rational, right: Rational) -> Rational:
  match left right:
    case Q{ln, lx, ld} Q{rn, rx, rd}:
      fraction(different_sign(ln, rn), Nat.mul(lx, rd), Nat.mul(ld, rx))

type Expression is Data:
  Number{value: Rational}
  Variable{}
  Plus{left: Expression, right: Expression}
  Minus{left: Expression, right: Expression}
  Times{left: Expression, right: Expression}
  Over{left: Expression, right: Expression}

type Linear is Data:
  Line{coefficient: Rational, constant: Rational}

type Problem is Data:
  Nonlinear{}
  DivisionByZero{}

type Evaluation is Data:
  Evaluated{line: Linear}
  Failed{problem: Problem}

def add_lines(left: Linear, right: Linear) -> Evaluation:
  match left right:
    case Line{la, lb} Line{ra, rb}:
      Evaluated{Line{add(la, ra), add(lb, rb)}}

def subtract_lines(left: Linear, right: Linear) -> Evaluation:
  match left right:
    case Line{la, lb} Line{ra, rb}:
      Evaluated{Line{subtract(la, ra), subtract(lb, rb)}}

def multiply_lines_decide(la: Rational, +lb: Rational, ra: Rational, +rb: Rational, nonlinear: Bool) -> Evaluation:
  match nonlinear:
    case True{}:
      Failed{Nonlinear{}}
    case False{}:
      Evaluated{Line{add(multiply(la, rb), multiply(ra, lb)), multiply(lb, rb)}}

def multiply_lines(left: Linear, right: Linear) -> Evaluation:
  match left right:
    case Line{+la, +lb} Line{+ra, +rb}:
      multiply_lines_decide(la, lb, ra, rb, Bool.and(Bool.not(is_zero(la)), Bool.not(is_zero(ra))))

def divide_lines_decide(la: Rational, lb: Rational, ra: Rational, +rb: Rational, constant_divisor: Bool, divisor_zero: Bool) -> Evaluation:
  match constant_divisor divisor_zero:
    case False{} False{}:
      Failed{Nonlinear{}}
    case False{} True{}:
      Failed{Nonlinear{}}
    case True{} True{}:
      Failed{DivisionByZero{}}
    case True{} False{}:
      Evaluated{Line{divide(la, rb), divide(lb, rb)}}

def divide_lines(left: Linear, right: Linear) -> Evaluation:
  match left right:
    case Line{la, lb} Line{+ra, +rb}:
      divide_lines_decide(la, lb, ra, rb, is_zero(ra), is_zero(rb))

def combine_add(left: Evaluation, right: Evaluation) -> Evaluation:
  match left right:
    case Failed{problem} Evaluated{line}:
      Failed{problem}
    case Evaluated{line} Failed{problem}:
      Failed{problem}
    case Failed{problem} Failed{other}:
      Failed{problem}
    case Evaluated{left_line} Evaluated{right_line}:
      add_lines(left_line, right_line)

def combine_subtract(left: Evaluation, right: Evaluation) -> Evaluation:
  match left right:
    case Failed{problem} Evaluated{line}:
      Failed{problem}
    case Evaluated{line} Failed{problem}:
      Failed{problem}
    case Failed{problem} Failed{other}:
      Failed{problem}
    case Evaluated{left_line} Evaluated{right_line}:
      subtract_lines(left_line, right_line)

def combine_multiply(left: Evaluation, right: Evaluation) -> Evaluation:
  match left right:
    case Failed{problem} Evaluated{line}:
      Failed{problem}
    case Evaluated{line} Failed{problem}:
      Failed{problem}
    case Failed{problem} Failed{other}:
      Failed{problem}
    case Evaluated{left_line} Evaluated{right_line}:
      multiply_lines(left_line, right_line)

def combine_divide(left: Evaluation, right: Evaluation) -> Evaluation:
  match left right:
    case Failed{problem} Evaluated{line}:
      Failed{problem}
    case Evaluated{line} Failed{problem}:
      Failed{problem}
    case Failed{problem} Failed{other}:
      Failed{problem}
    case Evaluated{left_line} Evaluated{right_line}:
      divide_lines(left_line, right_line)

def evaluate(expression: Expression) -> Evaluation:
  match expression:
    case Number{value}:
      Evaluated{Line{zero(), value}}
    case Variable{}:
      Evaluated{Line{one(), zero()}}
    case Plus{left, right}:
      combine_add(evaluate(left), evaluate(right))
    case Minus{left, right}:
      combine_subtract(evaluate(left), evaluate(right))
    case Times{left, right}:
      combine_multiply(evaluate(left), evaluate(right))
    case Over{left, right}:
      combine_divide(evaluate(left), evaluate(right))

type Answer is Data:
  Unique{left: Linear, right: Linear, coefficient: Rational, target: Rational, value: Rational}
  EveryValue{left: Linear, right: Linear}
  NoValue{left: Linear, right: Linear, target: Rational}
  CannotSolve{problem: Problem}

def finish_equation(left: Linear, right: Linear, +coefficient: Rational, +target: Rational, zero_coefficient: Bool, zero_target: Bool) -> Answer:
  match zero_coefficient zero_target:
    case True{} True{}:
      EveryValue{left, right}
    case True{} False{}:
      NoValue{left, right, target}
    case False{} True{}:
      Unique{left, right, coefficient, target, divide(target, coefficient)}
    case False{} False{}:
      Unique{left, right, coefficient, target, divide(target, coefficient)}

def solve_lines(left: Linear, right: Linear) -> Answer:
  match left right:
    case Line{+la, +lb} Line{+ra, +rb}:
      +coefficient = subtract(la, ra)
      +target = subtract(rb, lb)
      finish_equation(Line{la, lb}, Line{ra, rb}, coefficient, target, is_zero(coefficient), is_zero(target))

def solve_evaluations(left: Evaluation, right: Evaluation) -> Answer:
  match left right:
    case Failed{problem} Evaluated{line}:
      CannotSolve{problem}
    case Evaluated{line} Failed{problem}:
      CannotSolve{problem}
    case Failed{problem} Failed{other}:
      CannotSolve{problem}
    case Evaluated{left_line} Evaluated{right_line}:
      solve_lines(left_line, right_line)

def solve(left: Expression, right: Expression) -> Answer:
  solve_evaluations(evaluate(left), evaluate(right))
