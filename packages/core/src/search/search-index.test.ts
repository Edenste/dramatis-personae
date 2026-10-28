import { beforeAll, describe, expect, it } from "vitest";
import { CAMELOT_IDS } from "@dramatis-personae/samples";
import type { FileRef } from "@dramatis-personae/schema";
import { editFile, loadCamelotModel } from "../test-utils/camelot-model.ts";
import type { WorldModel } from "../model/world-model.ts";
import { SearchIndex } from "./search-index.ts";

const C = CAMELOT_IDS.characters;
const kay: FileRef = { kind: "character", id: C.Kay! };

let camelot: WorldModel;
beforeAll(async () => {
  camelot = await loadCamelotModel();
});

const ids = (index: SearchIndex, query: string) => index.search(query).map((hit) => hit.id);

describe("SearchIndex", () => {
  it("ranks a name prefix match first", () => {
    expect(SearchIndex.build(camelot).search("lanc")[0]?.id).toBe(C.Lancelot);
  });

  it("searches the body text", () => {
    expect(ids(SearchIndex.build(camelot), "lake")).toContain(C.Lancelot);
  });

  it("finds a role's members by the role's name", () => {
    const found = ids(SearchIndex.build(camelot), "round table");
    for (const member of camelot.membersOf(CAMELOT_IDS.roles["Knights of the Round Table"]!)) {
      expect(found).toContain(member);
    }
  });

  it("doesn't find values whose field is hidden", () => {
    expect(ids(SearchIndex.build(camelot), "gringolet")).toContain(C.Gawain);
    const model = editFile(camelot, { kind: "character", id: C.Gawain! }, (d) => {
      d.templates = [];
    });
    expect(ids(SearchIndex.build(model), "gringolet")).not.toContain(C.Gawain);
  });

  it("re-indexes a renamed character", () => {
    const index = SearchIndex.build(camelot);
    const model = editFile(camelot, kay, (d) => void (d.name = "Sir Kay the Bold"));
    index.update(model, [C.Kay!]);
    expect(ids(index, "bold")).toContain(C.Kay);
  });

  it("drops a deleted character", () => {
    const index = SearchIndex.build(camelot);
    index.update(camelot.withFiles([{ ref: kay, removed: true }]), [C.Kay!]);
    expect(ids(index, "kay")).not.toContain(C.Kay);
  });
});
