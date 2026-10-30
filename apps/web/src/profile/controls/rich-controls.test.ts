import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import type { FieldDefinition } from "@dramatis-personae/schema";
import type { CharacterSummary } from "../../lib/world-mirror.ts";
import CharacterControl from "./CharacterControl.svelte";
import ColourControl from "./ColourControl.svelte";
import DateControl from "./DateControl.svelte";

const field = (type: FieldDefinition["type"]) =>
  ({ key: "k", label: "Label", type, default: false }) as FieldDefinition;

function mount(component: unknown, props: Record<string, unknown>) {
  const onchange = vi.fn();
  const onclear = vi.fn();
  render(component as never, { value: undefined, ...props, onchange, onclear } as never);
  return { onchange, onclear };
}

async function typeAndLeave(box: HTMLElement, text: string) {
  await fireEvent.focus(box);
  await fireEvent.input(box, { target: { value: text } });
  await fireEvent.blur(box);
}

describe("DateControl", () => {
  const props = { field: field("date"), label: "Birthday" };
  const day = () => screen.getByRole("textbox", { name: "Birthday day" });
  const month = () => screen.getByRole("combobox", { name: "Birthday month" });
  const year = () => screen.getByRole("textbox", { name: "Birthday year" });

  it("sends the date once it has a day and a month, then adds a year", async () => {
    const { onchange } = mount(DateControl, props);
    await typeAndLeave(day(), "15");
    await fireEvent.change(month(), { target: { value: "8" } });
    expect(onchange).toHaveBeenLastCalledWith({ calendar: "gregorian", month: 8, day: 15 });
    await typeAndLeave(year(), "516");
    expect(onchange).toHaveBeenLastCalledWith({
      calendar: "gregorian",
      year: 516,
      month: 8,
      day: 15,
    });
  });

  it("sends nothing for a day without a month, and marks the day", async () => {
    const { onchange } = mount(DateControl, props);
    await typeAndLeave(day(), "15");
    expect(onchange).not.toHaveBeenCalled();
    expect(day().closest(".ctl")?.classList.contains("invalid")).toBe(true);
  });

  it("accepts a month on its own, and a negative year", async () => {
    const { onchange } = mount(DateControl, props);
    await fireEvent.change(month(), { target: { value: "3" } });
    expect(onchange).toHaveBeenLastCalledWith({ calendar: "gregorian", month: 3 });
    await typeAndLeave(year(), "-44");
    expect(onchange).toHaveBeenLastCalledWith({ calendar: "gregorian", year: -44, month: 3 });
  });

  it("refuses a day outside 1–31", async () => {
    const { onchange } = mount(DateControl, props);
    await fireEvent.change(month(), { target: { value: "2" } });
    onchange.mockClear();
    await typeAndLeave(day(), "40");
    expect(onchange).not.toHaveBeenCalled();
  });

  it("shows a stored date, and clears when everything is emptied", async () => {
    const { onclear } = mount(DateControl, {
      ...props,
      value: { calendar: "gregorian", year: 516, month: 8, day: 15 },
    });
    expect((day() as HTMLInputElement).value).toBe("15");
    expect((month() as HTMLSelectElement).value).toBe("8");
    expect((year() as HTMLInputElement).value).toBe("516");
    await typeAndLeave(day(), "");
    await typeAndLeave(year(), "");
    await fireEvent.change(month(), { target: { value: "" } });
    expect(onclear).toHaveBeenCalled();
  });
});

describe("ColourControl", () => {
  const props = { field: field("colour"), label: "Eyes" };
  const open = () => fireEvent.click(screen.getByRole("button", { name: /Eyes/ }));

  it("chooses a system colour", async () => {
    const { onchange } = mount(ColourControl, props);
    await open();
    await fireEvent.click(screen.getByRole("button", { name: "Blue" }));
    expect(onchange).toHaveBeenCalledExactlyOnceWith("#007AFF");
  });

  it("takes a hex colour typed in", async () => {
    const { onchange } = mount(ColourControl, props);
    await open();
    const hex = screen.getByRole("textbox", { name: "Eyes hex" });
    await fireEvent.input(hex, { target: { value: "#3b6fd4" } });
    await fireEvent.keyDown(hex, { key: "Enter" });
    expect(onchange).toHaveBeenCalledExactlyOnceWith("#3b6fd4");
  });

  it("refuses something that isn't a hex colour", async () => {
    const { onchange } = mount(ColourControl, props);
    await open();
    const hex = screen.getByRole("textbox", { name: "Eyes hex" });
    await fireEvent.input(hex, { target: { value: "red" } });
    await fireEvent.keyDown(hex, { key: "Enter" });
    expect(onchange).not.toHaveBeenCalled();
  });

  it("shows the current colour and clears it", async () => {
    const { onclear } = mount(ColourControl, { ...props, value: "#3b6fd4" });
    expect(screen.getByRole("button", { name: /Eyes/ }).textContent).toContain("#3b6fd4");
    await open();
    await fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onclear).toHaveBeenCalledOnce();
  });
});

describe("CharacterControl", () => {
  const characters: CharacterSummary[] = [
    { id: "arthurxxxxxxxxxx", name: "Arthur", color: "#3b6fd4" },
    { id: "lancelotxxxxxxxx", name: "Lancelot", color: "#3b6fd4" },
    { id: "ladyxxxxxxxxxxxx", name: "Lady of the Lake", color: "#99aab5" },
    { id: "morganxxxxxxxxxx", name: "Morgan le Fay", color: "#99aab5" },
  ];
  const props = { field: field("character"), label: "Liege", characters };
  const open = () => fireEvent.click(screen.getByRole("button", { name: /Liege/ }));
  const search = async (text: string) =>
    fireEvent.input(screen.getByRole("textbox", { name: "Search characters" }), {
      target: { value: text },
    });
  const names = () => screen.getAllByRole("option").map((o) => o.textContent?.trim());

  it("lists characters whose name has a word starting with what was typed", async () => {
    mount(CharacterControl, props);
    await open();
    expect(names()).toEqual(["Arthur", "Lancelot", "Lady of the Lake", "Morgan le Fay"]);
    await search("lan");
    expect(names()).toEqual(["Lancelot"]);
    await search("of");
    expect(names()).toEqual(["Lady of the Lake"]);
    await search("LE");
    expect(names()).toEqual(["Morgan le Fay"]);
  });

  it("chooses a character by id", async () => {
    const { onchange } = mount(CharacterControl, props);
    await open();
    await search("lan");
    await fireEvent.click(screen.getByRole("option", { name: "Lancelot" }));
    expect(onchange).toHaveBeenCalledExactlyOnceWith("lancelotxxxxxxxx");
  });

  it("shows the chosen character and clears", async () => {
    const { onclear } = mount(CharacterControl, { ...props, value: "arthurxxxxxxxxxx" });
    expect(screen.getByRole("button", { name: /Liege/ }).textContent).toContain("Arthur");
    await open();
    await fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onclear).toHaveBeenCalledOnce();
  });

  it("says when nobody matches", async () => {
    mount(CharacterControl, props);
    await open();
    await search("zzz");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText("No matching characters")).toBeTruthy();
  });
});
