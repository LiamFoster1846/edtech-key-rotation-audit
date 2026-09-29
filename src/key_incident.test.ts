import assert from "node:assert/strict";
import test from "node:test";
import { InfraiClient } from "./infrai_client.js";
import { handleLeakedCourseKey, selectIncidentLogs } from "./key_incident.js";

test("educator report includes only logs touching the leaked course key context", () => {
  const logs = [
    { key_id: "key-temp-42", action: "course.open", course_id: "algebra-204" },
    { learner_id: "learner-731", action: "deadline.read", deadline: "2026-10-02" },
    { educator_id: "educator-99", action: "report.read", course_id: "history-101" },
  ];

  const affected = selectIncidentLogs(logs, [
    "key-temp-42",
    "algebra-204",
    "learner-731",
    "educator-18",
  ]);

  assert.deepEqual(affected, [logs[0], logs[1]]);
});

test("temporary key is revoked when incident handling fails", async () => {
  const paths: string[] = [];
  const client = {
    async request(path: string): Promise<unknown> {
      paths.push(path);
      if (path === "/v1/account/keys/create") {
        return { id: "key-temp-42", key: "secret" };
      }
      if (path.includes("suspected_compromise")) {
        throw new Error("incident report failed");
      }
      return undefined;
    },
  } as unknown as InfraiClient;

  await assert.rejects(
    handleLeakedCourseKey(
      {
        courseId: "algebra-204",
        learnerId: "learner-731",
        educatorId: "educator-18",
        deadline: "2026-10-02T16:00:00.000Z",
        graceHours: 1,
      },
      client,
    ),
    /incident report failed/,
  );

  assert.equal(paths.at(-1), "/v1/account/keys/revoke/key-temp-42");
});
