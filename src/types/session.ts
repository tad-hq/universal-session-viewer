export interface Session {
  id: string;
  session_id?: string;
  title: string | null;
  summary: string | null;
  project_path?: string;
  projectPath?: string;
  project?: string;
  modified: number;
  last_message_time?: string | number;
  analysis_timestamp?: number;
  message_count?: number;
  messageCount?: number;
  is_analyzed?: number;
  status?: 'pending' | 'analyzing' | 'completed' | 'error';
  recentMessages?: Message[];

  continuation_of?: string | null;
  chain_position?: number | null;
  is_active_continuation?: number | boolean | null;
  continuation_count?: number;

  _searchMatchChapter?: number;
  _searchMatchTotalChapters?: number;
}

export interface SessionDetails extends Session {
  messages?: Message[];
  fullMessagesLoaded?: boolean;
}

export interface Message {
  type: 'user' | 'assistant';
  content: string;
  timestamp: string | number;
  uuid?: string;
}

export interface Project {
  project_path: string;
  session_count: number;
}

export interface PromptFile {
  filename: string;
  displayName: string;
}

export interface PaginationState {
  currentPage: number;
  pageSize: number;
  isLoading: boolean;
  hasMore: boolean;
  totalCount: number;
  displayedCount: number;
}

export interface DateFilter {
  from: string | null;
  to: string | null;
}

export type DateFilterPeriod = 'today' | 'week' | 'month' | 'quarter' | 'all';

export interface SessionFilters {
  projectPath: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  chainSessionIds: string[] | null;
}

export interface ContinuationMetadata {
  is_child: boolean;
  is_parent: boolean;
  depth: number;
  chain_position: number;
  is_active_continuation: boolean;
  child_count: number;
}

export interface ContinuationChain {
  parent: Session;
  children: Session[];
  totalSessions: number;
  maxDepth: number;

  flatDescendants?: ContinuationDescendant[];
  hasBranches?: boolean;
}

export interface SessionWithContinuations extends SessionDetails {
  continuationMetadata: ContinuationMetadata;
  continuationChain: ContinuationChain;
}

export interface ContinuationStats {
  total_chains: number;
  total_relationships: number;
  max_depth: number;
  orphaned_count: number;
  average_chain_length: string | number;
}

export interface ContinuationRelationship {
  child_session_id: string;
  parent_session_id: string;
  continuation_order: number;
  is_active_continuation: boolean;
  is_orphaned: boolean;
}

export interface ContinuationGroup {
  rootSession: Session;
  continuations: Session[];
  isExpanded: boolean;
  totalCount: number;
}

export interface ContinuationTreeNode {
  session: Session;
  children: ContinuationTreeNode[];
  parentSessionId: string | null;
  depth: number;
  siblingIndex: number;
  siblingCount: number;
  isActivePath: boolean;
}

export interface ContinuationDescendant {
  session: Session;
  parentSessionId: string;
  depth: number;
  continuationOrder: number;
  isActiveContinuation: boolean;
}

export interface ContinuationPath {
  sessionIds: string[];
  nodes: ContinuationTreeNode[];
  length: number;
  isActivePath: boolean;
  branchPoints: ContinuationBranchInfo[];
}

export interface ContinuationBranchInfo {
  branchPointId: string;
  branchCount: number;
  siblingIds: string[];
  depth: number;
}
