/** Início do dia civil local (meia-noite). */
export function getStartOfToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

/** Início do dia civil seguinte (limite exclusivo para queries). */
export function getStartOfTomorrow(from = getStartOfToday()): Date {
  const tomorrow = new Date(from);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow;
}
