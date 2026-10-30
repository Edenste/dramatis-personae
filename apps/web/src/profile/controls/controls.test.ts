import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import type { FieldDefinition } from "@dramatis-personae/schema";
import MeasurementControl from "./MeasurementControl.svelte";
import MultiSelectControl from "./MultiSelectControl.svelte";
import NumberControl from "./NumberControl.svelte";
import SelectControl from "./SelectControl.svelte";
import TextControl from "./TextControl.svelte";

const field = (type: FieldDefinition["type"], extra: Partial<FieldDefinition> = {}) =>
  ({ key: "k", label: "Label", type, default: false, ...extra }) as FieldDefinition;

function mount(
  component: unknown,
  props: { field: FieldDefinition; value?: unknown; label: string },
) {
  const onchange = vi.fn();
  const onclear = vi.fn();
  render(component as never, { value: undefined, ...props, onchange, onclear } as never);
  return { onchange, onclear };
}

/** Types into a text box and leaves it, the way a person edits a field. */
async function typeAndLeave(box: HTMLElement, text: string) {
  await fireEvent.focus(box);
  await fireEvent.input(box, { target: { value: text } });
  await fireEvent.blur(box);
}

describe("TextControl", () => {
  it("saves what was typed when the box is left, once", async () => {
    const { onchange, onclear } = mount(TextControl, { field: field("text"), label: "Weapon" });
    const box = screen.getByRole("textbox", { name: "Weapon" });
    await typeAndLeave(box, "Arondight");
    expect(onchange).toHaveBeenCalledExactlyOnceWith("Arondight");
    expect(onclear).not.toHaveBeenCalled();
  });

  it("saves nothing when the text is unchanged", async () => {
    const { onchange, onclear } = mount(TextControl, {
      field: field("text"),
      value: "Arondight",
      label: "Weapon",
    });
    const box = screen.getByRole("textbox", { name: "Weapon" });
    await fireEvent.focus(box);
    await fireEvent.blur(box);
    expect(onchange).not.toHaveBeenCalled();
    expect(onclear).not.toHaveBeenCalled();
  });

  it("clears the value when the box is emptied", async () => {
    const { onchange, onclear } = mount(TextControl, {
      field: field("text"),
      value: "Arondight",
      label: "Weapon",
    });
    await typeAndLeave(screen.getByRole("textbox", { name: "Weapon" }), "  ");
    expect(onclear).toHaveBeenCalledOnce();
    expect(onchange).not.toHaveBeenCalled();
  });

  it("saves on Enter", async () => {
    const { onchange } = mount(TextControl, { field: field("text"), label: "Weapon" });
    const box = screen.getByRole("textbox", { name: "Weapon" });
    await fireEvent.focus(box);
    await fireEvent.input(box, { target: { value: "Excalibur" } });
    await fireEvent.keyDown(box, { key: "Enter" });
    expect(onchange).toHaveBeenCalledExactlyOnceWith("Excalibur");
  });
});

describe("NumberControl", () => {
  it("saves a number", async () => {
    const { onchange } = mount(NumberControl, { field: field("number"), label: "Age" });
    await typeAndLeave(screen.getByRole("textbox", { name: "Age" }), "42");
    expect(onchange).toHaveBeenCalledExactlyOnceWith(42);
  });

  it("ignores text that isn't a number and puts the old value back", async () => {
    const { onchange, onclear } = mount(NumberControl, {
      field: field("number"),
      value: 30,
      label: "Age",
    });
    const box = screen.getByRole<HTMLInputElement>("textbox", { name: "Age" });
    await typeAndLeave(box, "abc");
    expect(onchange).not.toHaveBeenCalled();
    expect(onclear).not.toHaveBeenCalled();
    expect(box.value).toBe("30");
  });

  it("clears the value when emptied", async () => {
    const { onclear } = mount(NumberControl, { field: field("number"), value: 30, label: "Age" });
    await typeAndLeave(screen.getByRole("textbox", { name: "Age" }), "");
    expect(onclear).toHaveBeenCalledOnce();
  });
});

describe("MeasurementControl", () => {
  const shoe = field("measurement", { unit: "EU" });

  it("records the number in the field's unit, and shows the unit", async () => {
    const { onchange } = mount(MeasurementControl, { field: shoe, label: "Shoe size" });
    expect(screen.getByText("EU")).toBeTruthy();
    await typeAndLeave(screen.getByRole("textbox", { name: "Shoe size" }), "42");
    expect(onchange).toHaveBeenCalledExactlyOnceWith({ value: 42, unit: "EU" });
  });

  it("shows the unit a stored value was recorded in", () => {
    mount(MeasurementControl, {
      field: shoe,
      value: { value: 40, unit: "UK" },
      label: "Shoe size",
    });
    expect(screen.getByText("UK")).toBeTruthy();
    expect(screen.queryByText("EU")).toBeNull();
  });

  it("works for a field with no unit", async () => {
    const { onchange } = mount(MeasurementControl, {
      field: field("measurement"),
      label: "Height",
    });
    await typeAndLeave(screen.getByRole("textbox", { name: "Height" }), "180");
    expect(onchange).toHaveBeenCalledExactlyOnceWith({ value: 180, unit: "" });
  });
});

describe("SelectControl", () => {
  const blood = field("select", { options: ["A", "B", "AB", "O"] });

  it("chooses an option from the menu", async () => {
    const { onchange } = mount(SelectControl, { field: blood, label: "Blood type" });
    await fireEvent.click(screen.getByRole("button", { name: /Blood type/ }));
    await fireEvent.click(screen.getByRole("menuitemradio", { name: "O" }));
    expect(onchange).toHaveBeenCalledExactlyOnceWith("O");
  });

  it("ticks the current option and offers Clear", async () => {
    const { onclear } = mount(SelectControl, { field: blood, value: "AB", label: "Blood type" });
    await fireEvent.click(screen.getByRole("button", { name: /Blood type/ }));
    expect(screen.getByRole("menuitemradio", { name: "AB" }).getAttribute("aria-checked")).toBe(
      "true",
    );
    expect(screen.getByRole("menuitemradio", { name: "O" }).getAttribute("aria-checked")).toBe(
      "false",
    );
    await fireEvent.click(screen.getByRole("menuitem", { name: "Clear" }));
    expect(onclear).toHaveBeenCalledOnce();
  });

  it("says Empty when there is no value", () => {
    mount(SelectControl, { field: blood, label: "Blood type" });
    expect(screen.getByRole("button", { name: /Blood type/ }).textContent).toContain("Empty");
  });
});

describe("MultiSelectControl", () => {
  const tags = field("multiselect", { options: ["a", "b", "c"] });

  it("ticks options on and off, clearing the value when none are left", async () => {
    const { onchange, onclear } = mount(MultiSelectControl, { field: tags, label: "Tags" });
    await fireEvent.click(screen.getByRole("button", { name: "Tags" }));
    await fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "a" }));
    expect(onchange).toHaveBeenLastCalledWith(["a"]);
    await fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "b" }));
    expect(onchange).toHaveBeenLastCalledWith(["a", "b"]);
    await fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "a" }));
    await fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "b" }));
    expect(onclear).toHaveBeenCalledOnce();
  });

  it("shows the chosen options as chips that can be removed", async () => {
    const { onchange } = mount(MultiSelectControl, {
      field: tags,
      value: ["a", "c"],
      label: "Tags",
    });
    expect(screen.getByText("a")).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: "Remove a" }));
    expect(onchange).toHaveBeenCalledExactlyOnceWith(["c"]);
  });
});
