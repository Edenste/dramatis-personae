import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import { fromSnapshot } from "../lib/world-mirror.ts";
import { fakeActions } from "../test-utils/fakes.ts";
import { IDS, profileSnapshot, withData } from "../test-utils/fixtures.ts";
import Profile from "./Profile.svelte";

const state = fromSnapshot(profileSnapshot());

function mount(id: string, options: { size?: "page" | "card"; editing?: boolean } = {}) {
  const fake = fakeActions();
  const view = render(Profile, {
    state,
    id,
    size: options.size ?? "page",
    editing: options.editing ?? false,
    actions: fake.actions,
  });
  return { ...fake, ...view };
}

const leave = async (box: HTMLElement, text: string) => {
  await fireEvent.focus(box);
  await fireEvent.input(box, { target: { value: text } });
  await fireEvent.blur(box);
};

describe("Profile in view mode", () => {
  it("shows the name, subtitle, roles and the fields that have values", () => {
    const { container } = mount(IDS.lancelot);
    expect(screen.getByRole("heading", { name: "Lancelot" })).toBeTruthy();
    expect(container.querySelector(".subtitle")?.textContent).toBe("Knight of the Round Table");
    expect(screen.getByText("Knights of the Round Table")).toBeTruthy();
    expect(screen.getByText("15 August")).toBeTruthy();
    expect(screen.getByText("Weapon")).toBeTruthy();
    expect(screen.getByText("Arondight")).toBeTruthy();
  });

  it("hides fields with no value", () => {
    mount(IDS.lancelot);
    expect(screen.queryByText("Steed")).toBeNull();
  });

  it("offers no controls", () => {
    mount(IDS.lancelot);
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Add a field" })).toBeNull();
  });

  it("is a card-sized heading on a card", () => {
    mount(IDS.lancelot, { size: "card" });
    expect(screen.getByRole("heading", { level: 2, name: "Lancelot" })).toBeTruthy();
  });
});

describe("Profile in edit mode", () => {
  it("shows every shown field, with Empty for those without a value", () => {
    mount(IDS.lancelot, { editing: true });
    const steed = screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Steed" });
    expect(steed.placeholder).toBe("Empty");
  });

  it("saves a changed field value as one command", async () => {
    const { batches } = mount(IDS.lancelot, { editing: true });
    await leave(screen.getByRole("textbox", { name: "Weapon" }), "Arondight II");
    expect(batches).toEqual([
      {
        commands: [
          { type: "character.update", id: IDS.lancelot, setFields: { weapon: "Arondight II" } },
        ],
      },
    ]);
  });

  it("clears a value by unsetting it", async () => {
    const { batches } = mount(IDS.lancelot, { editing: true });
    await leave(screen.getByRole("textbox", { name: "Weapon" }), "");
    expect(batches[0]!.commands).toEqual([
      { type: "character.update", id: IDS.lancelot, unsetFields: ["weapon"] },
    ]);
  });

  it("renames the character from the name field, ignoring an empty name", async () => {
    const { batches } = mount(IDS.lancelot, { editing: true });
    const name = screen.getByRole("textbox", { name: "Name" });
    await leave(name, "  ");
    expect(batches).toEqual([]);
    await fireEvent.input(name, { target: { value: "Sir Lancelot" } });
    await fireEvent.keyDown(name, { key: "Enter" });
    expect(batches).toEqual([
      {
        commands: [{ type: "character.update", id: IDS.lancelot, set: { name: "Sir Lancelot" } }],
      },
    ]);
  });

  it("lets a one-off field be removed from the character, but not template or default ones", async () => {
    const { batches } = mount(IDS.merlin, { editing: true });
    await fireEvent.click(screen.getByRole("button", { name: "Remove Blood type from Merlin" }));
    expect(batches[0]!.commands).toEqual([
      { type: "character.update", id: IDS.merlin, set: { extraFields: [] } },
    ]);
  });

  it("has no remove button on a template field or a default field", () => {
    mount(IDS.lancelot, { editing: true });
    expect(screen.queryByRole("button", { name: /^Remove .* from Lancelot$/ })).toBeNull();
  });

  it("says where a field comes from", () => {
    mount(IDS.lancelot, { editing: true });
    expect(screen.getByText("Weapon").closest("[title]")?.getAttribute("title")).toBe(
      "From the Knight template",
    );
    expect(screen.getByText("Title").closest("[title]")?.getAttribute("title")).toBe(
      "Shown on every character",
    );
  });
});

