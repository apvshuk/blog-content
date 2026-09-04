---
slug: 'k&r-c notes'
title: 'Notes from K&R C'
status: 'OPEN'
tags: ['learning-c', 'K&R', 'notes']
excerpt: ''
completed: false
---

# C Notes — K&R

---

## 1. Preprocessor

Runs before compilation — compiler sees only the expanded output, never `#` directives.

- `#include` — copies header verbatim, replaces the directive.
- `#define` — substitutes name with value everywhere in source. Compiler never sees the name.
- **Macros** — `#define` with arguments. Pure text substitution, not a function call. No stack overhead.
  - `#define SQUARE(x) ((x)*(x))` — parentheses critical. Without: `SQUARE(2+3)` → `2+3 * 2+3`.
- `#ifdef` — includes/excludes code blocks at compile time.

> **[bare-metal]** Wrap UART debug prints in `#ifdef DEBUG` — release build removes them entirely. Zero overhead, zero flash cost.

---

## 2. Integer Division & Arithmetic Promotion

Integer division truncates toward zero. `5/9 = 0`. C99 guarantees this; C89 leaves negative operands implementation-defined.

If either operand is floating-point, the result is floating-point — the integer operand is implicitly promoted to match.

> **[bare-metal]** Know your compiler's C standard.
> **[bare-metal]** Unsuffixed float literals (`5.0`) are `double`. Use `5.0f` for `float` — STM32F411's FPU is single-precision; `double` falls back to slow software emulation.

---

## 3. printf Format Specifiers

`%6.3f` — minimum field width `6`, precision `.3` (digits after decimal). Both optional. Look up when needed.

---

## 4. Symbolic Constants

`#define` names are not variables — no type, no storage, no declaration syntax. No semicolon.
Convention: `UPPER_CASE` for constants, `lower_case` for variables. Not enforced by compiler.

---

## 5. main()

`void main()` is invalid in all C standards. `main` must return `int`.

```c
int main(void) {
    return 0;
}
```

`(void)` ≠ `()` — no parameters vs unspecified parameters. K&R predates this distinction.

> **[bare-metal]** `main()` never returns — infinite loop running the device. Return type still `int`; return statement is unreachable.

---

## 6. Streams, Buffers, getchar(), putchar()

- **Stream** — abstract sequence of characters (concept).
- **Buffer** — memory block holding stream data temporarily (mechanism).

`getchar()` reads one character from the stdin buffer. On a line-buffered terminal, the buffer fills on Enter — `getchar()` blocks until then, then drains one character at a time.
`putchar(c)` writes one character to stdout.

---

## 7. Character Constants

Single quotes → integer value. `'A'=65`, `'Z'=90`, `'a'=97`, `'\n'=10`, `'0'=48`, `'\0'=0`.

`'0'` (48) and `'\0'` (0) are not the same thing.

`getchar()` returns `int`, not `char` — necessary to represent EOF distinctly from any valid byte value.

---

## 8. stdin, stdout, stderr

| Stream   | Default                                    |
|----------|--------------------------------------------|
| `stdin`  | keyboard                                   |
| `stdout` | terminal                                   |
| `stderr` | terminal (separate stream, for errors)     |

All three exist at program startup. Redirectable via shell.

> **[bare-metal]** No `stdin`/`stdout`. UART replaces them — `printf()` equivalent for MCU→terminal.

---

## 9. Evaluation Order

- **Comma operator** `,` — evaluates left to right, yields right operand's value. Two expressions where one is syntactically expected. Avoid writing; recognise in others' code. Common in `for` headers: `for (i = 0, j = 10; i < j; ++i, --j)`.
- `&&` and `||` — short-circuit left to right. If `a` is false in `a && b`, `b` is never evaluated.
- **Chained assignment** — right to left. `nl = nw = nc = 0` → `nl = (nw = (nc = 0))`.

> **[bare-metal]** Put cheaper expression first in `&&`/`||` — short-circuits before the expensive one runs.

**Assignment is an expression, not a statement** — it has a value equal to what was assigned. `nc = 0` sets `nc` to zero and returns `0`; that returned value is what `nw` receives in a chain. This is why `while ((c = getchar()) != EOF)` works — `c = getchar()` assigns to `c` and simultaneously returns the assigned value, which is then compared to `EOF`. One expression, two effects.

