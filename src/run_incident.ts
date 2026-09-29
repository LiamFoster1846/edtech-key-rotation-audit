import { InfraiClient } from "./infrai_client.js";
import { handleLeakedCourseKey } from "./key_incident.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before running the incident");

const result = await handleLeakedCourseKey(
  {
    courseId: "algebra-204",
    learnerId: "learner-731",
    educatorId: "educator-18",
    deadline: "2026-10-02T16:00:00.000Z",
    graceHours: 1,
  },
  new InfraiClient(apiKey),
);

console.log(JSON.stringify(result, null, 2));
