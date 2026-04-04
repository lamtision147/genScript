function tryParseJson(response) {
  return response
    .json()
    .catch(() => null);
}

export async function apiGet(url, fallback = null) {
  try {
    const response = await fetch(url, {
      credentials: "include",
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache"
      }
    });
    const data = await tryParseJson(response);
    if (!response.ok) {
      const message = data?.error || `Request failed (${response.status})`;
      throw new Error(message);
    }
    if (data === null) {
      throw new Error("Invalid JSON response");
    }
    return data;
  } catch (error) {
    if (fallback !== null) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[apiGet] fallback for ${url}:`, error?.message || error);
      }
      return fallback;
    }
    throw error;
  }
}

export async function apiPost(url, body) {
  const response = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await tryParseJson(response);
  if (!response.ok) {
    throw new Error(data?.error || `Request failed (${response.status})`);
  }
  if (data === null) {
    throw new Error("Invalid JSON response");
  }
  return data;
}