---

## 10. Arrays

Subscript — any integer expression. `count[c - '0']`, `count[i+1]`, `count[f(x)]` all valid.
(see [§7](#7-character-constants) — `'0'` = 48, so `c - '0'` strips the ASCII offset and gives the digit's numeric value)

**Strings (char arrays) must end with `'\0'`.** Functions like `printf("%s", ...)`, `strlen`, `strcpy` walk the array byte by byte until they hit `'\0'`. Without it they read past the end into garbage memory.

> **[observe]** The `copy` function below is [§9](#9-evaluation-order) in action. `to[i] = from[i]` is an assignment expression — it copies the character AND returns the copied value in one shot. That returned value is immediately tested against `'\0'`. When the null terminator is copied, the condition fails and the loop exits — terminator included. Array-to-array transfer, null termination, and assignment-as-expression all at once:

```c
void copy(char to[], char from[]) {
    int i = 0;
    while ((to[i] = from[i]) != '\0')
        ++i;
}
```

---

## 11. Functions

C is call-by-value only — arguments are copied into parameters. Function works on copies; originals unchanged.

**Arrays as arguments — exception:** the value passed is the address of the first element, not a copy of the array. Function receives a pointer and operates on the original. `int arr[]` and `int *arr` are identical in a parameter list. The pointer itself is still passed by value.

- [ ] TODO: How does pointer-passing differ from true call-by-reference (e.g. C++ references)?
- [ ] TODO: Implement call-by-reference simulation using pointers.

---

## 12. Automatic vs External Variables

**Automatic (local) variables**
- Declared inside a function — private to it. `i` in `getline` is unrelated to `i` in `copy`, even same name.
- Come into existence on function call, destroyed on return. Don't retain values between calls — must be set explicitly each entry, or contain garbage.
- Called "automatic" because storage is managed automatically by call/return.

**External (global) variables**
- Defined *outside* any function → accessible by name from any function, without argument lists.
- Exist permanently — retain values even after the function that set them returns.

**Definition vs declaration**
- **Definition** — allocates storage. Written once, anywhere in the whole program (any file). No `extern` keyword: `int max;`
- **Declaration** — states type only, no storage: `extern int max;`. Tells *this file's* compiler pass "trust that `max` exists elsewhere, here's its type, generate code accordingly." The linker later matches declarations to the one real definition by **name** (not type — see mismatch note below).
- Each `.c` file compiles independently — the compiler never reads another file's text. `#include` only pastes text at preprocessing, within the file that includes it; it doesn't merge files into one compilation. So every file that *uses* an externally-defined variable needs the declaration present in its own text (typed directly, or pasted via a header) — this is why the type must be repeated per file.

**Scope of an `extern` declaration**
- Written inside a function → visible only in that function.
- Written at file-scope (outside any function), before a given function → visible in every function below it in that file. Functions defined *above* it can't see it (C reads top to bottom).
- If the **definition** itself sits at file-scope, same file, before all uses → no `extern` needed anywhere in that file; the definition already tells the compiler everything.

**Type mismatch — undefined behavior**
- Linker matches by name only, not type. `int max;` defined but `extern char max;` declared elsewhere links with no error — silently reads/writes the wrong number of bytes (or crashes on alignment mismatch).

**Initialization**
- Only allowed in the definition: `int max = 0;`. Never in a plain `extern` declaration.
- An initializer *makes* a declaration a definition (`extern int max = 0;` counts as defining it) — doing this in two files causes a multiple-definition linker error. Exactly one definition, with or without an initializer; every other file just declares via `extern`.

**Practical convention**
- Common practice: put all external definitions at the top of the file; `extern` is then redundant within that same file (definition already precedes use).
- Multi-file programs: collect `extern` declarations (and function prototypes) into a header (`.h`), `#include`d wherever needed. Standard library headers work the same way.

> **[bare-metal]** External variables are how ISRs (Interrupt Service Routines — functions that run when hardware interrupts the CPU, e.g. a button press, timer overflow, or incoming UART byte, then return control to wherever execution was interrupted) typically share state with `main()`. An ISR can't take arguments or return a value, so `volatile` externs are the bridge — e.g. ISR sets a flag, `main()`'s loop checks it. `volatile` forces a fresh read each time, since an ISR can change the value asynchronously.

## Chapter 2 — Types, Operators, and Expressions

### 1. Variable Names

- Must start with a letter; thereafter: letters, digits, underscores. Case-sensitive (`count` ≠ `Count`).
- Reserved keywords (`if`, `int`, `while`, …) cannot be used as identifiers.
- Avoid leading underscores — names beginning with `_` are reserved by the implementation. Collisions are silent.

---

### 2. Data Types

#### Basic types

| Type | Size | Notes |
|------|------|-------|
| `char` | 1 byte | One character or small integer |
| `int` | machine-defined | Whole number; natural word size |
| `float` | 32 bits | ~7 significant decimal digits |
| `double` | 64 bits | ~15 significant decimal digits |

**`char` stores a number, not a letter.** `'A'` is `65`. ASCII maps 0–127 to characters; values above 127 are encoding-dependent — accented and non-Latin characters require multi-byte schemes (e.g. UTF-8) that `char` cannot represent alone.

**Precision** = number of significant digits stored accurately. `float` → ~7, `double` → ~15. More bits = more decimal places stored correctly.

> **[bare-metal — STM32F411]** Write `5.0f`, not `5.0`. Unsuffixed decimals are `double` by default. The STM32F411 FPU is single-precision only; `double` arithmetic falls back to software emulation and is significantly slower.

---

#### Qualifiers

**`short` / `long`** — applies to `int` only.
- C guarantees: `short` ≥ 16 bits, `int` ≥ 16 bits, `long` ≥ 32 bits, and `sizeof(short) ≤ sizeof(int) ≤ sizeof(long)`.
- Common case: `short` = 16 bits, `int` = 32 bits. On some embedded targets both may be 16 bits — check `<limits.h>` when it matters.
- Style: write `long x`, not `long int x`.

**`signed` / `unsigned`** — applies to `char` and any integer type.
- `unsigned` *n*-bit: 0 to 2ⁿ−1. An 8-bit unsigned: 0 to 255.
- `signed` *n*-bit: −2ⁿ⁻¹ to 2ⁿ⁻¹−1. An 8-bit signed: −128 to 127. One extra negative because zero occupies a non-negative slot.
- Plain `char`: signedness is implementation-defined, but ASCII printable characters (0–127) are unaffected either way.

**`long double`** — extended-precision floating-point. Exact size is implementation-defined.

Valid qualifier combinations for floating-point:

| Qualifier | `float` | `double` |
|-----------|---------|----------|
| `long` | ✗ | ✓ → `long double` |
| `short` / `signed` / `unsigned` | ✗ | ✗ |

---

### 3. Constants

| Form | Type | Example |
|------|------|---------|
| Unsuffixed integer | `int` | `1234` |
| `l` or `L` suffix | `long` | `1234L` |
| `u` or `U` suffix | `unsigned int` | `1234U` |
| `ul` or `UL` (any case mix) | `unsigned long` | `1234UL` |
| Unsuffixed decimal or exponent | `double` | `123.4`, `1e-2` |
| `f` or `F` suffix | `float` | `1.5f` |
| `l` or `L` suffix (on decimal) | `long double` | `1.5L` |

**Character constants** — single quotes; integer under the hood. `'A'` = 65 (ASCII).

**String constants** — double quotes; `char[]` under the hood, null-terminated. `"hello"` occupies 6 bytes (5 + `'\0'`). `strlen()` from `<string.h>` returns the count excluding `'\0'`.

```c
'x'   // int     — ASCII value of 'x'
"x"   // char[2] — {'x', '\0'}
```

Escape sequences are valid in both single- and double-quoted literals.

**Enumeration constants:**

```c
enum months { JAN = 1, FEB, MAR, APR, MAY, JUN,
              JUL, AUG, SEP, OCT, NOV, DEC };
/* FEB = 2, MAR = 3, … */

enum months day = FEB;
```

- First enumerator defaults to 0; each subsequent one increments by 1 unless overridden. Unspecified values continue from the last specified value.
- `enum months` is a type; `day` is a variable of that type.
- Advantage over `#define`: provides type-checking that macros cannot.
- Although enum can store only integers or character constants representing integers.
