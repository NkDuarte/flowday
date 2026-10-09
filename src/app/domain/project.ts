export interface Project {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly iconName: string | null;
  readonly logoRelativePath: string | null;
  readonly isArchived: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ProjectDraft {
  readonly name: string;
  readonly color: string;
  readonly iconName?: string | null;
  readonly logoRelativePath?: string | null;
}

export function normalizeProjectDraft(draft: ProjectDraft): ProjectDraft {
  const name = draft.name.trim();
  if (!name) {
    throw new Error("El nombre del proyecto es obligatorio");
  }

  if (!/^#[0-9A-Fa-f]{6}$/.test(draft.color)) {
    throw new Error("El color del proyecto no es válido");
  }

  const iconName = draft.iconName?.trim() || null;
  const logoRelativePath = draft.logoRelativePath?.trim() || null;
  if (iconName && logoRelativePath) {
    throw new Error("Un proyecto sólo puede tener un icono o un logo");
  }

  return { name, color: draft.color.toUpperCase(), iconName, logoRelativePath };
}