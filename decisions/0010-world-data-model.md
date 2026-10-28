# 0010. World data model: IDs, file names and document shapes

- **Status:** Accepted
- **Date:** 2026-10-28

## Context

[0005](0005-storage.md) makes JSON files the source of truth. This record fixes how those files are identified, named and shaped. The constraints:

- **People and AI tools edit the files directly**, so every fact must be written in exactly one place. A duplicated fact eventually gets edited in one copy and not the other.
- **Renames must be cheap and safe.** Renaming a character should not rewrite other files.
- **The format must map cleanly onto a database** for a future cloud version.
- **Speed comes from in-memory indexes built when a world opens** ([0005](0005-storage.md)), so the file layout can be chosen for correctness and editability.

## Options considered

**IDs:**

- **A readable ID fixed at creation** (`lancelot`). Readable, but after a rename the ID no longer matches the name, and clashes need suffixes.
- **A readable ID that follows renames**, as Obsidian does. A rename rewrites every file that references it, which is not atomic across files.
- **A random ID with a cosmetic name in the file name** (`lancelot-pm6i0t9upq3sgptb.json`), as FoundryVTT does with its exports.

**Relationships:**

- **Inside each character's file.** A two-way relationship would be written twice, and the two copies can drift apart.
- **One file per relationship type.** Several files per pair, and no clear home for each side's view of the relationship.
- **One file per pair of characters.**

**World-level lists:**

- **One file per item.** Ordered lists such as roles would need a number in every file, and reordering would rewrite many files.
- **Everything in `world.json`.** Every edit would rewrite one large shared file.
- **Split between libraries and documents.**

## Decision

**IDs and file names**

- **IDs:** every document, library entry and world has a random 16-character ID made of lowercase letters and digits. IDs are lowercase so they can't collide on case-insensitive file systems.
- **The ID inside the file is authoritative.** Files are named `<name>-<id>.json`, and the name part is cosmetic. Renaming in the app renames one file and nothing else.
- **References between files use bare IDs.**
- **Duplicate IDs** (for example, from copying a file) are reported, with an offer to give the copy a new ID. A file with no ID is given one.
- **Fields are the exception.** They keep a readable `key` such as `bloodType`, because the key is the property name in each character's `fields`.
- **World scope:** each world is a folder. Every document is identified by `(worldId, id)` in the storage interface. Files don't store their world, because the folder already says it. A database version would use the world ID as the first part of every key and as the partition key.

**Libraries and documents**

- **Libraries** are small, ordered sets of world settings, each in one file, where list order is meaningful:
  - `fields.json`
  - `roles.json`
  - `relationship-types.json`
  - `templates.json`
- **Documents** can be numerous and are edited independently, so each one has its own file:
  - characters
  - relationships
  - events
  - views
  - saved searches

**Characters**

- A character holds its role IDs, template IDs, one-off field keys, field values, an optional portrait (an original image plus crop values) and one Markdown `body`.
- Fields shown on a profile are the world's default fields, plus each of the character's templates' fields, plus its one-off fields. A value whose field isn't shown is kept but hidden, so removing a template doesn't lose data.
- There is no value history: a field holds its current value.

**Relationships**

- There is **one file per pair of characters**, holding three lists of type IDs:
  - `twoWay`: types both characters share;
  - `aToB`: one-way types from the first character to the second;
  - `bToA`: one-way types the other way.
- The file also holds a note for each side.
- A pair can have several types at once.

**Roles**

- **Membership lives on the character.** Leaders live on the role.
- **Each role is either major or minor.** Major roles always rank above minor roles, and list order ranks roles within each kind.
- **A character's colour** is the first of these that applies: their own colour override, their highest-ranked major role with a colour, their highest-ranked minor role with a colour, or a default grey.

**Dates**

- A date is `{ calendar, year?, month?, day? }`. The year is optional and may be fictional or negative.
- The calendar ID means custom calendars can be added later without a migration.

**Schema versions**

- `world.json` records a schema version. Opening an older world backs it up, then migrates it in memory, validates it and only then writes it.
- A world made by a newer version of the app opens read-only.

**Per-user interface state**, such as open tabs, is stored outside the world folder, in the data root's `Config/`.

## Consequences

- **Each fact is written in exactly one place,** so there are no copies to drift apart.
- **IDs:**
  - Renames are always a single atomic file rename.
  - Reading a relationship file by hand means looking up IDs in the folder listing. That's acceptable, because the file names pair names with IDs.
- **Files written by hand or by AI** can have invalid references or duplicate IDs. The app reports these instead of fixing them silently.
- **Databases:** relationships map to a standard edge table, indexed on both characters, and libraries and documents map to ordinary tables.
- **Reordering** a library rewrites only that library's file.
