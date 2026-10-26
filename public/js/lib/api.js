// Same-origin JSON API client. Sends the CSRF token on every state-changing request and refreshes it
// once if the server says it expired.

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.message || `Request failed (${status})`);
    this.status = status;
    this.code = body?.error;
    this.fields = body?.fields ?? null;
  }
}

function readCsrfCookie() {
  const entry = document.cookie.split("; ").find((c) => c.startsWith("fl_csrf="));
  return entry ? decodeURIComponent(entry.slice("fl_csrf=".length)) : null;
}

async function refreshCsrf() {
  await fetch("/api/auth/csrf", { credentials: "same-origin", headers: { Accept: "application/json" } });
}

export async function api(path, { method = "GET", body, query, retry = true } = {}) {
  let url = `/api${path}`;
  if (query) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
    }
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }

  const headers = { Accept: "application/json" };
  if (method !== "GET") {
    if (!readCsrfCookie()) await refreshCsrf();
    headers["X-CSRF-Token"] = readCsrfCookie() ?? "";
    if (body !== undefined) headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    method,
    headers,
    credentials: "same-origin",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => null);

  if (response.status === 403 && data?.error === "csrf" && retry) {
    await refreshCsrf();
    return api(path, { method, body, query, retry: false });
  }
  if (!response.ok) throw new ApiError(response.status, data);
  return data;
}
