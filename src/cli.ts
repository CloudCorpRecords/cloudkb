#!/usr/bin/env node
/**
 * cloudkb CLI.
 *   cloudkb <tool-name> '<json args>'
 *   cloudkb mcp
 * Requires AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY for live calls.
 * Exit codes: 0 success, 1 error, 2 usage.
 */
import { callTool, executorFromEnv, VERSION } from "./bedrock.js";

const TOOL_NAMES = [
  "list_knowledge_bases", "get_knowledge_base", "list_data_sources",
  "get_data_source", "list_ingestion_jobs", "get_ingestion_job",
  "start_ingestion_job", "stop_ingestion_job", "retrieve",
  "retrieve_and_generate",
];

function usage(): never {
  console.error(`Usage:
  cloudkb <tool> '<json args>'   tools: ${TOOL_NAMES.join(", ")}
  cloudkb mcp
  cloudkb --version`);
  process.exit(2);
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "--version" || cmd === "-v") { console.log(VERSION); return; }
  if (cmd === "mcp") { await import("./mcp.js"); return; }
  if (!cmd || !TOOL_NAMES.includes(cmd)) usage();
  let args: Record<string, unknown> = {};
  const raw = rest.join(" ").trim();
  if (raw) {
    try {
      args = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      console.error("error: args must be a JSON object");
      process.exit(1);
    }
  }
  try {
    const out = await callTool(executorFromEnv(), cmd, args);
    console.log(typeof out === "string" ? out : JSON.stringify(out, null, 2));
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
void main();
