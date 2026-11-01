/**
 * cloudkb core: a 10-tool core subset of the Amazon Bedrock knowledge
 * base MCP surface, implemented clean-room against the public Bedrock
 * Agent and Bedrock Agent Runtime REST API documentation.
 *
 * Two planes:
 * - Control plane, service "bedrock-agent", host
 *   bedrock-agent.<region>.amazonaws.com: knowledge bases, data
 *   sources and ingestion jobs.
 * - Data plane, service "bedrock-agent-runtime", host
 *   bedrock-agent-runtime.<region>.amazonaws.com: retrieve and
 *   retrieve-and-generate.
 *
 * Every tool shapes a documented REST request and hands it to an
 * injectable AwsExecutor. The default executor reads the region from
 * AWS_REGION (default us-east-1) and credentials from
 * AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY (/ AWS_SESSION_TOKEN).
 * Missing credentials are an error naming AWS_ACCESS_KEY_ID.
 *
 * HONEST GAP: SigV4 signing is NOT implemented in this rebuild. The
 * default executor delegates signing to an injectable signer hook;
 * when no signer is injected it throws
 * "SigV4 signing not configured: inject a signer/executor" rather
 * than sending an unsigned request. Tests therefore prove request
 * shaping with a fake executor, not live AWS behaviour.
 */
import type {
  AwsExecutor,
  AwsRequest,
  FetchFn,
  GetDataSourceOptions,
  GetIngestionJobOptions,
  GetKnowledgeBaseOptions,
  ListDataSourcesOptions,
  ListIngestionJobsOptions,
  ListKnowledgeBasesOptions,
  RetrieveAndGenerateOptions,
  RetrieveOptions,
  SignerFn,
  StartIngestionJobOptions,
  StopIngestionJobOptions,
} from "./types.js";

export const VERSION = "0.1.0";

export const CONTROL_SERVICE = "bedrock-agent";
export const DATA_SERVICE = "bedrock-agent-runtime";

export function regionFromEnv(
  env: Record<string, string | undefined> = process.env,
): string {
  const raw = env.AWS_REGION ?? env.AWS_DEFAULT_REGION;
  const region = typeof raw === "string" ? raw.trim() : "";
  return region || "us-east-1";
}

export function hostForService(service: string, region: string): string {
  return `${service}.${region}.amazonaws.com`;
}

const enc = encodeURIComponent;

