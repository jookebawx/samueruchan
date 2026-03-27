export type LevelProgress = {
  level: number;
  totalExp: number;
  currentLevelExp: number;
  nextLevelExp: number;
  expToNextLevel: number;
  progressPercent: number;
};

const BASE_LEVEL_EXP = 100;
const LEVEL_STEP_EXP = 50;

export function getExpRequiredForLevel(level: number) {
  const safeLevel = Math.max(1, Math.floor(level));
  return BASE_LEVEL_EXP + (safeLevel - 1) * LEVEL_STEP_EXP;
}

export function getLevelProgress(totalExp: number | null | undefined): LevelProgress {
  const safeTotalExp = Math.max(0, Math.floor(totalExp ?? 0));

  let level = 1;
  let currentLevelExp = safeTotalExp;
  let nextLevelExp = getExpRequiredForLevel(level);

  while (currentLevelExp >= nextLevelExp) {
    currentLevelExp -= nextLevelExp;
    level += 1;
    nextLevelExp = getExpRequiredForLevel(level);
  }

  const progressPercent = Math.min(
    100,
    Math.round((currentLevelExp / Math.max(1, nextLevelExp)) * 100)
  );

  return {
    level,
    totalExp: safeTotalExp,
    currentLevelExp,
    nextLevelExp,
    expToNextLevel: nextLevelExp - currentLevelExp,
    progressPercent,
  };
}
