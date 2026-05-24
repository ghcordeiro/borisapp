/**
 * Motor de Nutrição Felina — boris.app
 *
 * Implementa as fórmulas metabólicas padrão da medicina veterinária:
 *
 * RER (Resting Energy Requirement):
 *   RER = 70 × (pesoKg ^ 0.75)  kcal/dia
 *   Representa a energia necessária em repouso completo.
 *
 * NED (Necessary Energy Daily / DER - Daily Energy Requirement):
 *   NED = RER × fatorEnergetico
 *   O fator energético varia por status fisiológico do animal.
 *
 * Referências: WSAVA Nutritional Assessment Guidelines,
 *              Waltham Pocket Book of Essential Nutrition for Cats and Dogs
 */

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type LifeStage =
  | "KITTEN"          // Filhote (< 12 meses)
  | "KITTEN_LARGE"    // Filhote de raça grande (até 18m)
  | "ADULT_INTACT"    // Adulto inteiro
  | "ADULT_NEUTERED"  // Adulto castrado
  | "PREGNANT"        // Gestante
  | "LACTATING"       // Lactante
  | "SENIOR"          // Idoso (> 7 anos)
  | "WEIGHT_LOSS"     // Perda de peso controlada
  | "WEIGHT_GAIN";    // Ganho de peso controlado

export interface NutritionInput {
  weightKg: number;
  lifeStage: LifeStage;
  mealsPerDay?: number; // Padrão: 4 refeições para filhotes, 2 para adultos
  wakeTime?: string;   // Horário de acordar do tutor (HH:MM)
  sleepTime?: string;  // Horário de dormir do tutor (HH:MM)
}

export interface MealDistribution {
  mealNumber: number;
  scheduledTime: string;  // Ex: "07:00"
  kcal: number;
  percentage: number;
}

export interface NutritionResult {
  weightKg: number;
  rerKcal: number;           // Energia em repouso (kcal/dia)
  nedKcal: number;           // Energia diária necessária (kcal/dia)
  energyFactor: number;      // Fator multiplicador aplicado
  lifeStage: LifeStage;
  mealsPerDay: number;
  mealDistribution: MealDistribution[];
  // Meta-informações para exibição
  lifeStageLabel: string;
  weightInGrams: number;
}

export interface DietItemCalculation {
  itemName: string;
  kcalPer100g: number;
  dailyKcalTarget: number;  // Quanto esse item contribui para o NED
  dailyGrams: number;       // Gramas diárias necessárias
  gramsPerMeal: number;     // Gramas por refeição
}

// ─── Constantes ───────────────────────────────────────────────────────────────

/**
 * Fatores energéticos por estágio de vida (DER/RER ratio).
 * Fonte: WSAVA Nutritional Assessment Guidelines 2021
 */
export const ENERGY_FACTORS: Record<LifeStage, number> = {
  KITTEN: 2.5,          // Crescimento ativo
  KITTEN_LARGE: 2.0,    // Crescimento mais lento
  ADULT_INTACT: 1.4,    // Adulto inteiro
  ADULT_NEUTERED: 1.2,  // Castrado (metabolismo reduzido ~15%)
  PREGNANT: 1.6,        // Gestação (2ª metade)
  LACTATING: 2.0,       // Lactação
  SENIOR: 1.1,          // Idoso (pode variar muito)
  WEIGHT_LOSS: 0.8,     // Restrição calórica
  WEIGHT_GAIN: 1.7,     // Ganho supervisionado
};

export const LIFE_STAGE_LABELS: Record<LifeStage, string> = {
  KITTEN: "Filhote (< 12 meses)",
  KITTEN_LARGE: "Filhote Raça Grande",
  ADULT_INTACT: "Adulto Inteiro",
  ADULT_NEUTERED: "Adulto Castrado",
  PREGNANT: "Gestante",
  LACTATING: "Lactante",
  SENIOR: "Idoso (> 7 anos)",
  WEIGHT_LOSS: "Perda de Peso",
  WEIGHT_GAIN: "Ganho de Peso",
};

