/**
 * @param {(number|null)} minutes
 * @param {(number|null)} seconds
 * @param {(boolean|null)} objectivesComplete
 * @returns {(number|null)}
 */
function missionScore(minutes, seconds, objectivesComplete) {}

/**
 * @param {(number|null)} obstacleRank
 * @param {(number|null)} missionRank
 * @param {(number|null)} notebookRank
 * @returns {(number|null)}
 */
function overallScore(obstacleRank, missionRank, notebookRank) {
  if (obstacleRank && missionRank && notebookRank)
    return obstacleRank + missionRank + notebookRank;
  else if (obstacleRank && notebookRank) return obstacleRank + notebookRank;
  else return null;
}

export { missionScore, overallScore };
