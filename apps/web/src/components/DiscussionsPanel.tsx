import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { DiscussionsApi } from "../api/Discussions.api";
import { toast } from "../lib/toast";
import type {
  DiscussionAuthor,
  DiscussionThread,
  DiscussionThreadDetail,
  Entry,
  ThreadStatus,
  WorkspaceAccess,
} from "../types/stashbox";

export interface LineRange {
  start: number;
  end: number;
}

interface Props {
  entry: Entry;
  role?: WorkspaceAccess;
  /** Lets the code block above light up the lines a thread points at */
  onHighlight: (range: LineRange | null) => void;
}

type Filter = "open" | "resolved" | "all";

const STATUS_BADGE: Record<ThreadStatus, { label: string; cls: string }> = {
  open: { label: "Open", cls: "badge-warn" },
  resolved: { label: "Resolved", cls: "badge-ok" },
  closed: { label: "Ended", cls: "badge-muted" },
};

const attempt = async (fn: () => Promise<void>) => {
  try {
    await fn();
  } catch {
    /* the error toast is shown globally */
  }
};

const nameOf = (a?: DiscussionAuthor) =>
  a?.fullName || a?.username || "Someone";
const initialsOf = (a?: DiscussionAuthor) =>
  nameOf(a)
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

const Avatar: React.FC<{ author?: DiscussionAuthor }> = ({ author }) =>
  author?.profileUrl ? (
    <img className="mini-avatar" src={author.profileUrl} alt="" />
  ) : (
    <span className="mini-avatar">{initialsOf(author)}</span>
  );

// Numbered lines starting at `from`, used for the excerpt a thread points at
const Excerpt: React.FC<{ code: string; from: number; to: number }> = ({
  code,
  from,
  to,
}) => {
  const lines = code.split("\n").slice(from - 1, to);
  return (
    <div className="code-block">
      <pre className="numbered" style={{ counterReset: `ln ${from - 1}` }}>
        {lines.map((line, i) => (
          <span key={i} className="code-line">
            {line}
          </span>
        ))}
      </pre>
    </div>
  );
};

