import type { FieldDefinition } from "@dramatis-personae/schema";

/**
 * What every field control takes. The profile turns `onchange` into a
 * `setFields` and `onclear` into an `unsetFields` (profiles spec §3.1).
 */
export interface ControlProps {
  field: FieldDefinition;
  /** The character's value, or undefined when they have none. */
  value: unknown;
  /** The field's label, which names the control for assistive technology. */
  label: string;
  onchange: (value: unknown) => void;
  onclear: () => void;
}
