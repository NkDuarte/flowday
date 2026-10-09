export type LocalDate = `${number}-${number}-${number}`;

export interface UtcRange {
  readonly start: string;
  readonly endExclusive: string;
}

interface LocalDateParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function toLocalDate(date: Date): LocalDate {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}` as LocalDate;
}

export function isLocalDate(value: string): value is LocalDate {
  const match = LOCAL_DATE_PATTERN.exec(value);
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(year, month - 1, day, 12);

  return (
    candidate.getFullYear() === year &&
    candidate.getMonth() === month - 1 &&
    candidate.getDate() === day
  );
}

export function addLocalDays(value: LocalDate, amount: number): LocalDate {
  const { year, month, day } = parseLocalDate(value);
  const date = new Date(year, month - 1, day, 12);
  date.setDate(date.getDate() + amount);
  return toLocalDate(date);
}

export function localDayUtcRange(value: LocalDate): UtcRange {
  const { year, month, day } = parseLocalDate(value);
  const start = new Date(year, month - 1, day);
  const endExclusive = new Date(year, month - 1, day + 1);

  return {
    start: start.toISOString(),
    endExclusive: endExclusive.toISOString(),
  };
}

function parseLocalDate(value: string): LocalDateParts {
  if (!isLocalDate(value)) {
    throw new Error(`Fecha local inválida: ${value}`);
  }

  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}
