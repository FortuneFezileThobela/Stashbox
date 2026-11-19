import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AuthApi, type AuthenticatedUser } from "../api/auth.api";
import { TOKEN_STORAGE_KEY, USER_STORAGE_KEY } from "../api/client";
import { onSessionCheck } from "../lib/session";

interface AuthContextType {
  user: AuthenticatedUser | null;
  loading: boolean;
  login: (user: AuthenticatedUser) => void;
  updateUser: (user: AuthenticatedUser) => void;
  refreshUser: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const hasToken = () => Boolean(localStorage.getItem(TOKEN_STORAGE_KEY));

const readCachedUser = (): AuthenticatedUser | null => {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthenticatedUser) : null;
  } catch {
    return null;
  }
};

const writeCachedUser = (user: AuthenticatedUser | null) => {
  try {
    if (user) localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_STORAGE_KEY);
  } catch {
    // Storage can be full or blocked; the app still works without the cache.
  }
};

// Who someone is can never be erased by a partial reply. Other fields (job title, bio, ...)
// may legitimately be cleared, so null is accepted for those.
const IDENTITY_FIELDS = ["id", "userId", "email", "username", "fullName"];

const idOf = (u: Partial<AuthenticatedUser>) => u.userId ?? u.id;

const mergeUser = (
  prev: AuthenticatedUser | null,
  next: AuthenticatedUser,
): AuthenticatedUser => {
  const nextId = idOf(next);
  // A reply naming a different user replaces the stored one. A reply with no id at all
  // (a trimmed response) is the same user: it only fills in what it actually has.
  if (!prev || (nextId && nextId !== idOf(prev))) return next;
  const cleaned: Record<string, unknown> = {};
  (Object.keys(next) as (keyof AuthenticatedUser)[]).forEach((key) => {
    const value = next[key];
    if (value === undefined || value === "") return;
    if (value === null && IDENTITY_FIELDS.includes(key)) return;
    cleaned[key] = value;
  });
  return { ...prev, ...cleaned } as AuthenticatedUser;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // Start from the cached profile so names are there on the very first paint.
  const [user, setUser] = useState<AuthenticatedUser | null>(() =>
    hasToken() ? readCachedUser() : null,
  );
  const [loading, setLoading] = useState<boolean>(
    () => hasToken() && !readCachedUser(),
  );
  const userRef = useRef(user);
  userRef.current = user;
  const inflight = useRef<Promise<void> | null>(null);

  const clear = useCallback(() => {
    writeCachedUser(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback((): Promise<void> => {
    if (!hasToken()) return Promise.resolve();
    if (inflight.current) return inflight.current;

    const run = (async () => {
      try {
        const me = await AuthApi.getMe();
        const merged = mergeUser(userRef.current, me);
        writeCachedUser(merged);
        setUser(merged);
      } catch (err: any) {
        if (err?.status === 401) {
          AuthApi.logout(); 
          clear();
        }
      } finally {
        inflight.current = null;
      }
    })();

    inflight.current = run;
    return run;
  }, [clear]);

  useEffect(() => {
    if (!hasToken()) {
      setLoading(false);
      return;
    }
    refreshUser().finally(() => setLoading(false));
  }, [refreshUser]);

  //instead of assuming it ended, verify the session.
  useEffect(() => onSessionCheck(() => void refreshUser()), [refreshUser]);

  const login = (authenticatedUser: AuthenticatedUser) => {
    writeCachedUser(authenticatedUser);
    setUser(authenticatedUser);
  };

  const updateUser = (updatedUser: AuthenticatedUser) => {
    const merged = mergeUser(userRef.current, updatedUser);
    writeCachedUser(merged);
    setUser(merged);
  };

  const logout = () => {
    AuthApi.logout();
    clear();
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, updateUser, refreshUser, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
