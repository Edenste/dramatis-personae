import { DateValueSchema, type DateValue } from "@dramatis-personae/schema";
import type { WorldModel } from "./world-model.ts";

export interface DateEntry {
  source: { kind: "field"; characterId: string; key: string } | { kind: "event"; eventId: string };
  date: DateValue;
  repeat: "yearly" | "none";
  title: string;
  color: string | null;
}

/** Every date the calendar shows: date fields switched on for it, plus events. */
export function dateEntries(model: WorldModel): DateEntry[] {
  const entries: DateEntry[] = [];
  const calendarFields = model
    .library("fields")
    .fields.filter((field) => field.type === "date" && field.calendar?.show);

  for (const character of model.all("character")) {
    const shown = new Set(model.shownFieldKeys(character.id));
    for (const field of calendarFields) {
      if (!shown.has(field.key)) continue;
      const date = DateValueSchema.safeParse(character.fields[field.key]);
      if (!date.success) continue;
      entries.push({
        source: { kind: "field", characterId: character.id, key: field.key },
        date: date.data,
        repeat: "yearly",
        title: (field.calendar?.title ?? field.label).replaceAll("{name}", character.name),
        color: field.calendar?.color ?? null,
      });
    }
  }

  for (const event of model.all("event")) {
    entries.push({
      source: { kind: "event", eventId: event.id },
      date: event.date,
      repeat: event.repeat,
      title: event.title,
      color: event.color,
    });
  }
  return entries;
}
