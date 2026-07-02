export function calculateTimeEstimate(
  ducatGap: number,
  daysRemaining: number,
  averageMinutesPerRun: number,
  expectedDucatsPerRun: number
) {
  const safeDucatGap = Math.max(0, ducatGap);
  const safeExpectedDucatsPerRun = Math.max(0, expectedDucatsPerRun);
  const safeDaysRemaining = Math.max(0, daysRemaining);

  if (safeDucatGap === 0 || safeExpectedDucatsPerRun === 0) {
    return {
      runsNeeded: 0,
      hoursNeeded: 0,
      dailyDucatTarget: 0,
    };
  }

  const runsNeeded = safeDucatGap / safeExpectedDucatsPerRun;
  const hoursNeeded = (runsNeeded * averageMinutesPerRun) / 60;
  const dailyDucatTarget = safeDaysRemaining > 0 ? safeDucatGap / safeDaysRemaining : safeDucatGap;

  return {
    runsNeeded,
    hoursNeeded,
    dailyDucatTarget,
  };
}
