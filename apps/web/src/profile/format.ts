import type { DateValue, FieldDefinition } from "@dramatis-personae/schema";

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** `15 August`, `15 August 516`, `August 516` or `516`, whichever parts the date has. */
export function formatDate(date: DateValue): string {
  const month = date.month === undefined ? undefined : MONTHS[date.month - 1];
  return [date.day, month, date.year].filter((part) => part !== undefined).join(" ");
}

/** A value as plain text. Character and colour values are shown as widgets, not through this. */
export function formatValue(field: FieldDefinition, value: unknown): string {
  if (value === undefined || value === null) return "";
  switch (field.type) {
    case "date":
      return formatDate(value as DateValue);
    case "measurement": {
      const { value: amount, unit } = value as { value: number; unit: string };
      return unit ? `${amount} ${unit}` : String(amount);
    }
    case "multiselect":
      return (value as string[]).join(", ");
    default:
      return typeof value === "string" || typeof value === "number"
        ? String(value)
        : JSON.stringify(value);
  }
}
