/**
 * cloudkb types.
 *
 * A core subset of the Amazon Bedrock knowledge base MCP surface:
 * knowledge bases, data sources, ingestion jobs and retrieval against
 * the Bedrock Agent (control plane) and Bedrock Agent Runtime (data
 * plane) REST APIs. AWS access is described by an injectable executor
 * interface so request shaping is fully testable offline.
 */

export interface HttpResponse {
  ok: boolean;
  status: number;
  statusText?: string;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}

export type FetchFn = (
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    redirect?: string;
  },
) => Promise<HttpResponse>;

/** One shaped AWS REST request, handed to an AwsExecutor. */
export interface AwsRequest {
  /** "bedrock-agent" (control plane) or "bedrock-agent-runtime" (data plane). */
  service: string;
  /** The documented API operation name, e.g. "Retrieve". */
  operation: string;
  /** REST path, already populated with resource IDs and query string. */
  path: string;
  method: string;
  body?: unknown;
}

/** Executes a shaped AWS request and returns the parsed response. */
export interface AwsExecutor {
  execute(req: AwsRequest): Promise<unknown>;
}

/** Returns SigV4 (or other) headers for a request, or throws. */
export type SignerFn = (req: AwsRequest & { url: string; region: string }) => Record<string, string>;

export interface ListKnowledgeBasesOptions {
  max_results?: number;
  next_token?: string;
}

export interface GetKnowledgeBaseOptions {
  knowledge_base_id: string;
}

export interface ListDataSourcesOptions {
  knowledge_base_id: string;
  max_results?: number;
  next_token?: string;
}

export interface GetDataSourceOptions {
  knowledge_base_id: string;
  data_source_id: string;
}

export interface ListIngestionJobsOptions {
  knowledge_base_id: string;
  data_source_id: string;
  max_results?: number;
  next_token?: string;
}

export interface GetIngestionJobOptions {
  knowledge_base_id: string;
  data_source_id: string;
  ingestion_job_id: string;
}

export interface StartIngestionJobOptions {
  knowledge_base_id: string;
  data_source_id: string;
  description?: string;
  client_token?: string;
}

export interface StopIngestionJobOptions {
  knowledge_base_id: string;
  data_source_id: string;
  ingestion_job_id: string;
}

export interface RetrieveOptions {
  knowledge_base_id: string;
  query: string;
  max_results?: number;
}

export interface RetrieveAndGenerateOptions {
  knowledge_base_id: string;
  query: string;
  session_id?: string;
  model_arn?: string;
}
