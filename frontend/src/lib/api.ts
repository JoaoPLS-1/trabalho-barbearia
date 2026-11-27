export class ApiError extends Error {
  constructor(
    message: string,
    public status = 0,
    public code?: string,
    public fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  empresaId?: number;
  signal?: AbortSignal;
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  timeoutMs?: number;
  idempotencyKey?: string;
}

const base = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(
  /\/+$/,
  '',
);

export async function api<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  let timedOut = false;
  if (options.signal?.aborted) controller.abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? 12000);
  try {
    const headers = new Headers({ Accept: 'application/json' });
    if (options.empresaId !== undefined)
      headers.set('x-empresa-id', String(options.empresaId));
    if (options.body !== undefined)
      headers.set('Content-Type', 'application/json');
    if (options.idempotencyKey)
      headers.set('Idempotency-Key', options.idempotencyKey);
    const response = await fetch(base + path, {
      method: options.method ?? 'GET',
      headers,
      signal: controller.signal,
      ...(options.body !== undefined
        ? { body: JSON.stringify(options.body) }
        : {}),
    });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const error = body as {
        message?: unknown;
        code?: unknown;
        fieldErrors?: unknown;
      } | null;
      throw new ApiError(
        typeof error?.message === 'string'
          ? error.message
          : 'Não foi possível concluir a consulta. Tente novamente.',
        response.status,
        typeof error?.code === 'string' ? error.code : undefined,
        readFieldErrors(error?.fieldErrors),
      );
    }
    if (body === null)
      throw new ApiError(
        'A resposta do serviço não pôde ser lida. Tente novamente.',
        502,
      );
    return body as T;
  } catch (error) {
    if (options.signal?.aborted) throw error;
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      timedOut
        ? 'O serviço demorou para responder. Tente novamente.'
        : 'Não foi possível conectar ao serviço. Verifique sua conexão e tente novamente.',
    );
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abort);
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Não foi possível carregar os dados.';
}

function readFieldErrors(value: unknown): Record<string, string[]> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return undefined;
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string[]] =>
        Array.isArray(entry[1]) &&
        entry[1].every((message: unknown) => typeof message === 'string'),
    ),
  );
}
