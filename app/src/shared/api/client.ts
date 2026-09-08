import { ApiError } from "./errors";

export interface ListEnvelope<TItem> {
  readonly count: number;
  readonly items: TItem[];
}

export interface ItemEnvelope<TItem> {
  readonly item: TItem;
}

export interface StatusEnvelope {
  readonly status: string;
}

export interface ApiRequestOptions<TBody = unknown> {
  readonly body?: TBody;
  readonly headers?: HeadersInit;
  readonly method?: "DELETE" | "GET" | "PATCH" | "POST" | "PUT";
  readonly path: string;
  readonly signal?: AbortSignal;
}

const apiOrigin = (
  import.meta.env.VITE_API_BASE_URL ??
  import.meta.env.VITE_API_ORIGIN ??
  ""
).replace(/\/$/u, "");

export async function apiRequest<TResponse, TBody = unknown>(
  options: ApiRequestOptions<TBody>,
): Promise<TResponse> {
  const headers = new Headers(options.headers);

  if (options.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(buildApiUrl(options.path), {
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    headers,
    method: options.method ?? "GET",
    signal: options.signal,
  });

  const payload = await readPayload(response);

  if (!response.ok) {
    const message =
      readErrorMessage(payload) ?? (response.statusText || "Request failed.");
    throw new ApiError(message, response.status, payload);
  }

  return payload as TResponse;
}

export function buildApiUrl(path: string): string {
  if (/^https?:\/\//u.test(path)) {
    return path;
  }

  return `${apiOrigin}${path}`;
}

async function readPayload(response: Response): Promise<unknown> {
  const rawText = await response.text();
  if (rawText.trim() === "") {
    return null;
  }

  const contentType = response.headers.get("Content-Type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(rawText) as unknown;
    } catch {
      return rawText;
    }
  }

  try {
    return JSON.parse(rawText) as unknown;
  } catch {
    return rawText;
  }
}

function readErrorMessage(payload: unknown): string | null {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error;
  }

  if (typeof payload === "string" && payload.trim() !== "") {
    return payload;
  }

  return null;
}
