import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Formata data no padrão pt-BR */
export function formatDate(date: Date | string) {
  return format(new Date(date), "dd/MM/yyyy", { locale: ptBR });
}

/** Retorna tempo relativo (ex: "há 3 dias") */
export function timeAgo(date: Date | string) {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR });
}

/** Formata peso em gramas ou kg conforme o valor */
export function formatWeight(weightKg: number): string {
  if (weightKg < 1) {
    return `${Math.round(weightKg * 1000)}g`;
  }
  return `${weightKg.toFixed(2)} kg`;
}

/** Formata kcal */
export function formatKcal(kcal: number): string {
  return `${kcal.toFixed(1)} kcal`;
}
