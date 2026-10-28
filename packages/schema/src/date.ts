import { z } from "zod";

/** A date in a named calendar. Every part but the calendar is optional. */
export const DateValueSchema = z.looseObject({
  calendar: z.string().min(1),
  year: z.number().int().optional(),
  month: z.number().int().min(1).max(12).optional(),
  day: z.number().int().min(1).max(31).optional(),
});
export type DateValue = z.infer<typeof DateValueSchema>;
