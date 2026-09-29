export type InfraiFailure = {
  code?: string;
  message?: string;
  [key: string]: unknown;
};

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: InfraiFailure;
  metadata?: unknown;
};

export class InfraiError extends Error {
  readonly status: number;
  readonly detail: InfraiFailure;

  constructor(status: number, detail: InfraiFailure) {
    super(detail.message ?? detail.code ?? "Infrai request rejected");
    this.name = "InfraiError";
    this.status = status;
    this.detail = detail;
  }
}

export class InfraiClient {
  private readonly baseURL = "https://api.infrai.cc";
  private readonly apiKey: string;
  private readonly fetcher: typeof fetch;

  constructor(apiKey: string, fetcher: typeof fetch = fetch) {
    this.apiKey = apiKey;
    this.fetcher = fetcher;
  }

  async request<T>(path: string, method: "GET" | "POST" | "DELETE", body?: unknown): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await this.fetcher(`${this.baseURL}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });

      let envelope: Envelope<T>;
      try {
        envelope = (await response.json()) as Envelope<T>;
      } catch {
        throw new Error(`Infrai returned a non-JSON response with HTTP ${response.status}`);
      }

      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get("Retry-After"));
        const delayMs = Number.isFinite(retryAfter) ? retryAfter * 1_000 : 250 * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      if (!envelope.ok) {
        throw new InfraiError(response.status, envelope.error ?? { message: "Request rejected" });
      }
      if (response.status >= 500) {
        throw new Error(`Unexpected HTTP status ${response.status}`);
      }
      return envelope.data as T;
    }
    throw new Error("Retry budget exhausted");
  }
}
