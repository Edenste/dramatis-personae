# 0005. JSON files as the source of truth, with a derived search index and a per-world field library

- **Status:** Accepted
- **Date:** 2026-10-28

## Context

The server ([0002](0002-local-server-architecture.md)) needs a storage format for worlds, characters, relationships and settings. Requirements:

1. **Editable outside the app.** A world folder should be easy to edit by hand, with scripts, or with AI tools, including bulk edits across many characters.
2. **Indexing and search.** Users create categories, groups and saved searches, and find characters by text, roles and field values.
3. **Custom fields at two levels.** A user can add a field (for example, blood type) to some characters only, or add it to the world's defaults so every character has it. Search has to work the same way for both.

Expected scale is hundreds to a few thousand characters per world, all of which the graph needs in memory anyway.

FoundryVTT, a reference for the folder layout, used NeDB (JSON-lines files) up to v10 and moved to LevelDB (JSON values in a binary key-value store) in v11.

## Options considered

- **One JSON file per document** — readable, diffable and editable by any tool. Cross-document atomicity and search have to be built by the app.
- **LevelDB (FoundryVTT's current approach)** — fast writes and crash safety, but binary files that cannot be edited without a tool while the app is closed, and no secondary indexes. Fails requirements 1 and 2.
- **SQLite per world** — transactions, SQL queries, full-text search and the closest match to a cloud SQL database. Binary, so editing outside the app means going through export and import. Fails requirement 1 directly.
- **One JSON file per world** — simplest, but every save rewrites the whole world, an interrupted save risks all of it, and diffs are unreadable.
- **NeDB** — unmaintained, and keeps whole collections in memory.

## Decision

**Plain JSON files are the source of truth**, one file per document, in a FoundryVTT-style data directory outside the application install:

```
<data root>/                      default: the OS user-data directory; overridable in Config/options.json
├── Config/options.json           port, listen address, data path, …
├── Data/worlds/<name>-<id>/
│   ├── world.json                manifest: name, schema version, main view
│   ├── world.schema.json         generated JSON Schema for this world's documents
│   ├── fields.json               the world's field library
│   ├── roles.json
│   ├── relationship-types.json
│   ├── templates.json
│   ├── characters/<name>-<id>.json
│   ├── relationships/<a>-<b>-<id>.json
│   ├── events/<title>-<id>.json
│   ├── views/<name>-<id>.json
│   ├── searches/<name>-<id>.json
│   └── assets/portraits/…
├── Backups/
└── Logs/
```

File names, IDs and the shape of each document are set out in [0010](0010-world-data-model.md).

**External edits are supported:**

- The server watches the world folder and reloads files that change while it runs.
- Every file is validated on load. An invalid file is reported with its path and the problem, and the rest of the world keeps working.
- Each world gets a generated `world.schema.json` covering built-in and custom fields; documents reference it with `$schema`, so editors can autocomplete and validate.
- Field keys are readable (`"bloodType"`). Documents use generated IDs, with a readable name in the file name ([0010](0010-world-data-model.md)).
- Writes are atomic: write to a temporary file, then rename over the original.
- If a file changes on disk while the same document has unsaved edits in the app, the user chooses which version to keep.

**Search uses a derived, in-memory index** built when a world opens and kept up to date on every change, including external edits. It covers full-text search, roles and field values. Saved searches are stored as JSON query definitions, and grouping is done with roles ([0010](0010-world-data-model.md)). The index can always be rebuilt from the files.

**Fields come from a per-world field library** (`fields.json`). Each definition has a stable `key`, a display `label`, a `type` (text, number, date, colour, select, link to a character, measurement and so on), an infobox `section`, and a `default` flag:

- `default: true` — every character in the world has the field.
- `default: false` — a character has the field only through a field template or as a one-off field.

Adding a field from a single character's profile creates a library definition with `default: false` and adds it to that character's one-off fields. Promoting it to a world default flips the flag. Values are always stored under the definition's `key` in the character's `fields` object, so search treats both kinds identically. Renaming a field changes only its `label`.

```jsonc
// fields.json
{ "fields": [
  { "key": "age",       "label": "Age",        "type": "number", "section": "personal", "default": true },
  { "key": "bloodType", "label": "Blood type", "type": "select", "section": "personal", "default": false,
    "options": ["A", "B", "AB", "O"] }
] }

// characters/merlin-c1a9m3x8k2q7v5w0.json (abridged; full shape in 0010)
{ "$schema": "../world.schema.json", "id": "c1a9m3x8k2q7v5w0", "name": "Merlin",
  "extraFields": ["bloodType"], "fields": { "age": 312, "bloodType": "O" } }
```

## Consequences

- Worlds can be backed up, versioned and bulk-edited with ordinary tools.
- The app must implement validation, file watching, atomic writes, conflict handling and the search index itself.
- Changes spanning several files (for example, deleting a character and its relationships) are not atomic across files and need careful ordering and recovery on load.
- `world.json` carries a schema version, and migrations upgrade older worlds on open.
- The storage interface hides the file format, so a database-backed implementation can be added for the cloud version. The derived index could also be persisted (for example as a SQLite cache) if start-up time ever needs it, without changing the source of truth.
