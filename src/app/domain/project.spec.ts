import { normalizeProjectDraft } from "./project";

describe("project draft", () => {
  it("normalizes an icon identity", () => {
    expect(
      normalizeProjectDraft({
        name: "  Cliente Aurora  ",
        color: "#237a58",
        iconName: "folder-kanban",
      }),
    ).toEqual({
      name: "Cliente Aurora",
      color: "#237A58",
      iconName: "folder-kanban",
      logoRelativePath: null,
    });
  });

  it("rejects an icon and a logo at the same time", () => {
    expect(() =>
      normalizeProjectDraft({
        name: "Cliente Aurora",
        color: "#237A58",
        iconName: "folder-kanban",
        logoRelativePath: "project-logos/aurora.png",
      }),
    ).toThrowError("Un proyecto sólo puede tener un icono o un logo");
  });
});