function resolveContinuationChains(app) {
  return app.resolveContinuationChains();
}

function healOrphanedContinuations(app) {
  return app.healOrphanedContinuations();
}

function detectSessionContinuation(app, filePath) {
  return app.detectSessionContinuation(filePath);
}

module.exports = {
  resolveContinuationChains,
  healOrphanedContinuations,
  detectSessionContinuation,
};
