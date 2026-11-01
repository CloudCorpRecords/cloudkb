import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  callTool,
  createDefaultExecutor,
  hostForService,
  regionFromEnv,
  shapeRequest,
} from "../src/bedrock.js";
import type { AwsExecutor, AwsRequest, FetchFn } from "../src/types.js";

function fakeExecutor(payload: unknown = { ok: true }) {
  const calls: AwsRequest[] = [];
  const executor: AwsExecutor = {
    async execute(req) {
      calls.push(req);
      return payload;
    },
  };
  return { executor, calls };
}

describe("cloudkb core", () => {
  it("list_knowledge_bases shapes a control-plane GET with pagination query", async () => {
    const { executor, calls } = fakeExecutor();
    await callTool(executor, "list_knowledge_bases", { max_results: 5, next_token: "tok" });
    assert.deepEqual(calls[0], {
      service: "bedrock-agent", operation: "ListKnowledgeBases", method: "GET",
      path: "/knowledgebases?maxResults=5&nextToken=tok",
    });
    await callTool(executor, "list_knowledge_bases", {});
    assert.equal(calls[1].path, "/knowledgebases");
    assert.equal(calls[1].body, undefined);
  });

  it("get_knowledge_base shapes GET /knowledgebases/{id}", async () => {
    const { executor, calls } = fakeExecutor();
    await callTool(executor, "get_knowledge_base", { knowledge_base_id: "KB1" });
    assert.equal(calls[0].service, "bedrock-agent");
    assert.equal(calls[0].operation, "GetKnowledgeBase");
    assert.equal(calls[0].method, "GET");
    assert.equal(calls[0].path, "/knowledgebases/KB1");
  });

  it("list_data_sources and get_data_source shape datasource paths", async () => {
    const { executor, calls } = fakeExecutor();
    await callTool(executor, "list_data_sources", { knowledge_base_id: "KB1", max_results: 3 });
    assert.equal(calls[0].operation, "ListDataSources");
    assert.equal(calls[0].path, "/knowledgebases/KB1/datasources?maxResults=3");
    await callTool(executor, "get_data_source", { knowledge_base_id: "KB1", data_source_id: "DS1" });
    assert.equal(calls[1].operation, "GetDataSource");
    assert.equal(calls[1].method, "GET");
    assert.equal(calls[1].path, "/knowledgebases/KB1/datasources/DS1");
  });

  it("list_ingestion_jobs posts to the list path with a cleaned body", async () => {
    const { executor, calls } = fakeExecutor();
    await callTool(executor, "list_ingestion_jobs", {
      knowledge_base_id: "KB1", data_source_id: "DS1", max_results: 7,
    });
    assert.equal(calls[0].operation, "ListIngestionJobs");
    assert.equal(calls[0].method, "POST");
    assert.equal(calls[0].path, "/knowledgebases/KB1/datasources/DS1/ingestionjobs/list");
    assert.deepEqual(calls[0].body, { maxResults: 7 });
  });

  it("get_ingestion_job shapes GET on the job path", async () => {
    const { executor, calls } = fakeExecutor();
    await callTool(executor, "get_ingestion_job", {
      knowledge_base_id: "KB1", data_source_id: "DS1", ingestion_job_id: "J1",
    });
    assert.equal(calls[0].operation, "GetIngestionJob");
    assert.equal(calls[0].path, "/knowledgebases/KB1/datasources/DS1/ingestionjobs/J1");
  });

  it("start_ingestion_job posts clientToken and description only when given", async () => {
    const { executor, calls } = fakeExecutor();
    await callTool(executor, "start_ingestion_job", {
      knowledge_base_id: "KB1", data_source_id: "DS1", description: "nightly sync", client_token: "ct-1",
    });
    assert.equal(calls[0].operation, "StartIngestionJob");
    assert.equal(calls[0].method, "POST");
    assert.equal(calls[0].path, "/knowledgebases/KB1/datasources/DS1/ingestionjobs");
    assert.deepEqual(calls[0].body, { clientToken: "ct-1", description: "nightly sync" });
    await callTool(executor, "start_ingestion_job", { knowledge_base_id: "KB1", data_source_id: "DS1" });
    assert.deepEqual(calls[1].body, {});
  });

  it("stop_ingestion_job shapes a PUT to the stop path", async () => {
    const { executor, calls } = fakeExecutor();
    await callTool(executor, "stop_ingestion_job", {
      knowledge_base_id: "KB1", data_source_id: "DS1", ingestion_job_id: "J1",
    });
    assert.equal(calls[0].operation, "StopIngestionJob");
    assert.equal(calls[0].method, "PUT");
    assert.equal(calls[0].path, "/knowledgebases/KB1/datasources/DS1/ingestionjobs/J1/stop");
  });

  it("retrieve uses the data plane with the documented retrieval body", async () => {
    const { executor, calls } = fakeExecutor();
    await callTool(executor, "retrieve", { knowledge_base_id: "KB1", query: "refund policy", max_results: 4 });
    assert.equal(calls[0].service, "bedrock-agent-runtime");
    assert.equal(calls[0].operation, "Retrieve");
    assert.equal(calls[0].method, "POST");
    assert.equal(calls[0].path, "/knowledgebases/KB1/retrieve");
    assert.deepEqual(calls[0].body, {
      retrievalQuery: { text: "refund policy" },
      retrievalConfiguration: { vectorSearchConfiguration: { numberOfResults: 4 } },
    });
    await callTool(executor, "retrieve", { knowledge_base_id: "KB1", query: "q" });
    assert.deepEqual(calls[1].body, {
      retrievalQuery: { text: "q" },
      retrievalConfiguration: { vectorSearchConfiguration: {} },
    });
  });

  it("retrieve_and_generate posts the KNOWLEDGE_BASE configuration", async () => {
    const { executor, calls } = fakeExecutor();
    await callTool(executor, "retrieve_and_generate", {
      knowledge_base_id: "KB1", query: "summarise", model_arn: "arn:aws:bedrock:us-east-1::foundation-model/test", session_id: "s1",
    });
    assert.equal(calls[0].service, "bedrock-agent-runtime");
    assert.equal(calls[0].operation, "RetrieveAndGenerate");
    assert.equal(calls[0].path, "/retrieveAndGenerate");
    assert.deepEqual(calls[0].body, {
      input: { text: "summarise" },
      sessionId: "s1",
      retrieveAndGenerateConfiguration: {
        type: "KNOWLEDGE_BASE",
        knowledgeBaseConfiguration: {
          knowledgeBaseId: "KB1",
          modelArn: "arn:aws:bedrock:us-east-1::foundation-model/test",
        },
      },
    });
  });

  it("unknown tools are rejected before any execution", () => {
    assert.throws(() => shapeRequest("nope", {}), /Unknown tool: nope/);
  });

  it("region defaults to us-east-1 and hosts follow the service pattern", () => {
    assert.equal(regionFromEnv({}), "us-east-1");
    assert.equal(regionFromEnv({ AWS_REGION: " eu-west-1 " }), "eu-west-1");
    assert.equal(hostForService("bedrock-agent", "eu-west-1"), "bedrock-agent.eu-west-1.amazonaws.com");
    assert.equal(hostForService("bedrock-agent-runtime", "us-east-1"), "bedrock-agent-runtime.us-east-1.amazonaws.com");
  });

  it("default executor names AWS_ACCESS_KEY_ID when credentials are missing", async () => {
    const executor = createDefaultExecutor({});
    await assert.rejects(
      () => executor.execute({ service: "bedrock-agent", operation: "ListKnowledgeBases", path: "/knowledgebases", method: "GET" }),
      /AWS_ACCESS_KEY_ID environment variable is required/,
    );
    const noSecret = createDefaultExecutor({ AWS_ACCESS_KEY_ID: "AKID" });
    await assert.rejects(
      () => noSecret.execute({ service: "bedrock-agent", operation: "ListKnowledgeBases", path: "/knowledgebases", method: "GET" }),
      /AWS_SECRET_ACCESS_KEY environment variable is required/,
    );
  });

  it("default executor with credentials but no signer surfaces the honest signing error", async () => {
    const fetchFn: FetchFn = async () => {
      throw new Error("fetch must not be reached without a signer");
    };
    const executor = createDefaultExecutor(
      { AWS_ACCESS_KEY_ID: "AKID", AWS_SECRET_ACCESS_KEY: "secret", AWS_REGION: "us-east-1" },
      fetchFn,
    );
    await assert.rejects(
      () => executor.execute({ service: "bedrock-agent-runtime", operation: "Retrieve", path: "/knowledgebases/KB1/retrieve", method: "POST", body: {} }),
      /SigV4 signing not configured: inject a signer\/executor/,
    );
  });

  it("an injected signer lets the default executor reach fetch with shaped URL and headers", async () => {
    const seen: Array<{ url: string; method?: string; headers?: Record<string, string>; body?: string }> = [];
    const fetchFn: FetchFn = async (url, init) => {
      seen.push({ url, method: init?.method, headers: init?.headers, body: init?.body });
      return {
        ok: true, status: 200, headers: { get: () => null },
        text: async () => JSON.stringify({ knowledgeBaseSummaries: [] }),
      };
    };
    const executor = createDefaultExecutor(
      { AWS_ACCESS_KEY_ID: "AKID", AWS_SECRET_ACCESS_KEY: "secret", AWS_REGION: "eu-west-1" },
      fetchFn,
      () => ({ Authorization: "AWS4-HMAC-SHA256 test-signature" }),
    );
    const out = await executor.execute(shapeRequest("list_knowledge_bases", {}));
    assert.deepEqual(out, { knowledgeBaseSummaries: [] });
    assert.equal(seen[0].url, "https://bedrock-agent.eu-west-1.amazonaws.com/knowledgebases");
    assert.equal(seen[0].headers?.Authorization, "AWS4-HMAC-SHA256 test-signature");
  });
});
