export function calculateSpeedScore(missionType: string): number {
  const weights: Record<string, number> = {
    Capture: 1.0,
    Rescue: 0.95,
    Exterminate: 0.85,
    Sabotage: 0.75,
    "Mobile Defense": 0.55,
    Defense: 0.35,
    Interception: 0.25,
    Survival: 0.20,
  };
  return weights[missionType] || 0.1;
}

export function isRecommended(speedScore: number): boolean {
  return speedScore >= 0.75;
}
