/**
 * cloudkb MCP server. Core subset: 10 tools.
 *
 * Low-level Server API with explicit inputSchema literals (the
 * McpServer+zod path injects $schema/additionalProperties and breaks
 * parity). Zod still validates call args. The literals match the
 * labelled core-subset fixture exactly.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { callTool, executorFromEnv, VERSION } from "./bedrock.js";

const ARG_SCHEMAS: Record<string, z.ZodTypeAny> = {
  list_knowledge_bases: z.object({
    max_results: z.number().optional(),
    next_token: z.string().optional(),
  }),
  get_knowledge_base: z.object({ knowledge_base_id: z.string() }),
  list_data_sources: z.object({
    knowledge_base_id: z.string(),
    max_results: z.number().optional(),
    next_token: z.string().optional(),
  }),
  get_data_source: z.object({
    knowledge_base_id: z.string(),
    data_source_id: z.string(),
  }),
  list_ingestion_jobs: z.object({
    knowledge_base_id: z.string(),
    data_source_id: z.string(),
    max_results: z.number().optional(),
    next_token: z.string().optional(),
  }),
  get_ingestion_job: z.object({
    knowledge_base_id: z.string(),
    data_source_id: z.string(),
    ingestion_job_id: z.string(),
  }),
  start_ingestion_job: z.object({
    knowledge_base_id: z.string(),
    data_source_id: z.string(),
    description: z.string().optional(),
    client_token: z.string().optional(),
  }),
  stop_ingestion_job: z.object({
    knowledge_base_id: z.string(),
    data_source_id: z.string(),
    ingestion_job_id: z.string(),
  }),
  retrieve: z.object({
    knowledge_base_id: z.string(),
    query: z.string(),
    max_results: z.number().optional(),
  }),
  retrieve_and_generate: z.object({
    knowledge_base_id: z.string(),
    query: z.string(),
    session_id: z.string().optional(),
    model_arn: z.string().optional(),
  }),
};

export const TOOLS = [
  {
    name: "list_knowledge_bases",
    description: "List Amazon Bedrock knowledge bases in the account.",
    inputSchema: {
      type: "object" as const,
      properties: {
        max_results: { type: "number", description: "Maximum number of knowledge bases to return in one page." },
        next_token: { type: "string", description: "Pagination token returned by a previous list call to fetch the next page." },
      },
      required: [] as string[],
    },
  },
  {
    name: "get_knowledge_base",
    description: "Retrieve a Bedrock knowledge base by its ID.",
    inputSchema: {
      type: "object" as const,
      properties: { knowledge_base_id: { type: "string", description: "The unique identifier of the Bedrock knowledge base to retrieve." } },
      required: ["knowledge_base_id"],
    },
  },
  {
    name: "list_data_sources",
    description: "List the data sources of a Bedrock knowledge base.",
    inputSchema: {
      type: "object" as const,
      properties: {
        knowledge_base_id: { type: "string", description: "The unique identifier of the knowledge base whose data sources to list." },
        max_results: { type: "number", description: "Maximum number of data sources to return in one page." },
        next_token: { type: "string", description: "Pagination token returned by a previous list call to fetch the next page." },
      },
      required: ["knowledge_base_id"],
    },
  },
  {
    name: "get_data_source",
    description: "Retrieve a data source of a Bedrock knowledge base.",
    inputSchema: {
      type: "object" as const,
      properties: {
        knowledge_base_id: { type: "string", description: "The unique identifier of the knowledge base that owns the data source." },
        data_source_id: { type: "string", description: "The unique identifier of the data source to retrieve." },
      },
      required: ["knowledge_base_id", "data_source_id"],
    },
  },
  {
    name: "list_ingestion_jobs",
    description: "List ingestion jobs for a knowledge base data source.",
    inputSchema: {
      type: "object" as const,
      properties: {
        knowledge_base_id: { type: "string", description: "The unique identifier of the knowledge base that owns the data source." },
        data_source_id: { type: "string", description: "The unique identifier of the data source whose ingestion jobs to list." },
        max_results: { type: "number", description: "Maximum number of ingestion jobs to return in one page." },
        next_token: { type: "string", description: "Pagination token returned by a previous list call to fetch the next page." },
      },
      required: ["knowledge_base_id", "data_source_id"],
    },
  },
  {
    name: "get_ingestion_job",
    description: "Retrieve an ingestion job for a knowledge base data source.",
    inputSchema: {
      type: "object" as const,
      properties: {
        knowledge_base_id: { type: "string", description: "The unique identifier of the knowledge base that owns the data source." },
        data_source_id: { type: "string", description: "The unique identifier of the data source that owns the ingestion job." },
        ingestion_job_id: { type: "string", description: "The unique identifier of the ingestion job to retrieve." },
      },
      required: ["knowledge_base_id", "data_source_id", "ingestion_job_id"],
    },
  },
  {
    name: "start_ingestion_job",
    description: "Start an ingestion job for a knowledge base data source.",
    inputSchema: {
      type: "object" as const,
      properties: {
        knowledge_base_id: { type: "string", description: "The unique identifier of the knowledge base that owns the data source." },
        data_source_id: { type: "string", description: "The unique identifier of the data source to ingest." },
        description: { type: "string", description: "A description for the ingestion job being started." },
        client_token: { type: "string", description: "A unique, case-sensitive identifier to ensure the request completes only once." },
      },
      required: ["knowledge_base_id", "data_source_id"],
    },
  },
  {
    name: "stop_ingestion_job",
    description: "Stop a running ingestion job for a knowledge base data source.",
    inputSchema: {
      type: "object" as const,
      properties: {
        knowledge_base_id: { type: "string", description: "The unique identifier of the knowledge base that owns the data source." },
        data_source_id: { type: "string", description: "The unique identifier of the data source that owns the ingestion job." },
        ingestion_job_id: { type: "string", description: "The unique identifier of the ingestion job to stop." },
      },
      required: ["knowledge_base_id", "data_source_id", "ingestion_job_id"],
    },
  },
  {
    name: "retrieve",
    description: "Retrieve passages from a knowledge base for a query.",
    inputSchema: {
      type: "object" as const,
      properties: {
        knowledge_base_id: { type: "string", description: "The unique identifier of the knowledge base to query." },
        query: { type: "string", description: "The query text to retrieve relevant passages for." },
        max_results: { type: "number", description: "Maximum number of results to retrieve from the knowledge base." },
      },
      required: ["knowledge_base_id", "query"],
    },
  },
  {
    name: "retrieve_and_generate",
    description: "Retrieve from a knowledge base and generate an answer.",
    inputSchema: {
      type: "object" as const,
      properties: {
        knowledge_base_id: { type: "string", description: "The unique identifier of the knowledge base to query." },
        query: { type: "string", description: "The input text to retrieve for and generate an answer to." },
        session_id: { type: "string", description: "The session identifier to reuse for a multi-turn retrieve-and-generate conversation." },
        model_arn: { type: "string", description: "The ARN of the foundation model used to generate the answer." },
      },
      required: ["knowledge_base_id", "query"],
    },
  },
];

function textResult(value: unknown) {
  return {
    content: [{
      type: "text" as const,
      text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
    }],
  };
}
function errorResult(err: unknown) {
  return {
    content: [{
      type: "text" as const,
      text: err instanceof Error ? err.message : String(err),
    }],
    isError: true,
  };
}

const server = new Server(
  { name: "cloudkb", version: VERSION },
  { capabilities: { tools: {} } },
);
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const schema = ARG_SCHEMAS[name];
  if (!schema) throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
  try {
    const parsed = schema.parse(args ?? {}) as Record<string, unknown>;
    return textResult(await callTool(executorFromEnv(), name, parsed));
  } catch (err) {
    return errorResult(err);
  }
});

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
}
void main();
