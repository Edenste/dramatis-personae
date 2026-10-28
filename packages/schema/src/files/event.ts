import { z } from "zod";
import { DateValueSchema } from "../date.ts";
import { ColourSchema, IdSchema, fileBase } from "./common.ts";

export const EventFileSchema = z.looseObject({
  ...fileBase,
  id: IdSchema,
  title: z.string().min(1),
  date: DateValueSchema,
  repeat: z.enum(["yearly", "none"]),
  color: ColourSchema.nullable(),
  characters: z.array(IdSchema).default([]),
  body: z.string().default(""),
});
export type EventFile = z.infer<typeof EventFileSchema>;
