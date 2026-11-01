# cloudkb — BUILD REPORT

Original: aws-bedrock-kb → Rebuild: cloudkb
Tier C core subset. Local only, nothing pushed or published.

## Scope
10 tools shaping documented Amazon Bedrock REST requests through an
injectable AwsExecutor (`execute({service, operation, path, method,
body})`). Control plane (service bedrock-agent, host
bedrock-agent.<region>.amazonaws.com): list_knowledge_bases
(GET /knowledgebases, maxResults/nextToken query), get_knowledge_base
(GET /knowledgebases/{id}), list_data_sources
(GET /knowledgebases/{id}/datasources), get_data_source
(GET /knowledgebases/{id}/datasources/{id}), list_ingestion_jobs
(POST /knowledgebases/{id}/datasources/{id}/ingestionjobs/list),
get_ingestion_job (GET .../ingestionjobs/{id}), start_ingestion_job
(POST .../ingestionjobs, clientToken/description body),
stop_ingestion_job (PUT .../ingestionjobs/{id}/stop).
Data plane (service bedrock-agent-runtime, host
bedrock-agent-runtime.<region>.amazonaws.com): retrieve
(POST /knowledgebases/{id}/retrieve with retrievalQuery +
vectorSearchConfiguration.numberOfResults), retrieve_and_generate
(POST /retrieveAndGenerate with KNOWLEDGE_BASE configuration and
optional sessionId/modelArn).

Omitted groups (fixture `_source` lists them): knowledge base and
data source create/update/delete lifecycle and chunking
configuration, agents and aliases, flows, prompts, guardrails,
evaluation jobs, model invocation and session management, and all
write/destructive operations beyond ingestion job start/stop.

Ground truth: schemas and request shapes are docs-derived from the
public Bedrock Agent / Agent Runtime API documentation. Fixture:
harness/fixtures/aws-bedrock-kb-tools-original.json (labelled
core-subset).

Default executor: region from AWS_REGION (default us-east-1),
credentials from AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
(/ AWS_SESSION_TOKEN). Missing credentials fail naming
AWS_ACCESS_KEY_ID.

## Verified (foreground, from disk)
- Tools: 10/10 — parity.json identical_tools = 10 = total.
- Unit tests: 14/14 pass (fake AwsExecutor; service/operation/method/
  path/body shaping asserted for every tool, undefined-field dropping,
  region default and host pattern, missing-credentials errors,
  no-signer error, injected-signer fetch path).
- tsc: exit 0. dist/cli.js present; `node dist/cli.js --version`
  prints 0.1.0.
- Parity: harness/parity.py vs the fixture → PASS, parity_pct 100.0
  (parity-out/parity.json).
- Missing-env stdio check: tools/call retrieve with AWS_ACCESS_KEY_ID
  unset returned isError "AWS_ACCESS_KEY_ID environment variable is
  required". CLI check with credentials set but no signer returned
  "SigV4 signing not configured: inject a signer/executor" (exit 1).
- server.json description 65 chars (≤100); OCI entry has no version
  field; npm entry carries version 0.1.0; Dockerfile label
  io.github.CloudCorpRecords/cloudkb; full 19-file factory set
  present (node_modules is a symlink to the reference build for local
  build/test only).

## Honest gaps
- SigV4 signing is NOT implemented: signing is delegated to an
  injectable signer hook. With credentials but no signer, every call
  surfaces "SigV4 signing not configured: inject a signer/executor".
  No unsigned request is ever sent.
- No live AWS call was made — request shaping is fake-executor proven
  only.
- list_ingestion_jobs exposes only maxResults/nextToken; the API's
  filter/sort options are outside the subset.
- Lockfile is a copied fleet lockfile with identity fields edited —
  clean lockfile regeneration is REQUIRED before publish.
- mcpaudit / mcpvet / shipcheck not yet run — pre-publish gate.
