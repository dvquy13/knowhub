import { execSync } from 'child_process';
import Anthropic from '@anthropic-ai/sdk';
import { KnowhubError } from '../utils/errors.js';
import type { Issue } from '../providers/types.js';
import type { HubFileConfig } from '../config/types.js';

export type InvokerType = 'claude-cli' | 'anthropic-sdk';

export interface FileOperation {
  action: 'create' | 'update' | 'delete';
  path: string;       // relative to knowledge_dir
  content?: string;   // required for create/update
}

export interface AbsorbResult {
  operations: FileOperation[];
  summary: string;
}

/**
 * Detect which invoker is available.
 * Returns 'claude-cli' if `claude` binary is available.
 * Returns 'anthropic-sdk' if ANTHROPIC_API_KEY is set.
 * Throws KnowhubError if neither is available.
 */
export function resolveInvoker(): InvokerType {
  // Check for claude CLI
  try {
    execSync('claude --version', { stdio: 'pipe' });
    return 'claude-cli';
  } catch {
    // claude CLI not available
  }

  // Check for API key
  if (process.env.ANTHROPIC_API_KEY) {
    return 'anthropic-sdk';
  }

  throw new KnowhubError(
    'No Claude invocation method available',
    1,
    'Either install the claude CLI (https://claude.ai/download) or set ANTHROPIC_API_KEY'
  );
}

/**
 * Build the synthesis prompt for absorb.
 */
export function buildAbsorbPrompt(
  issues: Issue[],
  existingFiles: Record<string, string>,  // filename -> content
  hubConfig: HubFileConfig
): string {
  const issuesList = issues.map(issue =>
    `### Issue #${issue.number}: ${issue.title}\n${issue.body}`
  ).join('\n\n');

  const existingFilesList = Object.entries(existingFiles).length > 0
    ? Object.entries(existingFiles)
        .map(([name, content]) => `### ${name}\n\`\`\`markdown\n${content}\n\`\`\``)
        .join('\n\n')
    : '_No existing knowledge files yet._';

  const rules = hubConfig.absorb.rules ?? 'Organize by topic. One file per major topic.';

  return `You are a knowledge management assistant synthesizing learnings into a knowledge base.

## Hub: ${hubConfig.name}
${hubConfig.description ? `Description: ${hubConfig.description}` : ''}

## Rules
${rules}

## New Learnings (Issues to Process)
${issuesList}

## Existing Knowledge Files
${existingFilesList}

## Task
Synthesize the new learnings into the knowledge base. For each file you want to create or update, produce a complete file operation.

Respond with ONLY a JSON object in this exact format (no markdown code blocks, no explanation):
{
  "operations": [
    {
      "action": "create" | "update" | "delete",
      "path": "relative/path/to/file.md",
      "content": "full file content (required for create/update)"
    }
  ],
  "summary": "One sentence describing what was done"
}

Rules for synthesis:
- Paths are relative to the knowledge directory (e.g., "typescript.md" not "knowledge/typescript.md")
- For "update", include the COMPLETE new file content, not just the changes
- Prefer updating existing files over creating new ones when the topic matches
- Each knowledge file must have a "# Title" heading and a "## Summary" section
- Keep files focused on one major topic`;
}

/**
 * Invoke Claude via the claude CLI in headless mode.
 */
async function invokeCLI(prompt: string): Promise<AbsorbResult> {
  const escaped = prompt.replace(/'/g, "'\\''");
  let output: string;
  try {
    output = execSync(`claude --print '${escaped}'`, {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
      timeout: 120_000,
    });
  } catch (err) {
    throw new KnowhubError(
      'claude CLI invocation failed',
      1,
      err instanceof Error ? err.message : String(err)
    );
  }
  return parseAbsorbResponse(output);
}

/**
 * Invoke Claude via the Anthropic SDK.
 */
async function invokeSDK(prompt: string): Promise<AbsorbResult> {
  const client = new Anthropic();
  const message = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 8192,
    messages: [{ role: 'user', content: prompt }],
  });

  const textBlock = message.content.find(b => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new KnowhubError('Claude returned no text response', 1);
  }

  return parseAbsorbResponse(textBlock.text);
}

/**
 * Parse Claude's JSON response into AbsorbResult.
 */
export function parseAbsorbResponse(raw: string): AbsorbResult {
  // Strip markdown code block if present
  const cleaned = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new KnowhubError(
      'Claude returned invalid JSON',
      1,
      `Response was: ${raw.slice(0, 200)}`
    );
  }

  if (
    typeof parsed !== 'object' || parsed === null ||
    !Array.isArray((parsed as { operations?: unknown }).operations) ||
    typeof (parsed as { summary?: unknown }).summary !== 'string'
  ) {
    throw new KnowhubError('Claude response missing required fields (operations, summary)', 1);
  }

  const result = parsed as AbsorbResult;

  // Validate operations
  for (const op of result.operations) {
    if (!['create', 'update', 'delete'].includes(op.action)) {
      throw new KnowhubError(`Invalid operation action: ${op.action}`, 1);
    }
    if (typeof op.path !== 'string') {
      throw new KnowhubError('Operation missing path', 1);
    }
    if (op.action !== 'delete' && typeof op.content !== 'string') {
      throw new KnowhubError(`Operation ${op.action} missing content`, 1);
    }
  }

  return result;
}

/**
 * Invoke Claude for knowledge synthesis.
 * Automatically resolves the best available invoker.
 */
export async function invokeClaudeForAbsorb(
  issues: Issue[],
  existingFiles: Record<string, string>,
  hubConfig: HubFileConfig,
  invokerOverride?: InvokerType
): Promise<AbsorbResult> {
  const prompt = buildAbsorbPrompt(issues, existingFiles, hubConfig);
  const invoker = invokerOverride ?? resolveInvoker();

  if (invoker === 'claude-cli') {
    return invokeCLI(prompt);
  } else {
    return invokeSDK(prompt);
  }
}
