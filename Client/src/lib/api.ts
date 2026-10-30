export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/${path}`, { ...options, headers: { "Content-Type": "application/json", ...options.headers } });
  const body = await response.json();
  if (!response.ok) throw new ApiError(Array.isArray(body.message) ? body.message.join(" ") : body.message || "Something went wrong. Please try again.", response.status);
  return body as T;
}
export const json = (method: string, data?: unknown): RequestInit => ({ method, ...(data !== undefined ? { body: JSON.stringify(data) } : {}) });
