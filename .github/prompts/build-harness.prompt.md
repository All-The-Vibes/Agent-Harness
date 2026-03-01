---
description: "Scaffold a production agent harness from the Five Pillars architecture. USE FOR: build agent harness, scaffold harness, implement five pillars, create agent loop, build orchestration layer."
---

# Build Agent Harness

Scaffold a production agent harness implementing the Five Pillars architecture. Use TypeScript/Bun unless the user specifies otherwise.

## Architecture Overview

The agent harness is the orchestration layer around a language model. It manages context assembly, tool execution, loop control, policy enforcement, and context lifecycle. The model reasons; the harness orchestrates.

```
User Task → Context Builder → Language Model → Decision Router → Tool Runner → Policy Gate → Output
                    ↑                                                    |
                    └──────────── FEEDBACK LOOP ─────────────────────────┘
```

---

## Pillar 1: Context Assembly

**Guarantee:** Every model invocation receives a token payload maximizing comprehension per token.

### Type Contract

```typescript
interface PreservedContext {
  systemPrompt: string;
  taskLedger: TaskLedger;
  recentMessages: Message[];
  activeFiles: FileContext[];
  errorContext: ErrorContext[]; // Sacred — never compacted
}

interface CompactableContext {
  olderMessages: Message[];
  toolResults: ToolResult[];
  explorationFindings: string[];
}
```

### Build Directives

- Separate context into preserved (never compacted) and compactable (eligible for summarization)
- Layer context in this order: static foundation → project context → dynamic state → tool definitions → user message (query last improves quality ~30%)
- Use XML tags (`<instructions>`, `<context>`, `<input>`) to separate instruction types
- Treat recent errors as preserved context (prevents the self-correction gap)
- Load project context from `AGENTS.md` or equivalent at session start

---

## Pillar 2: Tool Integrity (Agent-Computer Interface)

**Guarantee:** Every tool call is schema-validated before execution with actionable error messages.

### Type Contract

```typescript
interface ToolDefinition {
  name: string;
  description: string; // Clear enough that a stranger understands it immediately
  parameters: JSONSchema;
  category: ToolCategory;
  reversibility: "easy" | "effort" | "irreversible";
}

type ToolCategory = "file" | "shell" | "git" | "search" | "memory" | "web" | "completion";

interface ToolRegistry {
  register(tool: ToolDefinition): void;
  validate(call: ToolCall): ValidationResult;
  execute(call: ToolCall): Promise<ToolResult>;
  getSchemas(): JSONSchema[];
}
```

### Build Directives

- Validate every tool call against JSON Schema before any side effect
- Use poka-yoke parameter design: absolute paths not relative, enums not free strings
- Return actionable errors: what failed, exact error, file/line ref, enough context for the model to retry
- Implement `PreToolUse` and `PostToolUse` lifecycle hooks:

```typescript
type HookType =
  | "PreToolUse"    // Returns { proceed: boolean; reason?: string }
  | "PostToolUse"   // Captures duration, success, error details
  | "Stop"
  | "OnError"
  | "OnTokenLimit"
  | "SessionStart"
  | "SessionEnd";
```

- Organize tools into categories (file, shell, git, search, memory, web, completion)
- Tools should be atomic primitives — features emerge from composing primitives in a loop

---

## Pillar 3: Loop Discipline

**Guarantee:** Explicit signals — not heuristics — govern continue, retry, or halt.

### Type Contract

```typescript
interface ToolResult {
  success: boolean;
  shouldContinue: boolean;
  output: string;
  metadata?: Record<string, unknown>;
}

// success=true,  shouldContinue=true  → Tool worked, keep going
// success=true,  shouldContinue=false → Task complete, stop
// success=false, shouldContinue=true  → Failed, try another approach
// success=false, shouldContinue=false → Unrecoverable, halt

interface TaskLedger {
  objective: string;
  facts: string[];
  assumptions: string[];
  plan: string[];
  replanCount: number;
}

interface ProgressLedger {
  currentStep: string;
  stepHistory: StepRecord[];
  stallCount: number;
  lastProgressTimestamp: number;
  agentAssignments: Map<string, string>;
}
```

### Build Directives

- Implement a `complete_task` tool — the model calls it with a summary when done; harness stops the loop
- Implement all five stopping conditions:

