import { createServer } from "node:http";
import { InfraiClient, InfraiError } from "./infrai_client.js";
import { handleLeakedCourseKey, incidentInputSchema } from "./key_incident.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");

const client = new InfraiClient(apiKey);
const port = Number(process.env.PORT ?? 3000);

async function readJson(request: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const server = createServer(async (request, response) => {
  response.setHeader("Content-Type", "application/json");
  if (request.method !== "POST" || request.url !== "/incidents/key-leak") {
    response.writeHead(404).end(JSON.stringify({ error: "Route not found" }));
    return;
  }

  try {
    const input = incidentInputSchema.parse(await readJson(request));
    const result = await handleLeakedCourseKey(input, client);
    response.writeHead(200).end(JSON.stringify(result));
  } catch (error) {
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      response.writeHead(status).end(JSON.stringify({ error: error.detail }));
      return;
    }
    if (error instanceof Error && error.name === "ZodError") {
      response.writeHead(400).end(JSON.stringify({ error: "Invalid incident body" }));
      return;
    }
    response.writeHead(500).end(JSON.stringify({ error: "Incident processing failed" }));
  }
});

server.listen(port, () => console.log(`Course incident service listening on http://localhost:${port}`));
