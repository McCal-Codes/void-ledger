export type Settings = {
  platform: "pc" | "ps4" | "xb1" | "switch";
  accountDataSource: "manual" | "alecaframe" | "overwolf";
  currentDucats: number;
  currentCredits: number;
  averageMinutesPerRun: number;
  expectedDucatsPerRun: number;
  hoursAvailablePerDay: number;
  sellThreshold: number;
  burnThreshold: number;
  platToDucatConversion: number;
  undercutBuffer: number;
  relayOpenDate: Date;
  relayCloseDate: Date;
};
