import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import { fromSnapshot } from "../lib/world-mirror.ts";
import { fakeActions } from "../test-utils/fakes.ts";
import { IDS, profileSnapshot } from "../test-utils/fixtures.ts";
import FieldsPage from "./FieldsPage.svelte";

/** The Camelot fixture, plus a measurement field with a unit that nobody has a value for. */
function world() {
  const snapshot = profileSnapshot();
  snapshot.files = snapshot.files.map((file) => {
    if (file.ref.kind !== "fields") return file;
    const data = file.data as { fields: object[] };
    return {
      ...file,
      data: {
        ...data,
        fields: [
          ...data.fields,
          { key: "shoeSize", label: "Shoe size", type: "measurement", default: false, unit: "EU" },
        ],
      },
    };
  });
  return fromSnapshot(snapshot);
}

function mount(options: { canEdit?: boolean } = {}) {
  const fake = fakeActions({ canEdit: options.canEdit ?? true });
  const view = render(FieldsPage, { state: world(), actions: fake.actions });
  return { ...fake, ...view };
}

const pick = (name: string) => fireEvent.click(screen.getByRole("button", { name }));
const commandsOf = (batches: Array<{ commands: unknown[] }>) => batches.map((b) => b.commands);

async function leave(box: HTMLElement, text: string) {
  await fireEvent.focus(box);
  await fireEvent.input(box, { target: { value: text } });
  await fireEvent.blur(box);
}

