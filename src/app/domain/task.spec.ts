import { normalizeTaskDraft } from "./task";

describe("task draft", () => {
  it("requires a non-empty trimmed title", () => {
    expect(() => normalizeTaskDraft({ title: "   ", plannedDate: "2026-08-17" })).toThrowError(
      "El título es obligatorio",
    );
  });

  it("normalizes optional text and defaults", () => {
    expect(
      normalizeTaskDraft({
        title: "  Revisar PR  ",
        description: "   ",
        plannedDate: "2026-08-17",
      }),
    ).toEqual({
      title: "Revisar PR",
      description: null,
      projectId: null,
      priority: "medium",
      plannedDate: "2026-08-17",
      estimatedMinutes: null,
      actualMinutes: null,
    });
  });

  it("rejects negative durations", () => {
    expect(() =>
      normalizeTaskDraft({
        title: "Revisar PR",
        plannedDate: "2026-08-17",
        estimatedMinutes: -5,
      }),
    ).toThrowError("La duración no puede ser negativa");
  });
});
