import { useAuthStore } from "../stores/auth.store";
import router from "../router";

function isExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp * 1000 < Date.now() + 10_000;
  } catch {
    return true;
  }
}

export async function apiFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const auth = useAuthStore();

  if (auth.accessToken && isExpired(auth.accessToken)) {
    try {
      await auth.refresh();
    } catch {
      auth.logout();
      router.push({ name: "login" });
      throw new Error("Session expired");
    }
  }

  const headers = new Headers(options.headers);
  if (auth.accessToken) {
    headers.set("Authorization", `Bearer ${auth.accessToken}`);
  }

  return fetch(url, { ...options, headers });
}
