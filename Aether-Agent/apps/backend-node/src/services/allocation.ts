/**
 * Resource Allocation Agent — deterministic needs estimation.
 *
 * Maps a detected crisis into a concrete aid package. The formulas are kept
 * transparent on purpose: field coordinators must be able to audit why the
 * agent requested N meals or M medical kits before goods are dispatched.
 */

export interface AidPackage {
  estimatedPeopleAffected: number;
  waterLiters: number;
  meals: number;
  medicalKits: number;
  shelterKits: number;
  hygieneKits: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

const BASE_PEOPLE_AT_MAX_SEVERITY = 50_000;

export function estimateAidPackage(
  crisisType: string,
  severity: number,
  affectedPopulation?: number
): AidPackage {
  const sev = Math.min(Math.max(severity, 0), 1);
  const people =
    affectedPopulation ??
    Math.round(BASE_PEOPLE_AT_MAX_SEVERITY * sev * sev);

  // Water: 3 L/person/day for 3 days. Floods/tsunamis contaminate sources.
  const waterMultiplier =
    crisisType === 'Flood' || crisisType === 'Tsunami' ? 1.3 : 1;
  const waterLiters = Math.round(people * 9 * waterMultiplier);

  // Meals: 3 meals/person/day for 3 days. Droughts persist much longer.
  const mealMultiplier = crisisType === 'Drought' ? 1.5 : 1;
  const meals = Math.round(people * 9 * mealMultiplier);

  // Trauma caseload grows with structural collapse types of crises.
  const traumaHeavy = [
    'Earthquake',
    'Hurricane',
    'Tornado',
    'Volcanic Eruption',
  ].includes(crisisType);
  const medicalKits = Math.round(people * 0.05 * (traumaHeavy ? 1.6 : 1));

  // Shelter: displacement-heavy crises need more tents.
  const displacementHeavy = [
    'Earthquake',
    'Wildfire',
    'Flood',
    'Volcanic Eruption',
  ].includes(crisisType);
  const shelterKits = Math.round(people * (displacementHeavy ? 0.2 : 0.1));

  const hygieneKits = Math.round(people * 0.5);

  const priority: AidPackage['priority'] =
    sev >= 0.85
      ? 'critical'
      : sev >= 0.65
        ? 'high'
        : sev >= 0.4
          ? 'medium'
          : 'low';

  return {
    estimatedPeopleAffected: people,
    waterLiters,
    meals,
    medicalKits,
    shelterKits,
    hygieneKits,
    priority,
  };
}