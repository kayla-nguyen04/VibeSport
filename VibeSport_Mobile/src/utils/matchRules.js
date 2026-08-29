export const normalizeSelectedPositionIds = (value) => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter(Boolean);
};

export const getRequiredPlayersBySport = (sport, matchLike = {}, fallbackMaxPlayers = 2) => {
  const selectedPositionIds = normalizeSelectedPositionIds(matchLike.selectedPositionIds);
  const benchMembersTeam1 = Number(matchLike.benchMembersTeam1 || 0);
  const benchMembersTeam2 = Number(matchLike.benchMembersTeam2 || 0);

  if (sport === "football") {
    return selectedPositionIds.length + benchMembersTeam1 + benchMembersTeam2;
  }

  if (selectedPositionIds.length > 0) {
    return selectedPositionIds.length;
  }

  const fallbackValue = Number(matchLike.maxPlayers ?? fallbackMaxPlayers ?? 0);
  return Number.isFinite(fallbackValue) && fallbackValue > 0 ? fallbackValue : 0;
};

export const getEffectiveMaxPlayersForSport = (sport, matchLike = {}, fallbackMaxPlayers = 2) => {
  const selectedPositionIds = normalizeSelectedPositionIds(matchLike.selectedPositionIds);

  if (sport === "football") {
    const baseValue = Number(matchLike.maxPlayers ?? fallbackMaxPlayers ?? 2);
    return Number.isFinite(baseValue) && baseValue > 0 ? baseValue : 2;
  }

  if (selectedPositionIds.length > 0) {
    return selectedPositionIds.length;
  }

  const baseValue = Number(matchLike.maxPlayers ?? fallbackMaxPlayers ?? 2);
  return Number.isFinite(baseValue) && baseValue > 0 ? baseValue : 2;
};

export const getMatchCostValue = (matchLike = {}) => {
  const rawValue = Number(matchLike.costPerPlayer ?? matchLike.costPerPerson ?? 0);
  if (Number.isFinite(rawValue) && rawValue > 0) {
    return rawValue;
  }

  const totalCourtCost = Number(matchLike.totalCourtCost || 0);
  const requiredPlayers = getRequiredPlayersBySport(matchLike.sport, matchLike, Number(matchLike.maxPlayers || 2));
  if (totalCourtCost > 0 && requiredPlayers > 0) {
    return Math.round(totalCourtCost / requiredPlayers);
  }
  return 0;
};
