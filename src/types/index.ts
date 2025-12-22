export * from './session';
export * from './settings';
// Re-export ipc types - ContinuationGroupInfo is the IPC version, ContinuationGroup is in session.ts
export {
  type CleanupFunction,
  type QuotaInfo,
  type AnalysisStatus,
  type BulkAnalyzeProgress,
  type BulkAnalyzeComplete,
  type ErrorEntry,
  type SessionsUpdatedPayload,
  type DiscoveryCompletePayload,
  type ContinuationDetectionProgress,
  type ContinuationsDetected,
  type ContinuationsUpdated,
  type ResolveContinuationChainsResponse,
  type ContinuationGroupInfo,
  type ElectronAPI,
} from './ipc';
export * from './errors';
