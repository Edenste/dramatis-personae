/**
 * A field key made from its label: camelCase ASCII letters and digits starting
 * with a letter (`Shoe size` → `shoeSize`). A taken key gets a number after it.
 */
export function fieldKeyFor(label: string, taken: ReadonlySet<string>): string {
  const words = label
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((word) => word.toLowerCase());
  let base = words
    .map((word, i) => (i === 0 ? word : word[0]!.toUpperCase() + word.slice(1)))
    .join("");
  if (base === "") base = "field";
  else if (!/^[A-Za-z]/.test(base)) base = `field${base[0]!.toUpperCase()}${base.slice(1)}`;
  let key = base;
  for (let n = 2; taken.has(key); n += 1) key = `${base}${n}`;
  return key;
}
