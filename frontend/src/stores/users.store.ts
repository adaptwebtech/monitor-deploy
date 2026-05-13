import { defineStore } from "pinia";
import { ref } from "vue";
import type { User } from "../types";

export const useUsersStore = defineStore("users", () => {
  const users = ref<User[]>([]);
  const total = ref(0);
  const page = ref(1);
  const limit = ref(10);
  const loading = ref(false);
  const error = ref<string | null>(null);

  function getHeaders() {
    const token = localStorage.getItem("accessToken");
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }

  async function fetchUsers(
    params: {
      search?: string;
      del?: string;
      page?: number;
      limit?: number;
    } = {},
  ) {
    loading.value = true;
    error.value = null;
    try {
      const q = new URLSearchParams();
      if (params.search !== undefined && params.search !== "")
        q.set("search", params.search);
      if (params.del !== undefined) q.set("del", params.del);
      if (params.page !== undefined) q.set("page", String(params.page));
      if (params.limit !== undefined) q.set("limit", String(params.limit));
      const res = await fetch(`${window.config.API_URL}/users?${q}`, {
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      users.value = data.data;
      total.value = data.total;
      if (data.page !== undefined) page.value = data.page;
      if (data.limit !== undefined) limit.value = data.limit;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Error";
    } finally {
      loading.value = false;
    }
  }

  async function updateUser(id: string, data: Partial<User>) {
    const res = await fetch(`${window.config.API_URL}/users/${id}`, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const updated = await res.json();
    const idx = users.value.findIndex((u) => u.id === id);
    if (idx !== -1) users.value[idx] = updated;
    return updated;
  }

  async function deleteUser(id: string) {
    const res = await fetch(`${window.config.API_URL}/users/${id}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const idx = users.value.findIndex((u) => u.id === id);
    if (idx !== -1) users.value[idx] = { ...users.value[idx], del: true };
  }

  async function regenerateToken(id: string) {
    const res = await fetch(
      `${window.config.API_URL}/users/${id}/regenerate-token`,
      {
        method: "POST",
        headers: getHeaders(),
      },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  return {
    users,
    total,
    page,
    limit,
    loading,
    error,
    fetchUsers,
    updateUser,
    deleteUser,
    regenerateToken,
  };
});
