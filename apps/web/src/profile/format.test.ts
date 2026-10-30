import { describe, expect, it } from "vitest";
import type { FieldDefinition } from "@dramatis-personae/schema";
import { MONTHS, formatDate, formatValue } from "./format.ts";

const field = (type: FieldDefinition["type"], extra: Partial<FieldDefinition> = {}) =>
  ({ key: "k", label: "K", type, default: false, ...extra }) as FieldDefinition;

describe("formatDate", () => {
  it.each([
    [{ calendar: "gregorian", month: 8, day: 15 }, "15 August"],
    [{ calendar: "gregorian", year: 516, month: 8, day: 15 }, "15 August 516"],
    [{ calendar: "gregorian", year: 516, month: 8 }, "August 516"],
    [{ calendar: "gregorian", month: 8 }, "August"],
    [{ calendar: "gregorian", year: 516 }, "516"],
    [{ calendar: "gregorian", year: -44, month: 3, day: 15 }, "15 March -44"],
  ])("writes %j as %s", (date, text) => {
    expect(formatDate(date)).toBe(text);
  });

  it("knows twelve months", () => {
    expect(MONTHS).toHaveLength(12);
    expect(MONTHS[0]).toBe("January");
  });
});

describe("formatValue", () => {
  it("writes each type as plain text", () => {
    expect(formatValue(field("text"), "Arondight")).toBe("Arondight");
    expect(formatValue(field("number"), 42)).toBe("42");
    expect(formatValue(field("select", { options: ["O"] }), "O")).toBe("O");
    expect(formatValue(field("multiselect", { options: ["a", "b"] }), ["a", "b"])).toBe("a, b");
    expect(formatValue(field("colour"), "#3b6fd4")).toBe("#3b6fd4");
    expect(formatValue(field("date"), { calendar: "gregorian", month: 8, day: 15 })).toBe(
      "15 August",
    );
  });

  it("writes a measurement with its unit, or alone when it has none", () => {
    const measurement = field("measurement", { unit: "EU" });
    expect(formatValue(measurement, { value: 42, unit: "EU" })).toBe("42 EU");
    expect(formatValue(measurement, { value: 40, unit: "UK" })).toBe("40 UK");
    expect(formatValue(measurement, { value: 42, unit: "" })).toBe("42");
  });

  it("returns an empty string for no value", () => {
    expect(formatValue(field("text"), undefined)).toBe("");
  });
});