describe("the sidebar", () => {
  it("lists the fields and the templates, each in its own group", () => {
    mount();
    expect(screen.getByRole("heading", { name: "Fields" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Templates" })).toBeTruthy();
    for (const label of ["Birthday", "Title", "Weapon", "Blood type", "Shoe size", "Knight"]) {
      expect(screen.getByRole("button", { name: label })).toBeTruthy();
    }
  });

  it("asks for a selection first", () => {
    mount();
    expect(screen.getByText("Select a field or template.")).toBeTruthy();
  });

  it("moves a field when its grip is nudged, to the place after it", async () => {
    const { batches } = mount();
    await fireEvent.keyDown(screen.getByRole("button", { name: "Move Weapon" }), {
      key: "ArrowDown",
    });
    expect(commandsOf(batches)).toEqual([[{ type: "field.move", key: "weapon", index: 4 }]]);
  });

  it("moves a template when its grip is nudged", async () => {
    const { batches } = mount();
    await fireEvent.keyDown(screen.getByRole("button", { name: "Move Knight" }), {
      key: "ArrowUp",
    });
    // Knight is the only template, so there is nowhere to go.
    expect(batches).toEqual([]);
  });
});

describe("a field's settings", () => {
  it("shows the name, type and options", async () => {
    mount();
    await pick("Blood type");
    expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Name" }).value).toBe(
      "Blood type",
    );
    expect(screen.getByRole<HTMLSelectElement>("combobox", { name: "Type" }).value).toBe("select");
    for (const option of ["A", "B", "AB", "O"]) {
      expect(screen.getByRole("button", { name: `Remove option ${option}` })).toBeTruthy();
    }
  });

  it("renames a field by changing only its label", async () => {
    const { batches } = mount();
    await pick("Blood type");
    await leave(screen.getByRole("textbox", { name: "Name" }), "Blood group");
    expect(commandsOf(batches)).toEqual([
      [{ type: "field.update", key: "bloodType", set: { label: "Blood group" } }],
    ]);
  });

  it("locks the type while characters have a value, and says how many", async () => {
    mount();
    await pick("Blood type");
    expect(screen.getByRole<HTMLSelectElement>("combobox", { name: "Type" }).disabled).toBe(true);
    expect(screen.getByText("1 character has a value, so the type can't change.")).toBeTruthy();
  });

  it("lets the type change when nobody has a value", async () => {
    const { batches } = mount();
    await pick("Steed");
    const type = screen.getByRole<HTMLSelectElement>("combobox", { name: "Type" });
    expect(type.disabled).toBe(false);
    await fireEvent.change(type, { target: { value: "number" } });
    expect(commandsOf(batches)).toEqual([
      [{ type: "field.update", key: "steed", set: { type: "number" } }],
    ]);
  });

  it("sets and removes a measurement's unit", async () => {
    const { batches } = mount();
    await pick("Shoe size");
    const unit = screen.getByRole("textbox", { name: "Unit" });
    expect((unit as HTMLInputElement).value).toBe("EU");
    await leave(unit, "UK");
    await leave(unit, "");
    expect(commandsOf(batches)).toEqual([
      [{ type: "field.update", key: "shoeSize", set: { unit: "UK" } }],
      [{ type: "field.update", key: "shoeSize", set: { unit: null } }],
    ]);
  });

  it("has no unit box on a field that isn't a measurement", async () => {
    mount();
    await pick("Weapon");
    expect(screen.queryByRole("textbox", { name: "Unit" })).toBeNull();
  });

  it("turns 'Shown on every character' on and off", async () => {
    const { batches } = mount();
    await pick("Weapon");
    const shown = screen.getByRole("switch", { name: "Shown on every character" });
    expect(shown.getAttribute("aria-checked")).toBe("false");
    await fireEvent.click(shown);
    expect(commandsOf(batches)).toEqual([
      [{ type: "field.update", key: "weapon", set: { default: true } }],
    ]);
  });

  it("moves the subtitle to the field it is turned on for, and can turn it off", async () => {
    const { batches } = mount();
    await pick("Birthday");
    const under = screen.getByRole("switch", { name: "Show under the name" });
    expect(under.getAttribute("aria-checked")).toBe("false");
    await fireEvent.click(under);
    await pick("Title");
    const current = screen.getByRole("switch", { name: "Show under the name" });
    expect(current.getAttribute("aria-checked")).toBe("true");
    await fireEvent.click(current);
    expect(commandsOf(batches)).toEqual([
      [{ type: "fields.setSubtitle", key: "birthday" }],
      [{ type: "fields.setSubtitle", key: null }],
    ]);
  });
});

describe("a select field's options", () => {
  it("adds an option, once", async () => {
    const { batches } = mount();
    await pick("Blood type");
    const input = screen.getByRole("textbox", { name: "New option" });
    await fireEvent.input(input, { target: { value: "X" } });
    await fireEvent.keyDown(input, { key: "Enter" });
    await fireEvent.input(input, { target: { value: "A" } }); // already there
    await fireEvent.keyDown(input, { key: "Enter" });
    expect(commandsOf(batches)).toEqual([
      [{ type: "field.update", key: "bloodType", set: { options: ["A", "B", "AB", "O", "X"] } }],
    ]);
  });

  it("removes an option nobody uses straight away", async () => {
    const { batches } = mount();
    await pick("Blood type");
    await pick("Remove option A");
    expect(commandsOf(batches)).toEqual([
      [{ type: "field.update", key: "bloodType", set: { options: ["B", "AB", "O"] } }],
    ]);
  });

  it("asks before removing one that characters have, saying how many lose it", async () => {
    const { batches } = mount();
    await pick("Blood type");
    await pick("Remove option O");
    expect(screen.getByRole("heading", { name: "Remove 'O' from Blood type?" })).toBeTruthy();
    expect(screen.getByText("1 character will have it cleared.")).toBeTruthy();
    expect(batches).toEqual([]);
    await pick("Remove");
    expect(commandsOf(batches)).toEqual([
      [{ type: "field.update", key: "bloodType", set: { options: ["A", "B", "AB"] } }],
    ]);
  });

  it("does nothing on Cancel", async () => {
    const { batches } = mount();
    await pick("Blood type");
    await pick("Remove option O");
    await pick("Cancel");
    expect(batches).toEqual([]);
    expect(screen.queryByRole("heading", { name: /Remove 'O'/ })).toBeNull();
  });
});

describe("deleting and creating fields", () => {
  it("asks before deleting a field in use, saying how many characters lose their value", async () => {
    const { batches } = mount();
    await pick("Weapon");
    await pick("Delete field…");
    expect(screen.getByRole("heading", { name: "Delete Weapon?" })).toBeTruthy();
    expect(screen.getByText("1 character will lose their value.")).toBeTruthy();
    await pick("Delete");
    expect(commandsOf(batches)).toEqual([[{ type: "field.delete", key: "weapon" }]]);
  });

  it("says when nobody has a value", async () => {
    mount();
    await pick("Steed");
    await pick("Delete field…");
    expect(screen.getByText("No characters have a value.")).toBeTruthy();
  });

  it("deletes the selected field from the sidebar's minus button too", async () => {
    mount();
    await pick("Steed");
    await pick("Delete Steed");
    expect(screen.getByRole("heading", { name: "Delete Steed?" })).toBeTruthy();
  });

  it("makes a new field from the plus button's form, as a field on no character", async () => {
    const { batches } = mount();
    await pick("Add a field");
    await fireEvent.input(screen.getByRole("textbox", { name: "Field name" }), {
      target: { value: "Ring size" },
    });
    await fireEvent.click(screen.getByRole("button", { name: "Add field" }));
    expect(commandsOf(batches)).toEqual([
      [
        {
          type: "field.create",
          field: { key: "ringSize", label: "Ring size", type: "text", default: false },
        },
      ],
    ]);
  });
});

describe("templates", () => {
  it("lists the fields in library order with the template's ticked", async () => {
    mount();
    await pick("Knight");
    expect(screen.getByRole("checkbox", { name: "Weapon" })).toHaveProperty("checked", true);
    expect(screen.getByRole("checkbox", { name: "Steed" })).toHaveProperty("checked", true);
    expect(screen.getByRole("checkbox", { name: "Liege" })).toHaveProperty("checked", false);
  });

  it("unticks and ticks a field, keeping the library's order", async () => {
    const { batches } = mount();
    await pick("Knight");
    await fireEvent.click(screen.getByRole("checkbox", { name: "Steed" }));
    await fireEvent.click(screen.getByRole("checkbox", { name: "Liege" }));
    expect(commandsOf(batches)).toEqual([
      [{ type: "template.update", id: IDS.knightTemplate, set: { fields: ["weapon"] } }],
      [
        {
          type: "template.update",
          id: IDS.knightTemplate,
          set: { fields: ["liege", "weapon", "steed"] },
        },
      ],
    ]);
  });

  it("renames, and sets or clears the role", async () => {
    const { batches } = mount();
    await pick("Knight");
    await leave(screen.getByRole("textbox", { name: "Name" }), "Knight errant");
    await fireEvent.change(screen.getByRole("combobox", { name: "Role" }), {
      target: { value: "" },
    });
    expect(commandsOf(batches)).toEqual([
      [{ type: "template.update", id: IDS.knightTemplate, set: { name: "Knight errant" } }],
      [{ type: "template.update", id: IDS.knightTemplate, set: { role: null } }],
    ]);
  });

  it("asks before deleting one, saying how many characters use it and that values stay", async () => {
    const { batches } = mount();
    await pick("Knight");
    await pick("Delete template…");
    expect(screen.getByRole("heading", { name: "Delete the Knight template?" })).toBeTruthy();
    expect(screen.getByText("1 character uses it. Their values are kept.")).toBeTruthy();
    await pick("Delete");
    expect(commandsOf(batches)).toEqual([[{ type: "template.delete", id: IDS.knightTemplate }]]);
  });

  it("creates a template with an id of its own and opens it", async () => {
    const { batches } = mount();
    await pick("Add a template");
    const command = batches[0]!.commands[0] as {
      type: string;
      template: { id: string; name: string };
    };
    expect(command.type).toBe("template.create");
    expect(command.template.name).toBe("New template");
    expect(command.template.id).toMatch(/^[a-z0-9]{16}$/);
  });
});

describe("without edit access", () => {
  it("shows the settings but offers no way to change them", async () => {
    mount({ canEdit: false });
    await pick("Blood type");
    expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Name" }).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Delete field…" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add a field" })).toBeNull();
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Move Weapon" }).disabled).toBe(
      true,
    );
  });
});
