/**
 * Converte Prisma Decimal, string ou number para number.
 */
export function decimalToNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return parseFloat(value);
  if (typeof value === "object") {
    if ("toNumber" in value && typeof value.toNumber === "function") {
      return (value as { toNumber: () => number }).toNumber();
    }
    if ("toString" in value && typeof value.toString === "function") {
      return parseFloat((value as { toString: () => string }).toString());
    }
  }
  return parseFloat(String(value));
}

export function dateToIso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  return value.toISOString();
}
