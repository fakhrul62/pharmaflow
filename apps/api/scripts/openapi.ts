import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import {
  schemas,
  operations,
  settingsSchema,
  resourceNames,
} from "../src/validation";
const schema = (value: any) =>
  z.toJSONSchema(value, { io: "input", unrepresentable: "any" });
const json = (s: any) => ({ "application/json": { schema: s } });
const response = {
  description: "Successful response",
  content: json({ type: "object", additionalProperties: true }),
};
const error = {
  description: "Validation, authentication or permission error",
  content: json({
    type: "object",
    properties: {
      message: {
        oneOf: [
          { type: "string" },
          { type: "array", items: { type: "string" } },
        ],
      },
      statusCode: { type: "integer" },
    },
  }),
};
const paths: Record<string, any> = {};
function operation(
  method: string,
  path: string,
  summary: string,
  body?: any,
  parameters?: any[],
) {
  paths[path] ??= {};
  paths[path][method] = {
    summary,
    tags: [
      path.includes("/auth/")
        ? "Authentication"
        : path.includes("/operations/")
          ? "Operations"
          : "Resources",
    ],
    ...(parameters ? { parameters } : {}),
    ...(body ? { requestBody: { required: true, content: json(body) } } : {}),
    responses: {
      "200": response,
      "201": response,
      "400": error,
      "401": error,
      "403": error,
      "409": error,
    },
  };
}
operation(
  "post",
  "/api/auth/login",
  "Create an HttpOnly cookie session",
  schema(z.object({ email: z.email(), password: z.string() })),
);
operation("get", "/api/auth/me", "Read the current account");
operation("post", "/api/auth/logout", "Revoke this session", {});
operation(
  "patch",
  "/api/auth/password",
  "Change password and revoke sessions",
  schema(
    z.object({ currentPassword: z.string(), newPassword: z.string().min(10) }),
  ),
);
operation(
  "get",
  "/api/bootstrap",
  "Get the complete authorized operational snapshot",
);
operation(
  "patch",
  "/api/settings",
  "Update settings (admin only)",
  schema(settingsSchema.partial()),
);
for (const r of resourceNames) {
  operation("get", `/api/resources/${r}`, `List ${r}`, undefined, [
    { name: "q", in: "query", schema: { type: "string" } },
    {
      name: "page",
      in: "query",
      schema: { type: "integer", minimum: 1, default: 1 },
    },
    {
      name: "limit",
      in: "query",
      schema: { type: "integer", minimum: 1, maximum: 200, default: 25 },
    },
  ]);
  if (schemas[r]) {
    operation(
      "post",
      `/api/resources/${r}`,
      `Create ${r} record`,
      schema(schemas[r]),
    );
    operation(
      "patch",
      `/api/resources/${r}/{id}`,
      `Update ${r} record`,
      schema(schemas[r].partial()),
      [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
    );
    operation(
      "delete",
      `/api/resources/${r}/{id}`,
      `Delete unlinked ${r} record`,
      undefined,
      [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
    );
  }
}
for (const [name, value] of Object.entries(operations))
  operation(
    "post",
    `/api/operations/${name}`,
    name.replaceAll("-", " "),
    schema(value),
  );
const document = {
  openapi: "3.1.0",
  info: {
    title: "PharmaFlow API",
    version: "1.0.0",
    description:
      "Integer minor currency units. All writes require an allowed Origin header and JSON content type. Resource write restrictions and transactional rules are documented in api-contract.md. Login first to obtain the session cookie; POST logout or changing password revokes it.",
  },
  servers: [
    {
      url: "http://localhost:5173",
      description: "Local same-origin web proxy",
    },
  ],
  security: [{ session: [] }],
  components: {
    securitySchemes: {
      session: { type: "apiKey", in: "cookie", name: "pharmaflow_session" },
    },
  },
  paths,
};
const destination = resolve("../../docs/openapi.json");
mkdirSync(resolve("../../docs"), { recursive: true });
writeFileSync(destination, JSON.stringify(document, null, 2) + "\n");
console.log(
  "Generated docs/openapi.json (import into Swagger Editor or an OpenAPI client).",
);
