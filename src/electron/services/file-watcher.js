function startFileWatcher(app) {
  return app.startFileWatcher();
}

function handleFileChange(app, filePath, eventType) {
  return app.handleFileChange(filePath, eventType);
}

function handleFileDelete(app, filePath) {
  return app.handleFileDelete(filePath);
}

function stopFileWatcher(app) {
  return app.stopFileWatcher();
}

function startFilesystemSync(app) {
  return app.startFilesystemSync();
}

module.exports = {
  startFileWatcher,
  handleFileChange,
  handleFileDelete,
  stopFileWatcher,
  startFilesystemSync,
};