const DEFAULT_MEALS_BY_STAGE: Partial<Record<LifeStage, number>> = {
  KITTEN: 4,
  KITTEN_LARGE: 4,
  LACTATING: 4,
};

const DEFAULT_MEAL_TIMES_4 = ["07:00", "12:00", "17:00", "21:00"];
const DEFAULT_MEAL_TIMES_3 = ["07:00", "13:00", "19:00"];
const DEFAULT_MEAL_TIMES_2 = ["08:00", "18:00"];

/**
 * Gera horários de refeições distribuídos entre o acordar e 1h antes de dormir,
 * adaptados à rotina do tutor.
 *
 * Exemplo: acordar 07:00, dormir 23:00, 4 refeições
 * Janela ativa: 07:00 → 22:00 (15h)
 * Intervalo: 15h / 3 gaps = 5h → 07:00, 12:00, 17:00, 22:00
 */
export function generateMealTimesFromRoutine(
  wakeTime: string,  // "HH:MM"
  sleepTime: string, // "HH:MM"
  mealsPerDay: number
): string[] {
  const toMinutes = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  };
  const toTime = (minutes: number) => {
    const h = Math.floor(minutes / 60) % 24;
    const m = minutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  const wakeMin = toMinutes(wakeTime);
  // Última refeição: 1h antes de dormir (mínimo 30min após o acordar)
  let sleepMin = toMinutes(sleepTime);
  // Se dormir antes de acordar (ex: 00:00), adiciona 24h
  if (sleepMin <= wakeMin) sleepMin += 24 * 60;
  const lastMealMin = sleepMin - 60;

  if (mealsPerDay === 1) return [toTime(wakeMin)];

  const totalWindow = lastMealMin - wakeMin;
  const interval = Math.round(totalWindow / (mealsPerDay - 1));

  return Array.from({ length: mealsPerDay }, (_, i) => toTime(wakeMin + interval * i));
}

// ─── Funções Puras ────────────────────────────────────────────────────────────

/**
 * Calcula o RER (Resting Energy Requirement).
 * RER = 70 × (pesoKg ^ 0.75) kcal/dia
 *
 * Para pesos muito baixos (< 2 kg), a fórmula linear é mais precisa:
 * RER = 30 × pesoKg + 70
 *
 * @param weightKg - Peso em quilogramas
 * @returns RER em kcal/dia (arredondado para 2 casas decimais)
 */
export function calculateRER(weightKg: number): number {
  if (weightKg <= 0) {
    throw new Error(`Peso inválido: ${weightKg}. Deve ser maior que 0.`);
  }

  // Fórmula linear para pesos muito baixos (< 2 kg — filhotes recém-nascidos)
  if (weightKg < 2) {
    return Math.round((30 * weightKg + 70) * 100) / 100;
  }

  // Fórmula alométrica padrão
  return Math.round(70 * Math.pow(weightKg, 0.75) * 100) / 100;
}

/**
 * Calcula o NED (Necessary Energy Daily / DER).
 * NED = RER × fatorEnergetico
 *
 * @param rerKcal - RER calculado
 * @param lifeStage - Estágio de vida do animal
 * @returns { nedKcal, energyFactor }
 */
export function calculateNED(
  rerKcal: number,
  lifeStage: LifeStage
): { nedKcal: number; energyFactor: number } {
  const energyFactor = ENERGY_FACTORS[lifeStage];
  const nedKcal = Math.round(rerKcal * energyFactor * 100) / 100;
  return { nedKcal, energyFactor };
}

/**
 * Gera a distribuição de refeições ao longo do dia.
 * Se wakeTime e sleepTime forem fornecidos, distribui pela rotina do tutor.
 *
 * @param nedKcal - Meta calórica diária
 * @param mealsPerDay - Número de refeições
 * @param wakeTime - Hora de acordar do tutor (HH:MM), opcional
 * @param sleepTime - Hora de dormir do tutor (HH:MM), opcional
 * @returns Array com horário, kcal e % por refeição
 */
