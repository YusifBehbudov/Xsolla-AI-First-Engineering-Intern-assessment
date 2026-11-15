#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { reviewRepository } from "./core.js";
import { authorizeRequest, parsePolicyArgs } from "./policy.js";

// The human who starts the server decides what the AI client may do.
const policy = parsePolicyArgs(process.argv.slice(2));
// stdout carries the MCP protocol, so logs go to stderr.
console.error(
  `[inspector] allowed roots: ${policy.allowedRoots.join(", ")}; ` +
    `allowed validations: ${policy.allowedValidations.join(", ") || "none"}`,
);

const inputShape = {
  repo_path: z
    .string()
    .min(1)
    .describe("Path to the Git repository. Must be inside a root allowed by the server operator."),
  baseRef: z.string().min(1).optional().describe('Branch, tag or commit to compare HEAD against. Defaults to "main".'),
  validationCommands: z
    .array(z.string())
    .optional()
    .describe(
      policy.allowedValidations.length
        ? `Commands to run in the repository. Only these exact commands are allowed: ${policy.allowedValidations.join(" | ")}`
        : "Validation is disabled on this server.",
    ),
};
const inputSchema = z.object(inputShape);

const server = new McpServer({ name: "repository-inspector", version: "2.1.0" });

server.registerTool(
  "review_repository",
  {
    title: "Review repository",
    description:
      "Lists files changed between a base ref and HEAD in a local Git repository, optionally runs pre-approved validation commands, and returns a Markdown report.",
    inputSchema: inputShape,
  },
  // Parse again with the same schema the client sees, so a field-name mismatch fails loudly
  // instead of silently becoming undefined (the original bug: repo_path vs repoPath).
  async (rawInput: unknown) => {
    try {
      const input = inputSchema.parse(rawInput);
      const allowed = authorizeRequest(policy, input.repo_path, input.validationCommands ?? []);
      const report = await reviewRepository({
        repositoryPath: allowed.repositoryPath,
        baseRef: input.baseRef,
        validationCommands: allowed.validationCommands,
      });
      return { content: [{ type: "text" as const, text: report }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { isError: true, content: [{ type: "text" as const, text: `Error: ${message}` }] };
    }
  },
);

await server.connect(new StdioServerTransport());
