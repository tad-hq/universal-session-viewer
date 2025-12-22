function findAllSessions(app) {
  return app.findAllSessions();
}

function extractSessionMetadata(app, session) {
  return app.extractSessionMetadata(session);
}

function populateSessionMetadata(app, session) {
  return app.populateSessionMetadata(session);
}

function syncFilesystemToMetadata(app) {
  return app.syncFilesystemToMetadata();
}

function getSessionsToAnalyze(app) {
  return app.getSessionsToAnalyze();
}

module.exports = {
  findAllSessions,
  extractSessionMetadata,
  populateSessionMetadata,
  syncFilesystemToMetadata,
  getSessionsToAnalyze,
};
