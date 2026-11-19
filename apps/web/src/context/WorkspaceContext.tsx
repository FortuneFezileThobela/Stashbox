import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { WorkspacesApi } from "../api/workspaces.api";
import type { Workspace } from "../types/stashbox";

interface WorkspaceContextType {
  /** Workspaces the user belongs to. Each has role owner, qa or member. */
  workspaces: Workspace[];
  /** Public libraries the user has opened recently (read-only). Find more on the Browse page. */
  publicWorkspaces: Workspace[];
  activeWorkspace: Workspace | null;
  isReadOnlyPublicView: boolean;
  setActiveWorkspaceId: (id: string) => void;
  /** Opens a public library the user doesn't belong to, read-only, and remembers it */
  openPublicWorkspace: (workspace: Workspace) => void;
  stackFilter: string;
  setStackFilter: (lang: string) => void;
  refreshWorkspaces: () => Promise<void>;
  loading: boolean;
}

const ACTIVE_KEY = "stashbox_active_workspace";
const RECENT_PUBLIC_KEY = "stashbox_recent_public";
const MAX_RECENT_PUBLIC = 8;

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(
  undefined,
);

const readActiveId = () => {
  try {
    return localStorage.getItem(ACTIVE_KEY) || "";
  } catch {
    return "";
  }
};

const readRecentPublic = (): Workspace[] => {
  try {
    const raw = localStorage.getItem(RECENT_PUBLIC_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? (list as Workspace[]) : [];
  } catch {
    return [];
  }
};

const writeRecentPublic = (list: Workspace[]) => {
  try {
    localStorage.setItem(RECENT_PUBLIC_KEY, JSON.stringify(list));
  } catch {
    //fetching the recent public workspaces is not a requirement hence no need to throw an error if it fails to write to local storage.
  }
};

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [recentPublic, setRecentPublic] =
    useState<Workspace[]>(readRecentPublic);
  const [activeWorkspaceId, setActiveId] = useState<string>(readActiveId);
  const [stackFilter, setStackFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const recentRef = useRef(recentPublic);
  recentRef.current = recentPublic;

  // switching workspaces must not trigger a refetch.
  const refreshWorkspaces = useCallback(async () => {
    setLoading(true);
    try {
      const mine = await WorkspacesApi.listWorkspaces();
      setWorkspaces(mine.workspaces);
    } catch {
      
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshWorkspaces();
  }, [refreshWorkspaces]);

  const setActiveWorkspaceId = useCallback((id: string) => {
    setActiveId(id);
    try {
      localStorage.setItem(ACTIVE_KEY, id);
    } catch {
      // Remembering the last workspace is a nicety, not a requirement.
    }
  }, []);

  const openPublicWorkspace = useCallback(
    (workspace: Workspace) => {
      const asViewer: Workspace = { ...workspace, role: "viewer" };
      const next = [
        asViewer,
        ...recentRef.current.filter(
          (w) => w.workspaceId !== workspace.workspaceId,
        ),
      ].slice(0, MAX_RECENT_PUBLIC);
      writeRecentPublic(next);
      setRecentPublic(next);
      setActiveWorkspaceId(workspace.workspaceId);
    },
    [setActiveWorkspaceId],
  );

  // Anything the user has since joined is theirs, not a public library
  const mineIds = new Set(workspaces.map((w) => w.workspaceId));
  const publicWorkspaces = recentPublic.filter(
    (w) => !mineIds.has(w.workspaceId),
  );

  const activeWorkspace =
    [...workspaces, ...publicWorkspaces].find(
      (w) => w.workspaceId === activeWorkspaceId,
    ) ||
    workspaces[0] ||
    null;

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        publicWorkspaces,
        activeWorkspace,
        isReadOnlyPublicView: activeWorkspace?.role === "viewer",
        setActiveWorkspaceId,
        openPublicWorkspace,
        stackFilter,
        setStackFilter,
        refreshWorkspaces,
        loading,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => {
  const ctx = useContext(WorkspaceContext);
  if (!ctx)
    throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return ctx;
};
