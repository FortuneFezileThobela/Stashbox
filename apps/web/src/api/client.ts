import axios from "axios";
import { friendlyError } from "../lib/friendlyError";
import { emitSessionCheck } from "../lib/session";
import { toast } from "../lib/toast";

export const TOKEN_STORAGE_KEY = "stashbox_session_token";
export const USER_STORAGE_KEY = "stashbox_user";

declare module "axios" {
  
  export interface AxiosRequestConfig<D = any> {
    silent?: boolean;
  }
}

export const apiClient = axios.create({
  baseURL: "/api/version1",
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const { message, code, status } = friendlyError(error);
    const url: string = error?.config?.url ?? "";
    const silent = Boolean(error?.config?.silent);

    // A 401 alone doesn't prove the session is dead. Ask the auth layer to double-check with /auth/me, the only thing allowed to sign the user out. Nothing stored is wiped because one request failed.
    if (
      status === 401 &&
      !url.includes("/auth/login") &&
      !url.includes("/auth/me")
    ) {
      emitSessionCheck();
    }

   
    if (!silent) toast.error(message);

    return Promise.reject(Object.assign(new Error(message), { code, status }));
  },
);
