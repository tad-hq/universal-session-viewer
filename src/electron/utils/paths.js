function expandPath(app, inputPath) {
  return app.expandPath(inputPath);
}

function resolveSymlinks(app, inputPath) {
  return app.resolveSymlinks(inputPath);
}

function getClaudeProjectsDir(app) {
  return app.getClaudeProjectsDir();
}

function getSessionViewerDataDir(app) {
  return app.getSessionViewerDataDir();
}

function getPromptsDir(app) {
  return app.getPromptsDir();
}

function getAllDiscoveryPaths(app) {
  return app.getAllDiscoveryPaths();
}

function shouldExcludePath(app, pathToCheck) {
  return app.shouldExcludePath(pathToCheck);
}

function sanitizeProjectPath(app, projectName) {
  return app.sanitizeProjectPath(projectName);
}

module.exports = {
  expandPath,
  resolveSymlinks,
  getClaudeProjectsDir,
  getSessionViewerDataDir,
  getPromptsDir,
  getAllDiscoveryPaths,
  shouldExcludePath,
  sanitizeProjectPath,
};
