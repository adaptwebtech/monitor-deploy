import { defineStore } from "pinia";
import { ref } from "vue";
import { apiFetch } from "../lib/apiFetch";

interface ResolvedUser {
  name: string;
  profilePictureUrl: string | null;
}

export const useGithubUsersStore = defineStore("githubUsers", () => {
  const resolved = ref<Record<string, ResolvedUser | null | "pending">>({});

  async function resolveIds(ids: string[]) {
    const uncached = ids.filter((id) => id && !(id in resolved.value));
    if (!uncached.length) return;

    // mark pending immediately to deduplicate concurrent calls
    uncached.forEach((id) => {
      resolved.value[id] = "pending";
    });

    await Promise.all(
      uncached.map(async (id) => {
        try {
          const res = await apiFetch(
            `${window.config.API_URL}/users/by-github/${encodeURIComponent(id)}`,
          );
          if (res.ok) {
            resolved.value[id] = await res.json();
          } else {
            resolved.value[id] = null;
          }
        } catch {
          resolved.value[id] = null;
        }
      }),
    );
  }

  function getResolved(
    githubId: string | null | undefined,
  ): ResolvedUser | null {
    if (!githubId) return null;
    const val = resolved.value[githubId];
    if (!val || val === "pending") return null;
    return val;
  }

  return { resolved, resolveIds, getResolved };
});
