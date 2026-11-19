import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { WorkspacesApi } from "../api/workspaces.api";
import type {
  MemberCandidate,
  WorkspaceMember,
  WorkspaceRole,
} from "../types/stashbox";
import { toast } from "../lib/toast";
import { personInitials, personName } from "../lib/people";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

const ROLE_LABELS: Record<WorkspaceRole, string> = {
  owner: "Owner",
  qa: "QA reviewer",
  member: "Member",
};

// Never blank, and never an internal id
const labelFor = (m: WorkspaceMember) => personName(m);
const initialsFor = (m: WorkspaceMember) => personInitials(m);

function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export const WorkspaceSettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeWorkspace, refreshWorkspaces, setActiveWorkspaceId } =
    useWorkspace();

  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [handleEdited, setHandleEdited] = useState(false);
  const [type, setType] = useState<"personal" | "team">("team");
  const [visibility, setVisibility] = useState<"private" | "public">("private");

  const [forkHandle, setForkHandle] = useState("");
  const [memberQuery, setMemberQuery] = useState("");
  const [candidates, setCandidates] = useState<MemberCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<MemberCandidate | null>(null);
  const [memberRole, setMemberRole] = useState<WorkspaceRole>("member");

  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  const workspaceId = activeWorkspace?.workspaceId;
  const role = activeWorkspace?.role;
  const isOwner = role === "owner";
  const isViewer = role === "viewer";
  const me = user?.userId;

  // The returned sentence becomes the success toast. Errors are shown there by the API client.
  const run = async (fn: () => Promise<string>) => {
    try {
      toast.success(await fn());
    } catch {
      /* shown globally */
    }
  };

  const debouncedQuery = useDebounced(memberQuery.trim());

  // Search people by name or username while an owner types
  useEffect(() => {
    if (!workspaceId || !isOwner || picked || debouncedQuery.length < 2) {
      setCandidates([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    WorkspacesApi.searchMemberCandidates(workspaceId, debouncedQuery)
      .then((list) => {
        if (!cancelled) setCandidates(list);
      })
      .catch(() => {
        if (!cancelled) setCandidates([]);
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, isOwner, picked, debouncedQuery]);

  const loadMembers = useCallback(async () => {
    if (!workspaceId || isViewer) {
      setMembers([]);
      return;
    }
    setMembersLoading(true);
    try {
      const res = await WorkspacesApi.listMembers(workspaceId);
      setMembers(res.members);
    } catch {
      /* shown globally */
    } finally {
      setMembersLoading(false);
    }
  }, [workspaceId, isViewer]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    return run(async () => {
      const created = await WorkspacesApi.createWorkspace({
        name,
        handle,
        type,
        visibility,
      });
      await refreshWorkspaces();
      setActiveWorkspaceId(created.workspaceId);
      setName("");
      setHandle("");
      setHandleEdited(false);
      return `Created "${created.name}" and switched to it.`;
    });
  };

  const handleFork = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace) return;
    return run(async () => {
      const forked = await WorkspacesApi.forkWorkspace(
        activeWorkspace.workspaceId,
        {
          handle: forkHandle,
          visibility: activeWorkspace.visibility,
          includeChildren: true,
        },
      );
      await refreshWorkspaces();
      setActiveWorkspaceId(forked.workspaceId);
      setForkHandle("");
      return `Forked into "${forked.name}". You own the copy.`;
    });
  };

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId) return;
    if (!picked) {
      toast.info("Search for someone and pick them from the list first.");
      return;
    }
    const person = picked;
    return run(async () => {
      await WorkspacesApi.addMember(
        workspaceId,
        { userId: person.userId },
        memberRole,
      );
      setPicked(null);
      setMemberQuery("");
      setCandidates([]);
      await loadMembers();
      return `${personName(person)} was added as ${ROLE_LABELS[memberRole].toLowerCase()}.`;
    });
  };

  const changeRole = (member: WorkspaceMember, nextRole: WorkspaceRole) => {
    if (!workspaceId) return;
    return run(async () => {
      await WorkspacesApi.updateMemberRole(
        workspaceId,
        member.userId,
        nextRole,
      );
      await loadMembers();
      // Changing your own role changes what you can do in this workspace
      if (member.userId === me) await refreshWorkspaces();
      return `${labelFor(member)} is now ${ROLE_LABELS[nextRole].toLowerCase()}.`;
    });
  };

  const removeMember = (member: WorkspaceMember) => {
    if (!workspaceId || !activeWorkspace) return;
    const self = member.userId === me;
    const message = self
      ? `Leave "${activeWorkspace.name}"? You'll lose access unless someone adds you back.`
      : `Remove ${labelFor(member)} from "${activeWorkspace.name}"?`;
    if (!window.confirm(message)) return;

    return run(async () => {
      await WorkspacesApi.removeMember(workspaceId, member.userId);
      if (self) {
        await refreshWorkspaces();
        navigate("/");
        return "You left the workspace.";
      }
      await loadMembers();
      return `${labelFor(member)} was removed.`;
    });
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1>Members and workspaces</h1>
        <p>
          {activeWorkspace
            ? `Managing ${activeWorkspace.name}. Switch workspaces from the sidebar.`
            : "Create your first workspace to start saving entries."}
        </p>
      </div>

      {activeWorkspace && (
        <section className="settings-row">
          <div>
            <h2>Members</h2>
            <p className="hint">
              Owners manage members. QA reviewers approve suggested edits.
            </p>
          </div>

          <div className="form" style={{ gap: 18 }}>
            {isViewer ? (
              <p className="hint" style={{ marginTop: 0 }}>
                You're browsing a public library. Members are only visible to
                people in the workspace.
              </p>
            ) : membersLoading && members.length === 0 ? (
              <div
                className="skeleton"
                style={{ height: 64 }}
                aria-busy="true"
              />
            ) : members.length === 0 ? (
              <p className="hint" style={{ marginTop: 0 }}>
                No members to show.
              </p>
            ) : (
              <ul className="member-list">
                {members.map((m) => {
                  const self = m.userId === me;
                  return (
                    <li key={m.userId} className="member-row">
                      {m.profileUrl ? (
                        <img
                          className="mini-avatar member-avatar"
                          src={m.profileUrl}
                          alt=""
                        />
                      ) : (
                        <span className="mini-avatar member-avatar">
                          {initialsFor(m)}
                        </span>
                      )}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            alignItems: "center",
                            flexWrap: "wrap",
                          }}
                        >
                          <strong>{labelFor(m)}</strong>
                          {self && <span className="badge">You</span>}
                        </div>
                        <div className="hint" style={{ marginTop: 2 }}>
                          {[
                            m.username ? `@${m.username}` : null,
                            m.jobTitle,
                            m.email,
                          ]
                            .filter(Boolean)
                            .join(", ")}
                        </div>
                      </div>

                      {isOwner ? (
                        <select
                          aria-label={`Role for ${labelFor(m)}`}
                          style={{ width: "auto" }}
                          value={m.role}
                          onChange={(e) =>
                            changeRole(m, e.target.value as WorkspaceRole)
                          }
                        >
                          <option value="member">Member</option>
                          <option value="qa">QA reviewer</option>
                          <option value="owner">Owner</option>
                        </select>
                      ) : (
                        <span className="badge">{ROLE_LABELS[m.role]}</span>
                      )}

                      {(isOwner || self) && (
                        <button
                          className="btn btn-quiet btn-danger"
                          onClick={() => removeMember(m)}
                        >
                          {self ? "Leave" : "Remove"}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {isOwner && (
              <form
                onSubmit={handleAddMember}
                className="form"
                style={{ gap: 10 }}
              >
                <div>
                  <label className="label" htmlFor="memberQuery">
                    Add someone
                  </label>
                  {picked ? (
                    <div className="picked">
                      {picked.profileUrl ? (
                        <img
                          className="mini-avatar member-avatar"
                          src={picked.profileUrl}
                          alt=""
                        />
                      ) : (
                        <span className="mini-avatar member-avatar">
                          {personInitials(picked)}
                        </span>
                      )}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <strong>{personName(picked)}</strong>
                        <div className="hint" style={{ marginTop: 2 }}>
                          @{picked.username}
                          {picked.jobTitle ? `, ${picked.jobTitle}` : ""}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-quiet"
                        onClick={() => setPicked(null)}
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <div className="combo">
                      <input
                        id="memberQuery"
                        value={memberQuery}
                        onChange={(e) => setMemberQuery(e.target.value)}
                        placeholder="Search by name or username"
                        autoComplete="off"
                        aria-controls="candidate-list"
                      />
                      {memberQuery.trim().length >= 2 && (
                        <ul id="candidate-list" className="candidate-list">
                          {candidates.length > 0 ? (
                            candidates.map((c) => (
                              <li key={c.userId}>
                                <button
                                  type="button"
                                  className="candidate"
                                  onClick={() => {
                                    setPicked(c);
                                    setCandidates([]);
                                  }}
                                >
                                  {c.profileUrl ? (
                                    <img
                                      className="mini-avatar member-avatar"
                                      src={c.profileUrl}
                                      alt=""
                                    />
                                  ) : (
                                    <span className="mini-avatar member-avatar">
                                      {personInitials(c)}
                                    </span>
                                  )}
                                  <span style={{ minWidth: 0 }}>
                                    <strong>{personName(c)}</strong>
                                    <span
                                      className="hint"
                                      style={{ display: "block", marginTop: 0 }}
                                    >
                                      @{c.username}
                                      {c.jobTitle ? `, ${c.jobTitle}` : ""}
                                    </span>
                                  </span>
                                </button>
                              </li>
                            ))
                          ) : memberQuery.trim() !== debouncedQuery ||
                            searching ? (
                            <li className="candidate-note">Searching…</li>
                          ) : (
                            <li className="candidate-note">
                              No one found. Check the spelling, or they may
                              already be a member.
                            </li>
                          )}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 8,
                    alignItems: "end",
                  }}
                >
                  <div>
                    <label className="label" htmlFor="memberRole">
                      Role
                    </label>
                    <select
                      id="memberRole"
                      value={memberRole}
                      onChange={(e) =>
                        setMemberRole(e.target.value as WorkspaceRole)
                      }
                    >
                      <option value="member">Member</option>
                      <option value="qa">QA reviewer</option>
                      <option value="owner">Owner</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={!picked}
                  >
                    Add to workspace
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>
      )}

      {activeWorkspace && !isViewer && (
        <section className="settings-row">
          <div>
            <h2>Fork this workspace</h2>
            <p className="hint">
              Copy every entry and sub-workspace into a new workspace you own.
            </p>
          </div>
          <form className="form" onSubmit={handleFork}>
            <div>
              <label className="label" htmlFor="forkHandle">
                Handle for the copy
              </label>
              <input
                id="forkHandle"
                className="mono"
                value={forkHandle}
                onChange={(e) => setForkHandle(slugify(e.target.value))}
                placeholder="backend-fork"
                required
              />
              <p className="hint">Lowercase letters, numbers and hyphens.</p>
            </div>
            <button
              type="submit"
              className="btn"
              style={{ alignSelf: "flex-start" }}
            >
              Fork workspace
            </button>
          </form>
        </section>
      )}

      <section className="settings-row">
        <div>
          <h2>New workspace</h2>
          <p className="hint">
            Personal workspaces are for you. Team workspaces are shared.
          </p>
        </div>
        <form className="form" onSubmit={handleCreate}>
          <div className="grid-2">
            <div>
              <label className="label" htmlFor="wsName">
                Name
              </label>
              <input
                id="wsName"
                value={name}
                placeholder="Core utilities"
                required
                onChange={(e) => {
                  setName(e.target.value);
                  if (!handleEdited) setHandle(slugify(e.target.value));
                }}
              />
            </div>
            <div>
              <label className="label" htmlFor="wsHandle">
                Handle
              </label>
              <input
                id="wsHandle"
                className="mono"
                value={handle}
                placeholder="core-utils"
                required
                onChange={(e) => {
                  setHandleEdited(true);
                  setHandle(slugify(e.target.value));
                }}
              />
            </div>
          </div>
          <div className="grid-2">
            <div>
              <label className="label" htmlFor="wsType">
                Type
              </label>
              <select
                id="wsType"
                value={type}
                onChange={(e) => setType(e.target.value as "personal" | "team")}
              >
                <option value="team">Team</option>
                <option value="personal">Personal</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="wsVis">
                Who can read it
              </label>
              <select
                id="wsVis"
                value={visibility}
                onChange={(e) =>
                  setVisibility(e.target.value as "private" | "public")
                }
              >
                <option value="private">Members only</option>
                <option value="public">Anyone signed in</option>
              </select>
            </div>
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            style={{ alignSelf: "flex-start" }}
          >
            Create workspace
          </button>
        </form>
      </section>
    </div>
  );
};
