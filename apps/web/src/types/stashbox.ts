export type WorkspaceType = "personal" | "team";
export type WorkspaceVisibility = "private" | "public";
export type WorkspaceRole = "owner" | "qa" | "member";

export type WorkspaceAccess = WorkspaceRole | "viewer";

export type EntryType = "snippet" | "note";
export type ApprovalStatus =
  | "draft"
  | "pending_qa"
  | "qa_approved"
  | "deprecated";
export type ProposalStatus =
  | "draft"
  | "pending"
  | "approved"
  | "rejected"
  | "withdrawn";
export type ProposalType = "new_entry" | "update_entry";

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface DoAndDontRule {
  type: "do" | "dont";
  rule: string;
  explanation: string;
}

export interface Workspace {
  workspaceId: string;
  name: string;
  handle: string;
  type: WorkspaceType;
  visibility: WorkspaceVisibility;
  parentId?: string | null;
  forkedFromId?: string | null;
  role?: WorkspaceAccess;
  createdAt?: string;
  updatedAt?: string;
}

export interface Entry {
  entryId: string;
  workspaceId: string;
  type: EntryType;
  title: string;
  description: string;
  code?: string | null;
  language?: string | null;
  notes: string;
  gotchas?: string | null;
  dosAndDonts: DoAndDontRule[];
  targetRuntimes: string[];
  tags: string[];
  status: ApprovalStatus;
  version: number;
  verifiedBy?: string | null;
  verifiedAt?: string | null;
  forkedFromId?: string | null;
  forkedFromVersion?: number | null;
  createdBy: string;
  updatedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProposalAuthor {
  userId: string;
  username: string;
  fullName: string;
  jobTitle?: string | null;
  profileUrl?: string | null;
}

export interface EntryProposal {
  proposalId: string;
  targetWorkspaceId: string;
  targetEntryId?: string | null;
  sourceEntryId?: string | null;
  type: ProposalType;
  entryType: EntryType;
  status: ProposalStatus;
  title: string;
  description: string;
  code?: string | null;
  language?: string | null;
  notes: string;
  gotchas?: string | null;
  dosAndDonts: DoAndDontRule[];
  targetRuntimes: string[];
  authorId: string;
  reviewedBy?: string | null;
  reviewFeedback?: string | null;
  createdAt: string;
  updatedAt: string;
  author?: ProposalAuthor;
  originalEntry?: Entry | null;
}

export type ThreadStatus = "open" | "resolved" | "closed";

export interface DiscussionAuthor {
  userId: string;
  username: string;
  fullName: string;
  jobTitle?: string | null;
  profileUrl?: string | null;
}

export interface DiscussionComment {
  commentId: string;
  threadId: string;
  authorId: string;
  content: string;
  codeBlock?: string | null;
  codeLanguage?: string | null;
  isSuggestion: boolean;
  createdAt: string;
  updatedAt: string;
  author?: DiscussionAuthor;
}

export interface DiscussionThread {
  threadId: string;
  entryId: string;
  title: string;
  body: string;
  status: ThreadStatus;
  lineStart?: number | null;
  lineEnd?: number | null;
  snippetVersionPinned: number;
  codeSnapshot?: string | null;
  contextLanguage?: string | null;
  resolutionSummary?: string | null;
  resolvedBy?: string | null;
  resolvedAt?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  author?: DiscussionAuthor;
  commentCount?: number;
}

export interface DiscussionThreadDetail extends DiscussionThread {
  comments: DiscussionComment[];
}

export interface WorkspaceMember {
  userId: string;
  role: WorkspaceRole;
  joinedAt: string;
  fullName: string;
  username: string;
  jobTitle?: string | null;
  profileUrl?: string | null;
  // Only sent to workspace owners
  email?: string;
}

export interface MemberCandidate {
  userId: string;
  fullName: string;
  username: string;
  jobTitle?: string | null;
  profileUrl?: string | null;
}