function query(params: Record<string, string | number | undefined>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

function clean<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

/** Shape the documented REST request for a tool call. Pure function. */
export function shapeRequest(name: string, args: Record<string, unknown>): AwsRequest {
  switch (name) {
    case "list_knowledge_bases": {
      const o = args as unknown as ListKnowledgeBasesOptions;
      return {
        service: CONTROL_SERVICE, operation: "ListKnowledgeBases", method: "GET",
        path: `/knowledgebases${query({ maxResults: o.max_results, nextToken: o.next_token })}`,
      };
    }
    case "get_knowledge_base": {
      const o = args as unknown as GetKnowledgeBaseOptions;
      return {
        service: CONTROL_SERVICE, operation: "GetKnowledgeBase", method: "GET",
        path: `/knowledgebases/${enc(o.knowledge_base_id)}`,
      };
    }
    case "list_data_sources": {
      const o = args as unknown as ListDataSourcesOptions;
      return {
        service: CONTROL_SERVICE, operation: "ListDataSources", method: "GET",
        path: `/knowledgebases/${enc(o.knowledge_base_id)}/datasources${query({ maxResults: o.max_results, nextToken: o.next_token })}`,
      };
    }
    case "get_data_source": {
      const o = args as unknown as GetDataSourceOptions;
      return {
        service: CONTROL_SERVICE, operation: "GetDataSource", method: "GET",
        path: `/knowledgebases/${enc(o.knowledge_base_id)}/datasources/${enc(o.data_source_id)}`,
      };
    }
    case "list_ingestion_jobs": {
      const o = args as unknown as ListIngestionJobsOptions;
      return {
        service: CONTROL_SERVICE, operation: "ListIngestionJobs", method: "POST",
        path: `/knowledgebases/${enc(o.knowledge_base_id)}/datasources/${enc(o.data_source_id)}/ingestionjobs/list`,
        body: clean({ maxResults: o.max_results, nextToken: o.next_token }),
      };
    }
    case "get_ingestion_job": {
      const o = args as unknown as GetIngestionJobOptions;
      return {
        service: CONTROL_SERVICE, operation: "GetIngestionJob", method: "GET",
        path: `/knowledgebases/${enc(o.knowledge_base_id)}/datasources/${enc(o.data_source_id)}/ingestionjobs/${enc(o.ingestion_job_id)}`,
      };
    }
    case "start_ingestion_job": {
      const o = args as unknown as StartIngestionJobOptions;
      return {
        service: CONTROL_SERVICE, operation: "StartIngestionJob", method: "POST",
        path: `/knowledgebases/${enc(o.knowledge_base_id)}/datasources/${enc(o.data_source_id)}/ingestionjobs`,
        body: clean({ clientToken: o.client_token, description: o.description }),
      };
    }
    case "stop_ingestion_job": {
      const o = args as unknown as StopIngestionJobOptions;
      return {
        service: CONTROL_SERVICE, operation: "StopIngestionJob", method: "PUT",
        path: `/knowledgebases/${enc(o.knowledge_base_id)}/datasources/${enc(o.data_source_id)}/ingestionjobs/${enc(o.ingestion_job_id)}/stop`,
      };
    }
    case "retrieve": {
      const o = args as unknown as RetrieveOptions;
      return {
        service: DATA_SERVICE, operation: "Retrieve", method: "POST",
        path: `/knowledgebases/${enc(o.knowledge_base_id)}/retrieve`,
        body: {
          retrievalQuery: { text: o.query },
          retrievalConfiguration: {
            vectorSearchConfiguration: clean({ numberOfResults: o.max_results }),
          },
        },
      };
    }
    case "retrieve_and_generate": {
      const o = args as unknown as RetrieveAndGenerateOptions;
      return {
        service: DATA_SERVICE, operation: "RetrieveAndGenerate", method: "POST",
        path: `/retrieveAndGenerate`,
        body: clean({
          input: { text: o.query },
          sessionId: o.session_id,
          retrieveAndGenerateConfiguration: {
            type: "KNOWLEDGE_BASE",
            knowledgeBaseConfiguration: clean({
              knowledgeBaseId: o.knowledge_base_id,
              modelArn: o.model_arn,
            }),
          },
        }),
      };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

/** The default signer: signing is delegated, never faked. */
export const unconfiguredSigner: SignerFn = () => {
  throw new Error("SigV4 signing not configured: inject a signer/executor");
};

/**
 * Build the default executor from the environment. Credentials are
 * checked when a request executes (not at build time) so tools/list
 * works without them; a call without credentials fails fast naming
 * AWS_ACCESS_KEY_ID, and a call with credentials but no injected
 * signer surfaces the honest signing error.
 */
export function createDefaultExecutor(
  env: Record<string, string | undefined> = process.env,
  fetchFn: FetchFn = globalThis.fetch as unknown as FetchFn,
  signer: SignerFn = unconfiguredSigner,
): AwsExecutor {
  return {
    async execute(req: AwsRequest): Promise<unknown> {
      const accessKey = typeof env.AWS_ACCESS_KEY_ID === "string" ? env.AWS_ACCESS_KEY_ID.trim() : "";
      if (!accessKey) {
        throw new Error("AWS_ACCESS_KEY_ID environment variable is required");
      }
      const secretKey = typeof env.AWS_SECRET_ACCESS_KEY === "string" ? env.AWS_SECRET_ACCESS_KEY.trim() : "";
      if (!secretKey) {
        throw new Error("AWS_SECRET_ACCESS_KEY environment variable is required");
      }
      const region = regionFromEnv(env);
      const url = `https://${hostForService(req.service, region)}${req.path}`;
      const headers = signer({ ...req, url, region });
      const res = await fetchFn(url, {
        method: req.method,
        headers: { "Content-Type": "application/json", ...headers },
        body: req.body === undefined ? undefined : JSON.stringify(req.body),
      });
      const text = await res.text();
      if (!res.ok) {
        throw new Error(`Bedrock API error ${res.status}: ${text}`);
      }
      if (!text) return { status: res.status };
      try {
        return JSON.parse(text) as unknown;
      } catch {
        return text;
      }
    },
  };
}

export function executorFromEnv(
  env: Record<string, string | undefined> = process.env,
): AwsExecutor {
  return createDefaultExecutor(env);
}

/** Dispatch a tool call by name through an executor. */
export async function callTool(
  executor: AwsExecutor,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  return executor.execute(shapeRequest(name, args));
}
