// A request came back 401. On its own that doesn't prove the session is dead (a server route
// may simply have forgotten to pass the user along), so the auth layer double-checks with
// /auth/me before anyone is signed out. The API client never wipes stored data by itself.


//a 404 on its own doesn't prove the session is dead (a server route may simply have forgotten to pass the user along), so the auth layer double-checks with /auth/me before anyone is signed out
let handler: (() => void) | null = null;

export const onSessionCheck = (fn: () => void) => {
  handler = fn;
  return () => {
    if (handler === fn) handler = null;
  };
};

export const emitSessionCheck = () => handler?.();
