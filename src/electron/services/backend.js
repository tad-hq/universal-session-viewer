function analyzeSessionWithHaiku(app, session, bypassQuota = false, customInstructions = '') {
  return app.analyzeSessionWithHaiku(session, bypassQuota, customInstructions);
}

function analyzeSessionsQueue(app, sessions) {
  return app.analyzeSessionsQueue(sessions);
}

function isCacheStillValid(app, analysisTimestamp) {
  return app.isCacheStillValid(analysisTimestamp);
}

function computeFileHash(app, filePath) {
  return app.computeFileHash(filePath);
}

module.exports = {
  analyzeSessionWithHaiku,
  analyzeSessionsQueue,
  isCacheStillValid,
  computeFileHash,
};
