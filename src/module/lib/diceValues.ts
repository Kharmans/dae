/**
 * A number field cannot roll dice when the actor is prepared: core evaluates the change synchronously and skips it.
 * Bare dice terms in such a value are rolled once instead, as a silent inline roll (see inlineRolls.ts) - when the
 * effect is applied, or for a passive effect when its item reaches an actor.
 */
const INLINE = /(\[\[\[?[\s\S]*?\]\]\]?)/;
// A dice term with its modifiers (2d4kh1, d20, 1d6r1), not part of a reference or a longer word.
const DICE = /(?<![\w@.#)\]])\d*d(?:\d+|%)(?:(?:kh|kl|k|dh|dl|rr|r|xo|x|min|max|cs|cf|ms)[<>=]*\d*)*(?![\w(@.])/g;
// Dice whose count or faces come from an expression cannot be wrapped on their own.
const UNWRAPPABLE = /\)\s*d\s*\d|\bd\s*[@(]/;

export type DiceValueState = "converted" | "unfixable";

export function wrapBareDice(value: string): { value: string, state?: DiceValueState } {
  if (!value || value.includes("dae.eval(") || value.includes("dae.roll(")) return { value };
  let converted = false, unfixable = false;
  const result = value.split(INLINE).map((part, index) => {
    if (index % 2 === 1) return part;
    if (UNWRAPPABLE.test(part)) {
      unfixable = true;
      return part;
    }
    return part.replace(DICE, term => {
      converted = true;
      return `[[[${term}]]]`;
    });
  }).join("");
  if (unfixable) return { value, state: "unfixable" };
  return converted ? { value: result, state: "converted" } : { value };
}
