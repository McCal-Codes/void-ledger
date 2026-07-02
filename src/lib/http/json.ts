type JsonErrorBody = {
  error?: unknown;
  message?: unknown;
};

type JsonReadOptions = {
  emptyMessage?: string;
  invalidMessage?: string;
};

type FetchJsonOptions = JsonReadOptions & {
  errorMessage?: string;
};

export async function readJsonResponse<T>(
  response: Response,
  {
    emptyMessage = "Response body was empty.",
    invalidMessage = "Response body was not valid JSON.",
  }: JsonReadOptions = {}
): Promise<T> {
  const text = await response.text();

  if (!text.trim()) {
    throw new Error(emptyMessage);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(invalidMessage);
  }
}

export async function readResponseError(response: Response, fallback: string): Promise<string> {
  try {
    const body = await readJsonResponse<JsonErrorBody>(response, {
      emptyMessage: fallback,
      invalidMessage: fallback,
    });
    return typeof body.error === "string"
      ? body.error
      : typeof body.message === "string"
        ? body.message
        : fallback;
  } catch {
    return fallback;
  }
}

export async function fetchJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
  {
    errorMessage,
    emptyMessage,
    invalidMessage,
  }: FetchJsonOptions = {}
): Promise<T> {
  const response = await fetch(input, init);

  if (!response.ok) {
    throw new Error(
      await readResponseError(
        response,
        errorMessage ?? `Request failed: ${response.status} ${response.statusText}`
      )
    );
  }

  return readJsonResponse<T>(response, { emptyMessage, invalidMessage });
}