export const DiscussionsPanel: React.FC<Props> = ({
  entry,
  role,
  onHighlight,
}) => {
  const { user } = useAuth();
  const me = user?.userId;
  const isReviewer = role === "owner" || role === "qa";
  const isViewer = role === "viewer";
  const totalLines = entry.code ? entry.code.split("\n").length : 0;

  const [threads, setThreads] = useState<DiscussionThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("open");
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DiscussionThreadDetail | null>(null);

  // New thread
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [lineStart, setLineStart] = useState("");
  const [lineEnd, setLineEnd] = useState("");

  // Reply
  const [reply, setReply] = useState("");
  const [withCode, setWithCode] = useState(false);
  const [replyCode, setReplyCode] = useState("");
  const [isSuggestion, setIsSuggestion] = useState(false);

  // Resolve
  const [resolving, setResolving] = useState(false);
  const [summary, setSummary] = useState("");

  const loadThreads = useCallback(async () => {
    try {
      setThreads(await DiscussionsApi.listByEntry(entry.entryId));
    } catch {
        //Error is shown using a global toast hence no need to show it here.
    } finally {
      setLoading(false);
    }
  }, [entry.entryId]);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  // Leaving the panel clears any highlight it left on the code
  useEffect(() => () => onHighlight(null), []);

  const isCurrent = (t: DiscussionThread) =>
    t.snippetVersionPinned === entry.version;

  const openThread = (t: DiscussionThread) =>
    attempt(async () => {
      if (openId === t.threadId) {
        setOpenId(null);
        setDetail(null);
        onHighlight(null);
        return;
      }
      setOpenId(t.threadId);
      setDetail(null);
      setResolving(false);
      setReply("");
      setWithCode(false);
      setReplyCode("");
      setIsSuggestion(false);
      // Only highlight when the thread was written against the code on screen
      onHighlight(
        t.lineStart && t.lineEnd && isCurrent(t)
          ? { start: t.lineStart, end: t.lineEnd }
          : null,
      );
      setDetail(await DiscussionsApi.getThread(t.threadId));
    });

  const startThread = () =>
    attempt(async () => {
      if (!title.trim() || !body.trim()) {
        toast.info("Add a title and a message to start a discussion.");
        return;
      }
      const hasStart = lineStart.trim() !== "";
      const hasEnd = lineEnd.trim() !== "";
      let range: { lineStart: number; lineEnd: number } | undefined;
      if (hasStart || hasEnd) {
        const start = Number(lineStart);
        const end = Number(hasEnd ? lineEnd : lineStart);
        if (!entry.code) {
          toast.info("Only snippets have lines to point at.");
          return;
        }
        if (
          !Number.isInteger(start) ||
          !Number.isInteger(end) ||
          start < 1 ||
          end < start
        ) {
          toast.info(
            "That line range doesn't look right. The end line can't come before the start.",
          );
          return;
        }
        if (end > totalLines) {
          toast.info(`This snippet only has ${totalLines} lines.`);
          return;
        }
        range = { lineStart: start, lineEnd: end };
      }
      await DiscussionsApi.createThread({
        entryId: entry.entryId,
        title: title.trim(),
        body: body.trim(),
        ...range,
      });
      toast.success("Discussion started.");
      setComposing(false);
      setTitle("");
      setBody("");
      setLineStart("");
      setLineEnd("");
      setFilter("open");
      await loadThreads();
    });

  const sendReply = () =>
    attempt(async () => {
      if (!detail) return;
      if (!reply.trim()) {
        toast.info("Write a message first.");
        return;
      }
      const code = withCode ? replyCode.trim() : "";
      if (withCode && !code) {
        toast.info("Add the code you want to share, or untick “Include code”.");
        return;
      }
      await DiscussionsApi.addComment(detail.threadId, {
        content: reply.trim(),
        codeBlock: code || undefined,
        codeLanguage: code ? entry.language || undefined : undefined,
        isSuggestion: Boolean(code && isSuggestion),
      });
      toast.success("Reply posted.");
      setReply("");
      setWithCode(false);
      setReplyCode("");
      setIsSuggestion(false);
      setDetail(await DiscussionsApi.getThread(detail.threadId));
    });

  const changeStatus = (status: ThreadStatus) =>
    attempt(async () => {
      if (!detail) return;
      await DiscussionsApi.updateStatus(
        detail.threadId,
        status,
        status === "resolved" ? summary.trim() : undefined,
      );
      toast.success(
        status === "open"
          ? "Discussion reopened."
          : status === "resolved"
            ? "Marked as resolved."
            : "Discussion ended.",
      );
      setResolving(false);
      setSummary("");
      await loadThreads();
      setDetail(await DiscussionsApi.getThread(detail.threadId));
    });

  const endThread = () => {
    if (
      !window.confirm(
        "End this discussion? People can still read it, and you can reopen it later.",
      )
    )
      return;
    changeStatus("closed");
  };

  const visible = threads.filter((t) =>
    filter === "all"
      ? true
      : filter === "open"
        ? t.status === "open"
        : t.status !== "open",
  );
  const openCount = threads.filter((t) => t.status === "open").length;

  return (
    <section aria-labelledby="discussion-title">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <h2
          id="discussion-title"
          className="section-title"
          style={{ marginBottom: 0 }}
        >
          Discussion{" "}
          {threads.length > 0 && (
            <span className="tab-count">{openCount} open</span>
          )}
        </h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div
            className="segmented compact"
            role="group"
            aria-label="Filter discussions"
          >
            {(["open", "resolved", "all"] as Filter[]).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
              >
                {f === "open" ? "Open" : f === "resolved" ? "Ended" : "All"}
              </button>
            ))}
          </div>
          {!composing && (
            <button
              className="btn btn-primary"
              onClick={() => setComposing(true)}
            >
              Start a discussion
            </button>
          )}
        </div>
      </div>

      {composing && (
        <div
          className="panel thread-form"
          style={{ whiteSpace: "normal", marginTop: 12 }}
        >
          <div className="form" style={{ gap: 12 }}>
            <div>
              <label className="label" htmlFor="thread-title">
                Title
              </label>
              <input
                id="thread-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What's the question or concern?"
              />
            </div>
            <div>
              <label className="label" htmlFor="thread-body">
                Message
              </label>
              <textarea
                id="thread-body"
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>
            {entry.code && (
              <div>
                <span className="label">
                  Point at specific lines{" "}
                  <span className="label-optional">
                    (optional, this snippet has {totalLines} lines)
                  </span>
                </span>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "120px 120px",
                    gap: 8,
                  }}
                >
                  <input
                    type="number"
                    min={1}
                    max={totalLines}
                    aria-label="First line"
                    placeholder="From line"
                    value={lineStart}
                    onChange={(e) => setLineStart(e.target.value)}
                  />
                  <input
                    type="number"
                    min={1}
                    max={totalLines}
                    aria-label="Last line"
                    placeholder="To line"
                    value={lineEnd}
                    onChange={(e) => setLineEnd(e.target.value)}
                  />
                </div>
                <p className="hint">
                  Use the line numbers shown beside the code. Leave “To line”
                  empty for a single line.
                </p>
              </div>
            )}
            <div className="actions">
              <button className="btn btn-primary" onClick={startThread}>
                Post discussion
              </button>
              <button
                className="btn btn-quiet"
                onClick={() => setComposing(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          marginTop: 12,
        }}
      >
        {loading ? (
          <div className="skeleton" style={{ height: 64 }} aria-busy="true" />
        ) : visible.length === 0 ? (
          <div
            className="panel"
            style={{ whiteSpace: "normal", color: "var(--text-secondary)" }}
          >
            {threads.length === 0
              ? "No one has started a discussion yet. Ask a question or point out something in the code."
              : filter === "open"
                ? "No open discussions. Nice and quiet."
                : "Nothing to show here."}
          </div>
        ) : (
          visible.map((t) => {
            const expanded = openId === t.threadId;
            const badge = STATUS_BADGE[t.status];
            const canManage =
              !isViewer &&
              (t.createdBy === me || entry.createdBy === me || isReviewer);

            return (
              <article
                key={t.threadId}
                className={`thread${expanded ? " is-open" : ""}`}
              >
                <button
                  type="button"
                  className="thread-head"
                  aria-expanded={expanded}
                  onClick={() => openThread(t)}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{t.title}</div>
                    <div className="proposal-meta">
                      <Avatar author={t.author} />
                      <span>
                        {t.createdBy === me ? "You" : nameOf(t.author)} on{" "}
                        {new Date(t.createdAt).toLocaleDateString()}
                        {typeof t.commentCount === "number"
                          ? `, ${t.commentCount} ${t.commentCount === 1 ? "reply" : "replies"}`
                          : ""}
                      </span>
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      alignItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    {t.lineStart && t.lineEnd && (
                      <span className="chip mono">
                        {t.lineStart === t.lineEnd
                          ? `Line ${t.lineStart}`
                          : `Lines ${t.lineStart} to ${t.lineEnd}`}
                      </span>
                    )}
                    <span className={`badge ${badge.cls}`}>{badge.label}</span>
                  </div>
                </button>

                {expanded && (
                  <div className="thread-body">
                    {!isCurrent(t) && (
                      <div className="callout" style={{ fontSize: 13 }}>
                        This was written against version{" "}
                        {t.snippetVersionPinned}. The entry is now on version{" "}
                        {entry.version}, so the lines below show the older code.
                      </div>
                    )}

                    {t.lineStart && t.lineEnd && t.codeSnapshot && (
                      <Excerpt
                        code={t.codeSnapshot}
                        from={t.lineStart}
                        to={Math.min(t.lineEnd, t.lineStart + 11)}
                      />
                    )}

                    <p style={{ whiteSpace: "pre-wrap" }}>{t.body}</p>

                    {t.status === "resolved" && t.resolutionSummary && (
                      <div
                        className="callout"
                        style={{ whiteSpace: "pre-wrap" }}
                      >
                        <strong>Resolved:</strong> {t.resolutionSummary}
                      </div>
                    )}

                    {!detail ? (
                      <div
                        className="skeleton"
                        style={{ height: 48 }}
                        aria-busy="true"
                      />
                    ) : (
                      detail.comments.map((c) => (
                        <div key={c.commentId} className="comment">
                          <div
                            className="proposal-meta"
                            style={{ marginTop: 0 }}
                          >
                            <Avatar author={c.author} />
                            <strong style={{ color: "var(--text-primary)" }}>
                              {c.authorId === me ? "You" : nameOf(c.author)}
                            </strong>
                            <span>
                              {new Date(c.createdAt).toLocaleString()}
                            </span>
                            {c.isSuggestion && (
                              <span className="badge badge-ok">
                                Suggested fix
                              </span>
                            )}
                          </div>
                          <p style={{ whiteSpace: "pre-wrap", marginTop: 6 }}>
                            {c.content}
                          </p>
                          {c.codeBlock && (
                            <div
                              className="code-block"
                              style={{ marginTop: 8 }}
                            >
                              <div className="code-block-head">
                                <span className="mono">
                                  {c.codeLanguage || "code"}
                                </span>
                              </div>
                              <pre>{c.codeBlock}</pre>
                            </div>
                          )}
                        </div>
                      ))
                    )}

                    {detail && (
                      <div className="form" style={{ gap: 10, marginTop: 4 }}>
                        {t.status !== "open" && (
                          <p className="hint" style={{ marginTop: 0 }}>
                            This discussion has ended.
                            {canManage ? " Reopen it to reply." : ""}
                          </p>
                        )}
                        {t.status === "open" && (
                          <div>
                            <label
                              className="label"
                              htmlFor={`reply-${t.threadId}`}
                            >
                              Reply
                            </label>
                            <textarea
                              id={`reply-${t.threadId}`}
                              rows={3}
                              value={reply}
                              onChange={(e) => setReply(e.target.value)}
                            />
                          </div>
                        )}
                        {t.status === "open" && entry.code && (
                          <label className="check">
                            <input
                              type="checkbox"
                              checked={withCode}
                              onChange={(e) => setWithCode(e.target.checked)}
                            />
                            Include code
                          </label>
                        )}
                        {t.status === "open" && withCode && (
                          <>
                            <textarea
                              className="mono"
                              rows={5}
                              spellCheck={false}
                              aria-label="Code to share"
                              value={replyCode}
                              onChange={(e) => setReplyCode(e.target.value)}
                            />
                            <label className="check">
                              <input
                                type="checkbox"
                                checked={isSuggestion}
                                onChange={(e) =>
                                  setIsSuggestion(e.target.checked)
                                }
                              />
                              This is a suggested fix
                            </label>
                          </>
                        )}
                        <div className="actions" style={{ flexWrap: "wrap" }}>
                          {t.status === "open" && (
                            <button
                              className="btn btn-primary"
                              onClick={sendReply}
                            >
                              Post reply
                            </button>
                          )}
                          {canManage && t.status === "open" && !resolving && (
                            <>
                              <button
                                className="btn"
                                onClick={() => setResolving(true)}
                              >
                                Mark as resolved
                              </button>
                              <button className="btn" onClick={endThread}>
                                End discussion
                              </button>
                            </>
                          )}
                          {canManage && t.status !== "open" && (
                            <button
                              className="btn"
                              onClick={() => changeStatus("open")}
                            >
                              Reopen
                            </button>
                          )}
                        </div>

                        {resolving && (
                          <div className="form" style={{ gap: 8 }}>
                            <label
                              className="label"
                              htmlFor={`sum-${t.threadId}`}
                            >
                              What settled it?{" "}
                              <span className="label-optional">(optional)</span>
                            </label>
                            <textarea
                              id={`sum-${t.threadId}`}
                              rows={2}
                              value={summary}
                              onChange={(e) => setSummary(e.target.value)}
                            />
                            <div className="actions">
                              <button
                                className="btn btn-primary"
                                onClick={() => changeStatus("resolved")}
                              >
                                Resolve
                              </button>
                              <button
                                className="btn btn-quiet"
                                onClick={() => setResolving(false)}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>
    </section>
  );
};
