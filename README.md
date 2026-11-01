# cloudkb

Amazon Bedrock knowledge bases as MCP tools. cloudkb is a clean-room
rebuild of the core surface of the AWS Bedrock knowledge base MCP
server, under a new name: the same tool names and documented REST
request shapes, fresh code, no copied branding.

## Tools (core subset, 10)

`list_knowledge_bases`, `get_knowledge_base`, `list_data_sources`,
`get_data_source`, `list_ingestion_jobs`, `get_ingestion_job`,
`start_ingestion_job`, `stop_ingestion_job`, `retrieve`,
`retrieve_and_generate`.

The first eight tools shape Bedrock Agent (control plane) requests;
`retrieve` and `retrieve_and_generate` shape Bedrock Agent Runtime
(data plane) requests. Request shaping is real and unit-tested; every
call goes through an injectable executor interface.

Not in this subset: knowledge base and data source create, update and
delete lifecycle, chunking configuration, agents and aliases, flows,
prompts, guardrails, evaluation jobs, model invocation and sessions.

## Setup

```bash
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
export AWS_REGION=us-east-1   # optional, this is the default
```

Without credentials, every tool call fails with an error naming
`AWS_ACCESS_KEY_ID`.

**Signing gap, stated plainly:** SigV4 signing is not implemented in
this rebuild. Signing is delegated to an injectable signer/executor
hook; with credentials present but no signer injected, a call fails
with `SigV4 signing not configured: inject a signer/executor` instead
of sending an unsigned request.

## CLI

```bash
npx @reneturcios/cloudkb list_knowledge_bases '{}'
npx @reneturcios/cloudkb retrieve '{"knowledge_base_id":"KB1","query":"refund policy"}'
npx @reneturcios/cloudkb mcp        # stdio MCP server
```

Each tool name is a subcommand taking one JSON object argument.

## MCP client config

```json
{
  "mcpServers": {
    "cloudkb": {
      "command": "npx",
      "args": ["-y", "@reneturcios/cloudkb", "mcp"],
      "env": { "AWS_ACCESS_KEY_ID": "...", "AWS_SECRET_ACCESS_KEY": "...", "AWS_REGION": "us-east-1" }
    }
  }
}
```

## Docker

```bash
docker run -i -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY ghcr.io/cloudcorprecords/cloudkb
```

## Development

```bash
npm install
npm run build
npm test
```

## License

MIT
