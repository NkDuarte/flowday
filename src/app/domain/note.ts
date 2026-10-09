export interface Note {
  readonly id: string;
  readonly title: string;
  readonly contentHtml: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface NoteDraft {
  readonly title: string;
  readonly contentHtml: string;
}