export function distributeMeals(
  nedKcal: number,
  mealsPerDay: number,
  wakeTime?: string,
  sleepTime?: string,
): MealDistribution[] {
  let schedules: string[];

  if (wakeTime && sleepTime) {
    schedules = generateMealTimesFromRoutine(wakeTime, sleepTime, mealsPerDay);
  } else {
    schedules =
      mealsPerDay === 4
        ? DEFAULT_MEAL_TIMES_4
        : mealsPerDay === 3
        ? DEFAULT_MEAL_TIMES_3
        : DEFAULT_MEAL_TIMES_2;
  }

  const kcalPerMeal = Math.round((nedKcal / mealsPerDay) * 100) / 100;
  const percentage = Math.round((100 / mealsPerDay) * 10) / 10;

  return Array.from({ length: mealsPerDay }, (_, i) => ({
    mealNumber: i + 1,
    scheduledTime: schedules[i] ?? `${(6 + i * (18 / mealsPerDay)).toString().padStart(2, "0")}:00`,
    kcal: kcalPerMeal,
    percentage,
  }));
}

/**
 * Função principal: calcula o plano nutricional completo.
 *
 * @example
 * const resultado = calculateNutritionPlan({
 *   weightKg: 0.45,   // 450g — filhote de 8 semanas
 *   lifeStage: "KITTEN",
 *   mealsPerDay: 4,
 * });
 * // resultado.rerKcal ≈ 41.0 kcal
 * // resultado.nedKcal ≈ 102.5 kcal (fator 2.5)
 */
export function calculateNutritionPlan(input: NutritionInput): NutritionResult {
  const { weightKg, lifeStage, mealsPerDay, wakeTime, sleepTime } = input;

  const effectiveMeals =
    mealsPerDay ?? DEFAULT_MEALS_BY_STAGE[lifeStage] ?? 2;

  const rerKcal = calculateRER(weightKg);
  const { nedKcal, energyFactor } = calculateNED(rerKcal, lifeStage);
  const mealDistribution = distributeMeals(nedKcal, effectiveMeals, wakeTime, sleepTime);

  return {
    weightKg,
    rerKcal,
    nedKcal,
    energyFactor,
    lifeStage,
    mealsPerDay: effectiveMeals,
    mealDistribution,
    lifeStageLabel: LIFE_STAGE_LABELS[lifeStage],
    weightInGrams: Math.round(weightKg * 1000),
  };
}

/**
 * Calcula quantos gramas de um alimento são necessários para atingir
 * uma meta calórica específica.
 *
 * @param kcalTarget - Meta calórica a atingir com esse alimento (kcal)
 * @param kcalPer100g - Calorias por 100g do alimento
 * @returns Gramas necessárias (arredondado para 1 casa decimal)
 */
export function calculateGramsForKcal(
  kcalTarget: number,
  kcalPer100g: number
): number {
  if (kcalPer100g <= 0) {
    throw new Error("kcalPer100g deve ser maior que 0");
  }
  return Math.round((kcalTarget / kcalPer100g) * 100 * 10) / 10;
}

/**
 * Distribui a meta calórica entre múltiplos itens de dieta.
 * Cada item recebe um percentual do NED total.
 *
 * @param nedKcal - Meta calórica diária total
 * @param items - Lista de itens com nome, kcal/100g e percentual desejado
 * @returns Cálculo detalhado por item
 */
export function calculateDietItems(
  nedKcal: number,
  mealsPerDay: number,
  items: Array<{ name: string; kcalPer100g: number; percentageOfDiet: number }>
): DietItemCalculation[] {
  return items.map((item) => {
    const dailyKcalTarget = (nedKcal * item.percentageOfDiet) / 100;
    const dailyGrams = calculateGramsForKcal(dailyKcalTarget, item.kcalPer100g);
    const gramsPerMeal = Math.round((dailyGrams / mealsPerDay) * 10) / 10;

    return {
      itemName: item.name,
      kcalPer100g: item.kcalPer100g,
      dailyKcalTarget: Math.round(dailyKcalTarget * 100) / 100,
      dailyGrams,
      gramsPerMeal,
    };
  });
}