describe("Add a field", () => {
  const open = async () => {
    await fireEvent.click(screen.getByRole("button", { name: "Add a field" }));
  };
  const search = (text: string) =>
    fireEvent.input(screen.getByRole("textbox", { name: "Search fields" }), {
      target: { value: text },
    });

  it("adds a library field to the character", async () => {
    const { batches } = mount(IDS.lancelot, { editing: true });
    await open();
    await search("blood");
    await fireEvent.click(screen.getByRole("option", { name: "Blood type" }));
    expect(batches[0]!.commands).toEqual([
      { type: "character.update", id: IDS.lancelot, set: { extraFields: ["bloodType"] } },
    ]);
  });

  it("creates a new measurement field and shows it on the character, in one batch", async () => {
    const { batches } = mount(IDS.lancelot, { editing: true });
    await open();
    await search("Shoe size");
    await fireEvent.click(screen.getByRole("button", { name: 'Create "Shoe size"' }));
    await fireEvent.change(screen.getByRole("combobox", { name: "Type" }), {
      target: { value: "measurement" },
    });
    await fireEvent.input(screen.getByRole("textbox", { name: "Unit" }), {
      target: { value: "EU" },
    });
    await fireEvent.click(screen.getByRole("button", { name: "Add field" }));
    expect(batches).toEqual([
      {
        commands: [
          {
            type: "field.create",
            field: {
              key: "shoeSize",
              label: "Shoe size",
              type: "measurement",
              default: false,
              unit: "EU",
            },
          },
          { type: "character.update", id: IDS.lancelot, set: { extraFields: ["shoeSize"] } },
        ],
      },
    ]);
  });

  it("makes a select field from options typed one per line", async () => {
    const { batches } = mount(IDS.lancelot, { editing: true });
    await open();
    await search("Mood");
    await fireEvent.click(screen.getByRole("button", { name: 'Create "Mood"' }));
    await fireEvent.change(screen.getByRole("combobox", { name: "Type" }), {
      target: { value: "select" },
    });
    await fireEvent.input(screen.getByRole("textbox", { name: "Options" }), {
      target: { value: "calm\n\n stormy " },
    });
    await fireEvent.click(screen.getByRole("button", { name: "Add field" }));
    const create = batches[0]!.commands[0] as { field: { options: string[] } };
    expect(create.field.options).toEqual(["calm", "stormy"]);
  });

  it("won't add a select field with no options", async () => {
    mount(IDS.lancelot, { editing: true });
    await open();
    await search("Mood");
    await fireEvent.click(screen.getByRole("button", { name: 'Create "Mood"' }));
    await fireEvent.change(screen.getByRole("combobox", { name: "Type" }), {
      target: { value: "select" },
    });
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Add field" }).disabled).toBe(
      true,
    );
  });

  it("links to the Fields and templates tab", async () => {
    const { tabs } = mount(IDS.lancelot, { editing: true });
    await open();
    await fireEvent.click(screen.getByRole("button", { name: "Manage fields…" }));
    expect(tabs).toEqual(["fields"]);
  });

  it("offers a library field only once, and no create option for a name that exists", async () => {
    mount(IDS.lancelot, { editing: true });
    await open();
    await search("Blood type");
    expect(screen.queryByRole("button", { name: /^Create/ })).toBeNull();
  });
});

describe("Templates", () => {
  it("removes and adds a template on the page", async () => {
    const { batches } = mount(IDS.lancelot, { editing: true });
    await fireEvent.click(screen.getByRole("button", { name: "Remove the Knight template" }));
    expect(batches[0]!.commands).toEqual([
      { type: "character.update", id: IDS.lancelot, set: { templates: [] } },
    ]);
  });

  it("offers the templates the character doesn't have", async () => {
    const { batches } = mount(IDS.arthur, { editing: true });
    await fireEvent.click(screen.getByRole("button", { name: "Add a template" }));
    await fireEvent.click(screen.getByRole("menuitem", { name: "Knight" }));
    expect(batches[0]!.commands).toEqual([
      { type: "character.update", id: IDS.arthur, set: { templates: [IDS.knightTemplate] } },
    ]);
  });

  it("is left off a card", () => {
    mount(IDS.lancelot, { size: "card", editing: true });
    expect(screen.queryByRole("button", { name: "Remove the Knight template" })).toBeNull();
    expect(screen.getByRole("button", { name: "Add a field" })).toBeTruthy();
  });
});

describe("Character fields", () => {
  function withLiege() {
    const snapshot = profileSnapshot();
    snapshot.files = snapshot.files.map((file) =>
      file.ref.kind === "character" && file.ref.id === IDS.lancelot
        ? withData(file, {
            extraFields: ["liege"],
            fields: { ...(file.data as { fields: object }).fields, liege: IDS.arthur },
          })
        : file,
    );
    const fake = fakeActions();
    render(Profile, {
      state: fromSnapshot(snapshot),
      id: IDS.lancelot,
      size: "page",
      editing: false,
      actions: fake.actions,
    });
    return fake;
  }

  it("shows the character as a link that opens them", async () => {
    const { opened } = withLiege();
    await fireEvent.click(screen.getByRole("link", { name: "Open Arthur" }));
    expect(opened).toEqual([IDS.arthur]);
  });
});
