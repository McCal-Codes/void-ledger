export type Fissure = {
  id?: string;
  tier: string;
  missionType: string;
  node: string;
  faction: string;
  start: Date;
  end: Date;
  minutesRemaining: number;
  speedScore: number;
  recommended: boolean;
  isHard?: boolean;
  notes?: string;
};
