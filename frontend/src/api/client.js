export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    if (status === 401 && typeof window !== "undefined") {
      window.dispatchEvent(new Event("orderup:session-expired"));
    }
  }
}

// URLs relativas preservam a mesma origem e o cookie HttpOnly da sessão.
// JSON é explícito para o backend não redirecionar chamadas de API ao login HTML.
export async function apiRequest(path, { json, ...options } = {}) {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    throw new Error("Use um caminho de API relativo à origem, começando com /.");
  }

  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (json !== undefined) headers.set("Content-Type", "application/json");

  const response = await fetch(path, {
    ...options,
    headers,
    credentials: "same-origin",
    cache: "no-store",
    ...(json !== undefined ? { body: JSON.stringify(json) } : {}),
  });

  // Compatibilidade com endpoints legados que ainda redirecionam ao login.
  if (response.redirected && new URL(response.url).pathname === "/login") {
    throw new ApiError("Entre na sua conta para continuar.", 401);
  }

  if (response.status === 204) return null;
  const isJson = response.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await response.json() : null;
  if (!response.ok) {
    const message = data?.error || data?.mensagem || data?.message;
    throw new ApiError(message || "Não foi possível concluir a solicitação.", response.status);
  }
  if (!isJson) throw new ApiError("O servidor retornou uma resposta inesperada.", 502);
  return data;
}
