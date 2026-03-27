"use client";

import { useEffect, useState } from "react";
import { useAuthBootstrap } from "@/hooks/use-auth-bootstrap";
import { apiGet, apiPost } from "@/lib/client/api";

export function useProfileWorkspace() {
  const { session, setSession } = useAuthBootstrap();
  const [favorites, setFavorites] = useState([]);
  const [form, setForm] = useState({ currentPassword: "", newPassword: "" });
  const [message, setMessage] = useState("");

  async function loadFavorites() {
    const sessionData = await apiGet("/api/session", { user: null });
    setSession(sessionData.user || null);
    if (!sessionData.user) {
      setFavorites([]);
      return;
    }
    const data = await apiGet("/api/favorites", { items: [] });
    setFavorites(data.items || []);
  }

  useEffect(() => {
    loadFavorites();
  }, []);

  async function toggleFavorite(historyId) {
    await apiPost("/api/favorites/toggle", { historyId });
    loadFavorites();
  }

  async function changePassword() {
    try {
      await apiPost("/api/auth/change-password", form);
      setMessage("Đổi mật khẩu thành công.");
    } catch (error) {
      setMessage(error.message || "Không thể đổi mật khẩu.");
    }
  }

  return {
    session,
    favorites,
    form,
    message,
    actions: {
      loadFavorites,
      toggleFavorite,
      changePassword,
      setForm,
      setMessage
    }
  };
}
