export const normalizeSelectedPositionIds = (value) => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter(Boolean);
};

export const getRequiredPlayersBySport = (sport, matchLike, fallbackMaxPlayers = 2) => {
  const safeMatchLike = matchLike || {};
  const selectedPositionIds = normalizeSelectedPositionIds(safeMatchLike.selectedPositionIds);
  const benchMembersTeam1 = Number(safeMatchLike.benchMembersTeam1 || 0);
  const benchMembersTeam2 = Number(safeMatchLike.benchMembersTeam2 || 0);

  if (sport === "football") {
    return selectedPositionIds.length + benchMembersTeam1 + benchMembersTeam2;
  }

  if (selectedPositionIds.length > 0) {
    return selectedPositionIds.length;
  }

  const fallbackValue = Number(safeMatchLike.maxPlayers ?? fallbackMaxPlayers ?? 0);
  return Number.isFinite(fallbackValue) && fallbackValue > 0 ? fallbackValue : 0;
};

export const getEffectiveMaxPlayersForSport = (sport, matchLike, fallbackMaxPlayers = 2) => {
  const safeMatchLike = matchLike || {};
  const selectedPositionIds = normalizeSelectedPositionIds(safeMatchLike.selectedPositionIds);

  if (sport === "football") {
    const baseValue = Number(safeMatchLike.maxPlayers ?? fallbackMaxPlayers ?? 2);
    return Number.isFinite(baseValue) && baseValue > 0 ? baseValue : 2;
  }

  if (selectedPositionIds.length > 0) {
    return selectedPositionIds.length;
  }

  const baseValue = Number(safeMatchLike.maxPlayers ?? fallbackMaxPlayers ?? 2);
  return Number.isFinite(baseValue) && baseValue > 0 ? baseValue : 2;
};

export const getMatchCostValue = (matchLike) => {
  const safeMatchLike = matchLike || {};
  const rawValue = Number(safeMatchLike.costPerPlayer ?? safeMatchLike.costPerPerson ?? 0);
  if (Number.isFinite(rawValue) && rawValue > 0) {
    return rawValue;
  }

  const totalCourtCost = Number(safeMatchLike.totalCourtCost || 0);
  const requiredPlayers = getRequiredPlayersBySport(safeMatchLike.sport, safeMatchLike, Number(safeMatchLike.maxPlayers || 2));
  if (totalCourtCost > 0 && requiredPlayers > 0) {
    return Math.round(totalCourtCost / requiredPlayers);
  }
  return 0;
};
