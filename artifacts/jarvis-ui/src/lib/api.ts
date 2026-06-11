const API_BASE =
    typeof window !== "undefined" && window.location.protocol === "file:"
      ? "http://127.0.0.1:8080"
      : "";

  export async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { "Content-Type": "application/json", ...opts?.headers },
      ...opts,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`API ${res.status}: ${text.slice(0, 80)}`);
    }
    return res.json() as Promise<T>;
  }
  