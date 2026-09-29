import { randomUUID } from "node:crypto";
import { z } from "zod";
import { InfraiClient } from "./infrai_client.js";

export const incidentInputSchema = z.object({
  courseId: z.string().min(1),
  learnerId: z.string().min(1),
  educatorId: z.string().min(1),
  deadline: z.string().datetime(),
  graceHours: z.number().int().min(0).max(24).default(1),
});

export type IncidentInput = z.infer<typeof incidentInputSchema>;

type CreatedKey = { id: string; key: string };
type RotatedKey = { key?: string; [key: string]: unknown };
type LogSearch = { items?: unknown[]; logs?: unknown[]; [key: string]: unknown } | unknown[];

export type IncidentResult = {
  courseId: string;
  keyId: string;
  deadline: string;
  affectedLogCount: number;
  affectedLogs: unknown[];
  rotatedKeyMustBeStored: boolean;
  temporaryKeyRevoked: boolean;
};

export function selectIncidentLogs(logs: unknown[], needles: string[]): unknown[] {
  return logs.filter((entry) => {
    const serialized = JSON.stringify(entry);
    return needles.some((needle) => serialized.includes(needle));
  });
}

function logItems(search: LogSearch): unknown[] {
  if (Array.isArray(search)) return search;
  if (Array.isArray(search.items)) return search.items;
  if (Array.isArray(search.logs)) return search.logs;
  return [];
}

export async function handleLeakedCourseKey(
  input: IncidentInput,
  client: InfraiClient,
): Promise<IncidentResult> {
  const temporary = await client.request<CreatedKey>("/v1/account/keys/create", "POST", {
    name: `course-delivery-${input.courseId}`,
    scopes: ["course-delivery", "learner-deadlines", "educator-reporting"],
    idempotency_key: randomUUID(),
  });

  try {
    await client.request(`/v1/account/keys/suspected_compromise/${encodeURIComponent(temporary.id)}`, "POST", {
      confirmed_leak: true,
      auto_rotate: false,
    });

    const rotated = await client.request<RotatedKey>(
      `/v1/account/keys/rotate/${encodeURIComponent(temporary.id)}`,
      "POST",
      { grace_hours: input.graceHours, idempotency_key: randomUUID() },
    );

    const search = await client.request<LogSearch>("/v1/logs/search", "GET");
    const affectedLogs = selectIncidentLogs(logItems(search), [
      temporary.id,
      input.courseId,
      input.learnerId,
      input.educatorId,
    ]);

    return {
      courseId: input.courseId,
      keyId: temporary.id,
      deadline: input.deadline,
      affectedLogCount: affectedLogs.length,
      affectedLogs,
      rotatedKeyMustBeStored: typeof rotated.key === "string",
      temporaryKeyRevoked: true,
    };
  } finally {
    await client.request(
      `/v1/account/keys/revoke/${encodeURIComponent(temporary.id)}`,
      "DELETE",
    );
  }
}
