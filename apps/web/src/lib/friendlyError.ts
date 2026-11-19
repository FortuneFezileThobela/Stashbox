// Turns any API failure into one plain sentence.

const CODE_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: "Please sign in to continue.",
  TOKEN_EXPIRED: "Your session has expired. Please sign in again.",
  INVALID_CREDENTIALS: "That email or password isn't right.",
  USER_ALREADY_EXISTS: "An account with those details already exists.",
  USER_NOT_FOUND: "We couldn't find that account.",
  TOKEN_NOT_FOUND: "We couldn't find that token. It may already be revoked.",
  FORBIDDEN: "You don't have permission to do that here.",
  WORKSPACE_NOT_FOUND: "We couldn't find that workspace.",
  PARENT_NOT_FOUND: "The parent workspace no longer exists.",
  HANDLE_TAKEN: "That handle is already taken. Try another one.",
  LAST_OWNER: "A workspace needs at least one owner. Make someone else an owner first.",
  MEMBER_NOT_FOUND: "That person isn't a member of this workspace.",
  ENTRY_NOT_FOUND: "That entry isn't available. It may have been removed.",
  INVALID_SNIPPET: "Snippets need both code and a language.",
  INVALID_ENTRY_STATE: "That entry isn't in a state where this can be done.",
  PROPOSAL_NOT_FOUND: "That suggestion isn't available any more.",
  INVALID_PROPOSAL_SHAPE: "Snippet suggestions need both code and a language.",
  INVALID_PROPOSAL_STATE: "This suggestion has already been handled.",
  INVALID_PROPOSAL: "That suggestion is incomplete.",
  PROPOSAL_WORKSPACE_MISMATCH: "That suggestion belongs to a different workspace.",
  SELF_APPROVAL_FORBIDDEN:
    "You can't approve your own work. Ask another reviewer, or use the owner override.",
  THREAD_NOT_FOUND: "That discussion isn't available any more.",
  INVALID_LINE_RANGE: "That line range doesn't look right.",
  VALIDATION_ERROR: "Please check what you entered and try again.",
  BAD_REQUEST: "Something in that request doesn't look right. Please check it and try again.",
  INTERNAL_ERROR: "Something went wrong on our side. Please try again in a moment.",
};

const STATUS_MESSAGES: Record<number, string> = {
  400: "Something in that request doesn't look right. Please check it and try again.",
  401: "Please sign in to continue.",
  403: "You don't have permission to do that here.",
  404: "We couldn't find what you were looking for.",
  409: "That conflicts with something that already exists.",
  413: "That's too large to save.",
  429: "You're going a little fast. Please wait a moment and try again.",
};

const GENERIC = "Something went wrong. Please try again.";

// Server text is only trusted when it already reads like a sentence.
const looksHuman = (s: unknown): s is string =>
  typeof s === "string" && /\s/.test(s) && !/^[A-Z_ ]+$/.test(s) && s.length < 160;

export interface FriendlyError {
  message: string;
  code?: string;
  status?: number;
}

export function friendlyError(err: any): FriendlyError {
  if (!err?.response) {
    return {
      message:
        err?.code === "ECONNABORTED"
          ? "That took too long. Please try again."
          : "We can't reach the server. Check your connection and try again.",
    };
  }

  const status: number = err.response.status;
  const data = err.response.data ?? {};
  const rawCode = data.code ?? data.error?.code ?? (typeof data.error === "string" ? data.error : undefined);
  const code = rawCode ? String(rawCode).toUpperCase() : undefined;
  const serverText = data.message ?? data.error?.message;

  let message = code ? CODE_MESSAGES[code] : undefined;
  if (!message && status < 500 && looksHuman(serverText)) message = serverText;
  if (!message) message = STATUS_MESSAGES[status];
  if (!message) message = status >= 500 ? CODE_MESSAGES.INTERNAL_ERROR : GENERIC;

  return { message, code, status };
}