# Changelog

## 0.1.0 (2026-10-26)

- First release: 10-tool core subset of the Bedrock knowledge base MCP
  surface (knowledge bases, data sources, ingestion jobs, retrieve and
  retrieve-and-generate) with injectable AWS executor, as CLI + stdio
  MCP server in one bin. SigV4 signing is delegated to an injectable
  signer hook and is not built in.
