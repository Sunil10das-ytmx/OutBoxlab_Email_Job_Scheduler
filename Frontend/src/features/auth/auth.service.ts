import { api } from "../../services/api";
import type { User } from "../../types/user";

export const authService = {
  googleLogin: (idToken: string) =>
    api.post<{ success: boolean; token: string; user: User }>(
      "/api/auth/google",
      { idToken, credential: idToken }
    ),

  me: () => api.get<{ success: boolean; user: User }>("/api/auth/me"),

  logout: () => api.post("/api/auth/logout"),
};