| Condition | Trigger | Action |
|-----------|---------|--------|
| Explicit completion | Model calls `complete_task` | Stop, return summary |
| Iteration ceiling | Turn count > `maxIterations` (default: 25) | Stop, return partial + state |
| Token budget | Context > 80% of window | Trigger compaction or spawn sub-agent |
| Safety halt | Policy violation | Stop immediately, log, alert |
| Idle detection | N turns with no tool calls and no completion | Prompt: "Are you blocked?" |

- Use dual-ledger progress tracking (TaskLedger for intent, ProgressLedger for execution)
- Implement three-state loop control: **continue → replan → escalate** (not just continue/stop)
- On stall detection, inject replan context before considering termination
- Support checkpoint/resume: serialize loop state (messages, progress, iteration count) for interrupted tasks

---

## Pillar 4: Policy Enforcement

**Guarantee:** Every tool call passes through a permission gate before execution.

### Type Contract

```typescript
type PolicyDecision = "ALLOW" | "CONFIRM" | "DENY";

interface PolicyRule {
  pattern: string | RegExp;      // Tool name or action pattern
  category: ActionCategory;
  decision: PolicyDecision;
}

type ActionCategory =
  | "read-only"           // ALLOW — read_file, list_dir, git status
  | "scoped-write"        // ALLOW — write to output/, temp files
  | "modify-source"       // CONFIRM — edit src/*, package.json
  | "destructive"         // CONFIRM — git push --force, rm -rf
  | "external-facing"     // CONFIRM — post to Slack, comment on PR
  | "credential-access";  // DENY — read .env, access secrets
```

### Build Directives

- Classify tool actions by reversibility: easy / effort / irreversible
- For CONFIRM actions, implement propose-then-apply: intercept call → show preview → wait for approval → execute
- The policy layer must be transparent to the model (it issues a tool call, gets a result) and opaque to prompt injection
- Scrub credentials from tool results before returning to model context (redact API keys, tokens, passwords)
- Never let the model see production secrets in its context window

---

## Pillar 5: Context Lifecycle

**Guarantee:** Context window actively managed as a finite, depletable resource.

### Type Contract

```typescript
interface ContextLifecycleManager {
  getUtilization(): number;          // 0.0 to 1.0
  compact(strategy: CompactionStrategy): void;
  persistToDisk(key: string, data: string): void;
  loadFromDisk(key: string): string | null;
  shouldSpawnSubAgent(taskTokenEstimate: number): boolean;
}

type CompactionStrategy =
  | "summarize-tool-results"     // Highest savings, lowest info loss — try first
  | "summarize-older-turns"      // Medium savings
  | "compact-exploration";       // Keep key facts in TaskLedger only
```

### Build Directives

- Three-tier memory:
  - **HOT** (in context): system prompt, current task, recent tool results
  - **WARM** (summarized): older turns compressed to key decisions/outcomes
  - **COLD** (on disk): full file contents, verbose logs, accessible via tool calls
- Trigger compaction at 85% context utilization
- Apply compaction strategies in priority order (tool results → older turns → exploration findings)
- Implement `progress.md` pattern: agent writes state every 5 turns and before compaction
- Support sub-agent delegation when a subtask would consume >20% of remaining context
- Tools should return previews by default (first 50 lines), full content on explicit request

---

## Unified Orchestrator Pattern

One execution engine, many agent types. All agents extend `BaseAgent` and share the same harness.

```typescript
interface BaseAgent {
  name: string;
  systemPrompt: string;
  tools: string[];           // Subset of registered tools
  modelTier: "fast" | "standard" | "reasoning";
  maxIterations: number;
}

// Agent configurations (add new agents without new harness code):
// - orchestrator: decomposes tasks, delegates to specialists
// - coder: file operations, shell, git
// - reviewer: read-only analysis, structured feedback
// - explorer: search, read, summarize
// - planner: roadmap, task breakdown
// - debugger: error analysis, test execution
```

---

## Scaffold Order

1. `src/types.ts` — All interfaces above
2. `src/context-manager.ts` — Pillar 1 + Pillar 5
3. `src/tool-registry.ts` — Pillar 2 (schema validation, hooks)
4. `src/policy-gate.ts` — Pillar 4 (permission matrix, scrubbing)
5. `src/agent-loop.ts` — Pillar 3 (dual-ledger, stopping conditions, replan)
6. `src/agents/base-agent.ts` — Unified orchestrator base
7. `src/agents/*.ts` — Agent configurations
8. `src/tools/*.ts` — Tool implementations by category
9. `src/index.ts` — Entry point, wiring

Start with types. Build each pillar as an independent module. Wire them together in the agent loop. Test each pillar in isolation before integration.
