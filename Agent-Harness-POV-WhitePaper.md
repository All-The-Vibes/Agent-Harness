# The Agent Harness: Why the Orchestration Layer — Not the Model — Determines Agent Success

**A Point of View White Paper**

---

## Executive Summary

The AI industry is in the grip of a model attribution error. When an autonomous agent fails — hallucinating, looping, taking destructive action, or losing track of its task — the instinct is to blame the model. *The model needs to be smarter. The model needs more context. The model needs better alignment.*

But across production deployments, research benchmarks, and the lived experience of engineering teams building agentic systems, a different pattern emerges: **the agent harness — the orchestration layer that wraps the model — is the primary determinant of whether an agent is reliable, safe, and useful in production.**

Two tools can use the same model and produce dramatically different outcomes because their harnesses differ in how they assemble context, validate tool calls, control loops, and enforce policy. The model is the reasoning engine. The harness is the operating system and control plane that makes the engine useful, safe, and repeatable.

This paper argues that engineering teams should shift investment from model selection to harness design. It defines the agent harness, decomposes its five architectural pillars, catalogs the most common failure modes, and provides architectural patterns drawn from Anthropic's research, Berkeley's work on compound AI systems, and production agent deployments.

---

## 1. The Invisible Layer

A language model can produce text. It cannot, by itself, read files, run tests, open pull requests, apply policy checks, or decide when to stop working. The harness is what turns model output into actions with controlled side effects.

Yet in most conversations about AI agents, the harness is invisible. Discussion centers on model benchmarks, parameter counts, context window sizes, and training data. The orchestration substrate — how context is assembled, how tools are executed, how loops are controlled, how policies are enforced — is treated as implementation detail.

This is like evaluating a car engine without considering the transmission, brakes, steering, and chassis. The engine matters, but the vehicle's behavior depends on the entire system.

The invisibility of the harness has a concrete cost. Engineering teams spend weeks evaluating models, running evals, and fine-tuning prompts when their actual reliability problems are:

- Unclear stopping rules that cause infinite loops
- Weak tool validation that allows malformed calls
- Poor context budgeting that fills the window with irrelevant data
- Missing feedback loops that prevent self-correction

These are harness design problems, not model capability problems.

---

## 2. Defining the Agent Harness

An agent harness is the runtime that constructs context, executes tool calls, enforces guardrails, and decides when each loop iteration should continue or stop.

It is **not**:

- A chat UI wrapper
- A prompt template library
- A framework's decorator syntax
- An API client for a language model

It **is** the execution substrate that determines whether an agent can operate safely and reliably over many steps. The distinction is architectural, not cosmetic.

### The Harness in Context

```
User task
    │
    ▼
┌─────────────────────────────────────────────┐
│              Agent Harness                  │
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │ Context Builder                      │   │
│  │ system prompt + harness instructions │   │
│  │ + AGENTS.md + tool definitions       │   │
│  └──────────────┬───────────────────────┘   │
│                 ▼                           │
│  ┌──────────────────────────────────────┐   │
│  │ Language Model                       │   │
│  │ (reasoning engine)                   │   │
│  └──────────────┬───────────────────────┘   │
│                 ▼                           │
│  ┌──────────────────────────────────────┐   │
│  │ Decision Router                      │   │
│  │ tool call ──►Tool Runner + Validators│   │
│  │ final answer ──► Output              │   │
│  └──────────────┬───────────────────────┘   │
│                 ▼                           │
│  ┌──────────────────────────────────────┐   │
│  │ Policy + Permission Checks           │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
    │
    ▼
Output (action executed or response delivered)
```

---

## 3. The Five Pillars of a Production Harness

A production-grade agent harness stands on five pillars. Remove any one and the system collapses — not eventually, but within the first multi-step task. Each pillar enforces a specific architectural guarantee, has a measurable implementation contract, and produces a known failure signature when absent.

### 3.1 Context Assembly

**Guarantee:** Every model invocation receives a token payload that maximizes comprehension per token spent — system prompt, harness instructions, project context, tool definitions, and dynamic state — structured so the model knows what exists, what it can do, and what the user expects.

This is not "write a system prompt." This is an allocation problem. A 200K-token context window is a fixed resource budget. Every byte of irrelevant context displaces relevant context. Every poorly structured instruction costs comprehension.

**What a well-built context assembler does:**

| Layer | Content | Injection Point | Example |
|-------|---------|-----------------|---------|
| **Static foundation** | Role identity, safety rules, output format constraints | System prompt, set once | `"You are a code review agent. You MUST NOT modify files without confirmation."` |
| **Project context** | Code conventions, architecture doc, dependency map | Loaded from `AGENTS.md` or `.claude/` at session start | Repository style guides, module ownership, test commands |
| **Dynamic state** | Current file tree, git status, in-progress task state | Injected per turn by the harness | `"Modified files since last commit: src/auth.ts, src/db.ts"` |
| **Tool definitions** | Name, description, parameter schema, usage examples | Registered at harness initialization | MCP tool manifests with clear parameter names and edge case docs |
| **User message** | The actual task or follow-up | Appended last (queries at the bottom improve quality up to 30%) | `"Add pagination to /admin/users"` |

**Ordering matters.** Anthropic's prompt engineering research demonstrates that placing long-form reference data at the top and the query at the bottom measurably improves response quality. XML tag structuring (`<instructions>`, `<context>`, `<input>`) eliminates ambiguity between instruction types. These are harness-level formatting decisions, not model capabilities.

**Failure signature when absent:** Context starvation. The model doesn't know what resources exist, what tools are available, or what vocabulary the user expects. Output: *"I don't understand what system you're referring to."* The model isn't confused — it's uninformed, because the harness didn't tell it what exists.

### 3.2 Tool Integrity (The Agent-Computer Interface)

**Guarantee:** Every tool call is schema-validated before execution, runs in a controlled environment, returns output the model can reason about, and produces actionable error messages that enable self-correction — not generic failures that break the feedback loop.

Anthropic's SWE-bench team reported they "spent more time optimizing tools than the overall prompt." This is the ACI — Agent-Computer Interface — and it deserves the same design rigor as a user-facing API.

**What a well-built ACI does:**

1. **Schema validation before execution.** Every tool call is checked against its JSON Schema before any side effect occurs. Malformed calls return a structured error message that tells the model *what was wrong and how to fix it* — not a generic 400.

2. **Error-proof parameter design (poka-yoke).** Redesign tool arguments so misuse is structurally impossible. Concrete example from Anthropic's production agents: switching `file_path` from relative to absolute eliminated an entire class of path resolution errors. Use `z.string().describe("Absolute path starting with /")`, not `z.string()`.

3. **Output format optimization.** Not all formats are equal for model comprehension:

   | Format | Model Cost | When to Use |
   |--------|-----------|-------------|
   | Full file content | High token count, but unambiguous | File reads under 500 lines |
   | Diffs | Requires the model to track line counts — error-prone | Avoid as model output; acceptable as harness-generated display |
   | Structured JSON | Escaping burns tokens, nested structures confuse | API responses, structured data |
   | Plain text summary | Low token count, high comprehension | Tool results that would otherwise be verbose |

4. **Actionable error messages.** When a tool fails, the result must include: what failed, the exact error, the file/line reference if applicable, and enough context for the model to choose a different approach. Generic `"Error occurred"` messages break the feedback loop.

**Failure signature when absent:** Tool misuse. The model calls tools with wrong parameter types, nonsensical argument combinations, or in illogical sequences. The root cause is almost never model capability — it's that the tool definition was ambiguous, the parameter names were unclear, or the error messages were uninformative.

### 3.3 Loop Discipline

**Guarantee:** The agent's execution cycle uses explicit signals — not heuristics — to determine when to continue, retry, or halt. Every iteration produces a two-axis result (success × continuation) that the harness evaluates deterministically.

A well-controlled loop self-corrects across multiple turns. A poorly controlled loop burns $50 in API calls while producing nothing. This pillar has more direct impact on cost and reliability than model selection.

**The ToolResult contract.** Every tool result returns two independent signals:

```
┌─────────────┬───────────────────┬──────────────────────────────────────┐
│ success     │ shouldContinue    │ Meaning                              │
├─────────────┼───────────────────┼──────────────────────────────────────┤
│ true        │ true              │ Tool worked. Keep pursuing the goal. │
│ true        │ false             │ Task complete. Stop the loop.        │
│ false       │ true              │ Tool failed. Try another approach.   │
│ false       │ false             │ Unrecoverable. Halt immediately.     │
└─────────────┴───────────────────┴──────────────────────────────────────┘
```

This two-axis design eliminates the conflation between "the tool worked" and "the task is done." The `complete_task` tool is the canonical implementation: the model calls it with a summary when the objective is met, and the harness stops the loop.

**Stopping conditions (all must be implemented):**

| Condition | Trigger | Harness Action |
|-----------|---------|----------------|
| **Explicit completion** | Model calls `complete_task` | Stop loop, return summary |
| **Iteration ceiling** | Turn count exceeds `maxIterations` (e.g., 25) | Stop loop, return partial results + progress state |
| **Token budget** | Context window utilization exceeds `targetTokens` (e.g., 80% of max) | Trigger compaction or spawn sub-agent, then continue |
| **Safety halt** | Policy violation detected (see Pillar 4) | Stop loop immediately, log violation, alert operator |
| **Idle detection** | N consecutive turns with no tool calls and no completion signal | Prompt model: "Are you blocked? Call `complete_task` with status 'blocked' or describe what you need." |

**Checkpoint and resume.** For tasks that span multiple context windows or get interrupted, the harness must serialize loop state: messages so far, task progress, iteration count, and custom agent state. On resume, the harness restores this state and continues from where the agent left off — not from the beginning.

**Failure signature when absent:** The infinite loop. The agent runs for hundreds of turns because nobody told it how to stop. Or: premature termination, where a heuristic stop fires during a legitimately long task. Both are harness bugs.

### 3.4 Policy Enforcement

**Guarantee:** Every tool call passes through a permission gate *before* execution — classified as allow, deny, or confirm — so that no side effect occurs without matching the harness's policy matrix. The model never bypasses this layer; it is transparent to the model and opaque to prompt injection.

Without this pillar, an agent with `bash`, `write_file`, and `git push` tools has the same attack surface as an unauthenticated remote shell. Policy enforcement is what makes the difference between a useful agent and a liability.

**The permission matrix.** Every tool-action combination maps to one of three policies:

```
┌──────────────────────┬──────────────┬────────────────────────────────────┐
│ Action Category      │ Policy       │ Examples                           │
├──────────────────────┼──────────────┼────────────────────────────────────┤
│ Read-only            │ ALLOW        │ read_file, list_dir, git status,   │
│                      │              │ grep, run tests (no side effects)  │
├──────────────────────┼──────────────┼────────────────────────────────────┤
│ Scoped write         │ ALLOW        │ write to output/, edit files in    │
│                      │              │ working branch, create temp files  │
├──────────────────────┼──────────────┼────────────────────────────────────┤
│ Modifying source     │ CONFIRM      │ edit src/*, modify package.json,   │
│                      │              │ change config files                │
├──────────────────────┼──────────────┼────────────────────────────────────┤
│ Destructive          │ CONFIRM      │ git push --force, rm -rf, DROP     │
│                      │              │ TABLE, delete branch               │
├──────────────────────┼──────────────┼────────────────────────────────────┤
│ External-facing      │ CONFIRM      │ Post to Slack, comment on PR,      │
│                      │              │ send email, deploy to production   │
├──────────────────────┼──────────────┼────────────────────────────────────┤
│ Credential access    │ DENY         │ Read .env, access secrets manager, │
│                      │              │ print API keys                     │
└──────────────────────┴──────────────┴────────────────────────────────────┘
```

**Implementation pattern: propose-then-apply.** For CONFIRM actions, the harness intercepts the tool call, generates a preview (diff, command summary, or action description), shows it to the user, and waits. Only on explicit approval does it execute. The model never knows the difference — it issued a tool call and received a result. The policy layer is transparent to the model and opaque to prompt injection.

**Credential hygiene.** Tool results must be scrubbed before returning to the model. If a `bash` tool runs `env`, the harness must redact API keys, tokens, and passwords from the output. The model should never see production secrets in its context window — this is a data exfiltration vector via prompt injection.

**Failure signature when absent:** Destructive actions. The agent deletes files, force-pushes to main, or posts to production Slack channels. The instinct is to blame the model's judgment. The actual cause: nobody built the gate.

### 3.5 Context Lifecycle

**Guarantee:** The context window is actively managed as a finite, depletable resource — with explicit rules for what stays hot, what gets compacted, what gets persisted to disk, and when work is offloaded to sub-agents with their own context budgets. No critical information is silently displaced by noise.

A 200K-token context window fills up in 10 turns of active tool use. Three file reads (10K tokens each), a search result (5K), verbose test output (8K), and the accumulated conversation history push past the useful threshold fast. Without active management, the agent loses track of its objective — not because the model is forgetful, but because the harness let critical information get displaced by irrelevant output.

**Three-tier memory architecture:**

```
┌─────────────────────────────────────────────────────────┐
│ Tier 1: HOT — In the context window                     │
│ System prompt, current task, recent tool results,       │
│ active conversation. Always present.                    │
├─────────────────────────────────────────────────────────┤
│ Tier 2: WARM — Summarized in context                    │
│ Older conversation turns compressed to key decisions    │
│ and outcomes. Earlier tool results replaced with        │
│ one-line summaries. Harness manages compaction.         │
├─────────────────────────────────────────────────────────┤
│ Tier 3: COLD — Persisted to disk                        │
│ Full file contents, verbose logs, research findings,    │
│ progress notes. Accessible via tool calls (read_file)   │
│ but not consuming context window tokens.                │
└─────────────────────────────────────────────────────────┘
```

**Concrete mechanisms:**

| Mechanism | What It Does | When to Trigger |
|-----------|-------------|-----------------|
| **Compaction** | Summarize older messages, drop verbose tool results, keep system prompt and recent turns | Context utilization exceeds 80% of window |
| **Progress file** | Agent writes `progress.md` with current state, completed steps, next actions | Every 5 turns, before compaction, and before task completion |
| **Sub-agent delegation** | Spawn a sub-agent with its own context window for an isolated subtask; receive only the result | Subtask is self-contained and would consume >20% of remaining context |
| **context.md pattern** | A persistent file the agent reads at session start and updates as it works — accumulated knowledge that survives across sessions | Multi-session tasks, onboarding new agent instances |
| **Iterative refinement** | Tools return previews by default (`first 50 lines`), full content on explicit request | Always — design tools to be context-efficient by default |

**Context-aware harnesses.** Claude 4.5+ models can track their remaining context budget. The harness should inform the model: *"Your context will be automatically compacted as it approaches its limit. Save progress to files before compaction. Do not stop work early due to context concerns."* But this instruction only works if the harness actually implements compaction. Promising compaction without delivering it causes the agent to barrel past the window limit and degrade.

**Failure signature when absent:** Context exhaustion. The agent starts producing incoherent responses, repeating itself, or losing track of its objective around turn 15. The diagnosis is always "the model forgot" — but the actual cause is that the harness let the context window fill with unmanaged data until signal was drowned by noise.

---

## 4. The Attribution Error: Why Model Failures Are Usually Harness Failures

The most consequential insight from production agent deployments is that **most reliability problems blamed on "the model" are harness design problems.** This section examines the common failure modes and their actual root causes.

### 4.1 The Infinite Loop

**Symptom:** Agent runs for hundreds of turns, burning tokens, without converging on a solution.

**Misattribution:** "The model can't figure out when to stop."

**Actual cause:** The harness has no explicit completion mechanism. The model is expected to produce a natural language response that somehow signals "done" — or worse, the harness watches for heuristic signals like consecutive turns without tool calls. Both approaches are fragile. An explicit `complete_task` tool with a `shouldContinue: false` signal is a harness-level fix.

### 4.2 Context Window Exhaustion

**Symptom:** Agent starts producing incoherent responses or loses track of its objective midway through a multi-step task.

**Misattribution:** "The model's context window isn't big enough."

**Actual cause:** The harness dumps full file contents, verbose tool outputs, and entire error logs into the context without summarization. A harness that supports iterative refinement (preview vs. full file reads), consolidation tools, and truncation strategies can operate productively within any context budget.

### 4.3 Destructive Actions

**Symptom:** Agent deletes files, force-pushes to main, or overwrites critical data.

**Misattribution:** "The model doesn't understand the consequences of its actions."

**Actual cause:** The harness has no policy layer. No actions require confirmation. No permission boundaries exist. The model was given tools for destructive operations with no gates. This is a harness design omission, not a model alignment problem.

### 4.4 Tool Misuse

**Symptom:** Agent calls tools with malformed arguments, uses wrong parameter formats, or calls tools in illogical sequences.

**Misattribution:** "The model doesn't understand how the tools work."

**Actual cause:** Tools have vague descriptions, ambiguous parameter names, and undocumented edge cases. Anthropic's research recommends imagining yourself as the model: "if a tool's purpose isn't obvious from its description and parameters, improve the documentation." Bad tools produce bad tool calls regardless of model capability.

### 4.5 The Self-Correction Gap

**Symptom:** Agent makes an error and, rather than correcting it, builds on the error for subsequent steps.

**Misattribution:** "The model can't recognize its own mistakes."

**Actual cause:** The harness doesn't feed actionable error information back into the loop. Tool failures return generic messages. Test outputs are truncated. Build errors lack file/line references. When the model can't see what went wrong in enough detail, it can't self-correct — not because it lacks the reasoning capability, but because the feedback loop is broken.

---

## 5. Harness Patterns for Production

This section maps proven orchestration patterns to specific harness design decisions, drawn from Anthropic's research on building effective agents and Berkeley's work on compound AI systems.

### 5.1 The Augmented LLM as Foundation

Every agentic system starts with an LLM enhanced with three capabilities: retrieval, tools, and memory. These capabilities are harness-level additions. The model itself doesn't "have" tools — the harness gives it tools, validates their use, and executes their results.

This is the foundational layer. A harness that provides a well-documented, easy-to-use tool interface — following the poka-yoke principle and the ACI design discipline — outperforms a harness that provides a powerful model with badly designed tools.

### 5.2 Workflow Patterns (Deterministic Control Flow)

For tasks with predictable structure, the harness implements deterministic control flow over the model.

| Pattern | Harness Responsibility | Best For |
|---------|------------------------|----------|
| **Prompt Chaining** | Manages sequential model calls, validates intermediate results, gates progression | Tasks that decompose into known subtasks |
| **Routing** | Classifies inputs, directs to specialized handlers with different system prompts and tools | Inputs with distinct categories needing different treatment |
| **Parallelization** | Runs multiple model calls concurrently, aggregates results | Independent subtasks or multi-perspective evaluation |

In each case, the model does the reasoning. The harness does the orchestration.

### 5.3 Agent Patterns (Model-Driven Control Flow)

For open-ended tasks, the model itself determines what to do next. The harness provides the loop structure, tool access, and stopping conditions.

| Pattern | Harness Responsibility | Best For |
|---------|------------------------|----------|
| **Orchestrator-Workers** | Central model decomposes task; harness spawns worker model calls and synthesizes results | Complex tasks where subtasks can't be predetermined |
| **Evaluator-Optimizer** | One model generates; another evaluates; harness manages the feedback loop until quality criteria are met | Tasks with clear evaluation criteria where iteration adds value |
| **Autonomous Loop** | Harness runs model in a loop with tool access; model plans, executes, observes, iterates | Open-ended problems with unpredictable step counts |

**Anthropic's key insight:** "Despite handling sophisticated tasks, agents are typically just LLMs using tools based on environmental feedback in a loop." The implementation is simpler than it sounds. What matters most is thoughtful harness design — how tools are presented, how feedback flows, and how the loop is controlled.

### 5.4 The Unified Orchestrator Pattern

One execution engine, many agent types. All agents use the same harness with different configurations: different tools, different system prompts, different model tiers, different iteration limits.

**Benefits:**
- Consistent lifecycle management (start, pause, resume, stop) across all agents
- Automatic checkpoint/resume for interrupted tasks
- Shared tool protocol and validation
- Centralized error handling and logging
- Easy to add new agent types without new harness code

This pattern separates the pillars cleanly: the harness handles execution mechanics; the configuration (tools + prompt + model tier) handles agent identity.

---

## 6. Compound Harnesses: Multi-Agent Orchestration

When a system goes from one agent to many — orchestrator-workers, evaluator-optimizer loops, parallel review swarms — the importance of harness design increases nonlinearly. Each sub-agent needs its own context assembly, loop discipline, and policy boundary. The orchestrating harness must manage coordination, dependency resolution, and result aggregation.

### 6.1 The Compound AI Systems Perspective

Berkeley's research on compound AI systems establishes that "state-of-the-art AI results are increasingly obtained by compound systems with multiple components, not just monolithic models." In production, 60% of LLM applications already use retrieval-augmented generation and 30% use multi-step chains.

The compound systems perspective reframes every harness pillar:

| Single-Agent Pillar | Compound Equivalent |
|----------------------|---------------------|
| Context assembly | Per-agent context scoping + shared workspace |
| Tool integrity | Cross-agent tool access controls |
| Loop discipline | Dependency-aware scheduling across agents |
| Policy enforcement | Hierarchical permission boundaries |
| Context lifecycle | Shared state management across agent instances |

### 6.2 Swarm Orchestration Primitives

Multi-agent harnesses introduce new primitives:

- **Teams:** Named groups of agents with a leader and teammates. The harness manages team membership, message routing, and shutdown coordination.
- **Inboxes:** Asynchronous message channels between agents. The harness serializes and deserializes messages, handles delivery, and prevents deadlocks.
- **Task Dependencies:** Some agent tasks depend on outputs from others. The harness resolves dependencies, schedules execution order, and propagates failures.
- **Spawn Backends:** Sub-agents can run in-process (fast, invisible), in separate terminal panes (visible, debuggable), or on remote machines. The harness abstracts the spawn mechanism.

### 6.3 Resource Allocation in Compound Systems

A non-obvious harness responsibility: how to distribute budget (latency, cost, compute) across components. If the total budget is 100ms, should the retriever get 20ms and the model 80ms, or the reverse? Should the orchestrator use the powerful model tier while workers use the fast tier?

These are harness-level decisions with first-order impact on system behavior. Model selection is one variable among many.

---

## 7. Design Principles

Drawing from all the research, six principles emerge for harness design.

### 7.1 Simplicity Over Sophistication

Anthropic's finding: "Success in the LLM space isn't about building the most sophisticated system." The most successful agent implementations use simple, composable patterns rather than heavyweight frameworks.

**Implication for harness design:** Start with the simplest harness that enforces the five pillars. Add complexity only when measurement proves it improves outcomes. A harness that clearly implements context assembly, tool integrity, loop discipline, policy enforcement, and context lifecycle management — in readable, debuggable code — beats an abstraction-heavy framework every time.

### 7.2 Transparency Over Opacity

The harness should surface the agent's state at every point in its loop: which tools are being called, what context is being assembled, what policies are being applied, where in the loop the agent currently is.

**Practical implementation:** Structured logging at every harness decision point. Visual progress indicators (task tracking with status). Showing users what the agent is doing, not just what it produces.

### 7.3 ACI-Native Tool Design

Treat tool design with the same rigor as UX design. Clear descriptions. Obvious parameter names. Documented edge cases. Error messages that enable self-correction. Formats that match the model's training data.

**The test:** Show the tool definition to a colleague with no context. If they can't immediately understand what the tool does and how to use it, improve the definition.

### 7.4 Explicit Over Heuristic

Prefer explicit signals over heuristic detection at every harness decision point. Explicit completion tools over inferred stopping. Explicit permission checks over assumed safety. Explicit context budgets over "read everything and hope it fits."

### 7.5 Feedback Loops Over One-Shot Execution

The value of an agent is not one perfect model response. It is a controlled loop that can self-correct with runtime feedback. The harness must ensure that feedback (tool results, test outputs, error messages) is detailed enough for the model to reason about and act on.

### 7.6 Atomic Tools, Compound Behavior

Tools should be primitive capabilities: read a file, write a file, run a command, store a record. Features are outcomes the agent achieves by composing primitives in a loop. If tools encode business logic, the agent becomes a router for your code, not a reasoning engine pursuing outcomes.

**The test:** To change how a feature behaves, do you edit prose (a system prompt) or refactor code? In agent-native architecture, the answer should be prose.

---

## 8. From Theory to Implementation: Building a Harness

This paper did not start as theory. It grew out of building agentic systems across domains — knowledge graph pipelines that hallucinated temporal relationships, clinical trial platforms where fabricated citations had real consequences, LLM defense systems where prompt injection revealed how little the harness was doing to protect the model from itself. Each project deposited the same lesson: when the agent failed, the model wasn't the problem. The orchestration was.

Sharkbait — an open-source CLI coding assistant built on Bun and TypeScript — became the project where these lessons converged into a deliberate harness architecture. It is not presented here as an exemplary system but as an honest implementation of the five pillars, with concrete code constructs that illustrate where the theory holds, where it extends, and where it remains incomplete.

### 8.1 Pillar Mapping: How the Five Guarantees Manifest in Code

**Context Assembly.** Sharkbait's `ContextManager` separates context into two explicit categories: `PreservedContext` (system prompt, task ledger, recent messages, active files, error context — never compacted) and `CompactableContext` (older messages, tool results, exploration findings — eligible for summarization). This mirrors the whitepaper's context assembly layers but makes the harness's allocation decision structurally visible: the developer declares what is sacred and what is compactable, and the harness enforces the boundary.

```typescript
interface PreservedContext {
  systemPrompt: string;
  taskLedger: TaskLedger;
  recentMessages: Message[];
  activeFiles: FileContext[];
  errorContext: ErrorContext[];
}
```

The error context field is worth noting: recent errors are treated as sacred context on the same level as the system prompt. This emerged from observing that when error information gets compacted away, the model repeats the same failed approach — the self-correction gap described in Section 4.5.

**Tool Integrity.** Thirty-six tools organized into six categories (file operations, shell, git, GitHub, Beads memory, web fetch) are registered through a `ToolRegistry` that exports JSON Schema definitions. A lifecycle hooks system intercepts every tool call:

```typescript
type HookType =
  | "PreToolUse" | "PostToolUse"
  | "Stop" | "OnError"
  | "PreAgentSwitch" | "PostAgentSwitch"
  | "OnTokenLimit" | "OnUserInput"
  | "SessionStart" | "SessionEnd";
```

`PreToolUse` hooks return a `{ proceed: boolean; reason?: string }` decision, functioning as the validation and policy gate described in Pillars 2 and 4. `PostToolUse` hooks capture duration, success status, and error details — providing the actionable feedback loop the whitepaper prescribes for self-correction.

**Loop Discipline.** The `AgentLoop` implements a dual-ledger progress system inspired by Microsoft Research's Magentic-One. Rather than a single loop counter, it separates **intent** from **execution**:

```
TaskLedger:     What are we trying to do?
                objective, facts, assumptions, plan, replan count

ProgressLedger: How is it going?
                current step, step history, stall count,
                last progress timestamp, agent assignments
```

This separation enables a decision tree richer than the whitepaper's stopping conditions table. When the stall count exceeds a threshold, the harness doesn't halt — it triggers a replan, injecting a system message that forces the model to revise its approach. Only after multiple failed replans does it escalate to termination. The progression is: **continue → replan → escalate** — a three-state model where the whitepaper prescribes two (continue or stop).

A circuit breaker pattern handles persistent tool failures gracefully. When the Beads memory system fails repeatedly, the harness stops attempting writes and injects a "stop trying beads" message — degrading the capability rather than letting the agent burn iterations on a broken subsystem.

**Policy Enforcement.** Action reversibility classification assigns every tool operation one of three categories: easy to reverse, requires effort to reverse, or irreversible. This maps directly to the whitepaper's permission matrix but adds a dimension the whitepaper doesn't model: the *cost of undoing* an action, not just its destructive potential. A `git commit` is easy to reverse. A `git push --force` requires effort. A production deployment is irreversible. The confirmation threshold tracks reversibility, not just write/read classification.

**Context Lifecycle.** The `ContextManager` triggers compaction when context utilization exceeds 85% of the window, using a prioritized strategy chain:

1. Summarize tool results (highest token savings, lowest information loss)
2. Summarize older conversation turns
3. Compact exploration findings (keep key facts in the task ledger)

Beyond in-session compaction, the Beads memory system provides Tier 3 (cold) persistence. Beads are git-native memory objects with dependency tracking and lifecycle management (`init → create → ready → done`). Unlike the whitepaper's `context.md` pattern — a single persistent file — Beads are structured, versioned, and travel with the repository. They survive not just across sessions but across machines, without an external sync service.

### 8.2 Where Implementation Extended the Theory

Three design decisions in Sharkbait went beyond what the whitepaper prescribes:

**Stall detection with automatic replanning.** The whitepaper's idle detection stopping condition prompts the model to call `complete_task` with status `blocked`. Sharkbait's replan mechanism is more aggressive: it injects new planning context and forces a revised approach before considering termination. In practice, this recovered approximately 40% of stalled tasks that would have been abandoned under a simple halt policy.

**Seven specialized agents sharing one harness.** The orchestrator, coder, reviewer, explorer, planner, debugger, and parallel executor all extend a `BaseAgent` class and share a single `ToolRegistry`. The unified orchestrator pattern from Section 5.4 is implemented literally: one execution engine, seven agent configurations. Adding a new agent type requires a system prompt, a tool subset, and a color — no new harness code.

**Parallel tool execution.** The agent loop uses `Promise.allSettled` for concurrent tool calls within a single turn. The whitepaper's Section 5.2 describes parallelization as a workflow pattern for multiple model calls. Sharkbait applies it at the tool execution layer within a single agent's turn — a lower-level parallelism that the harness manages transparently.

### 8.3 Where the Harness Remains Incomplete

Honesty requires noting what the implementation still lacks relative to the compound engineering plugin's full prescription:

- **Parity discipline.** As a CLI tool without a GUI, the action parity audit (mapping every UI action to an agent tool) does not apply directly. But the principle generalizes: every *user workflow* should have an agent equivalent. Sharkbait has not formalized this mapping.

- **Dynamic context injection of domain vocabulary.** The system prompt is built programmatically but does not inject project-specific vocabulary definitions or capabilities mapping tables using user language.

- **Self-modification.** The whitepaper does not prescribe it, but the compound engineering plugin identifies it as an advanced improvement mechanism. Sharkbait's agents cannot yet modify their own prompts based on feedback — a capability that would close the improvement-over-time loop.

These gaps are the next engineering frontier, not oversights. Each requires deliberate design choices about how much autonomy the harness should grant the agent over its own configuration — the very question this paper argues engineering teams should be investing in.

---

## 9. Calling the Question: What Engineering Teams Should Invest In Today

The model will improve. Next year's model will be meaningfully better than this year's. But the harness is where engineering teams can create durable competitive advantage *right now*.

### The Investment Case

| Investment Area | Payoff Timeline | Durability |
|-----------------|-----------------|------------|
| Model selection | Immediate but transient | Low — next model release resets the advantage |
| Prompt engineering | Near-term | Medium — prompts need updating as models change |
| **Harness architecture** | **Near-term to long-term** | **High — the five pillars persist regardless of model** |
| Tool design (ACI) | Near-term | High — good tools work with any model |
| Policy framework | Ongoing | High — safety requirements only increase |
| Context lifecycle strategy | Near-term | High — context management remains critical |

### Recommended Actions

1. **Name the harness.** If your team builds agents and doesn't have an explicit concept of "the harness" — with owners, design documents, and review processes — you're operating on implicit assumptions about orchestration. Make them explicit.

2. **Audit the five pillars.** For every agent in production, ask: How is context assembled? How are tools validated and executed? How does the loop stop? What policies gate destructive actions? How is the context window managed across turns? If any answer is "we haven't really thought about it," that's your reliability risk.

3. **Invest in tool design.** Anthropic spent more time optimizing tools than prompts for their benchmark agents. Most teams do the opposite. Reverse the ratio.

4. **Separate harness from configuration.** Use the unified orchestrator pattern: one execution engine, many agent types. This prevents harness logic from being duplicated (and diverging) across multiple agent implementations.

5. **Build feedback loops, not guardrails.** The goal is not to prevent the model from doing anything wrong. The goal is to create a loop where mistakes are detected, surfaced with enough information for self-correction, and retried — within well-defined policy boundaries.

6. **Treat harness design as a first-class engineering discipline.** It is not plumbing. It is not boilerplate. It is the system that determines whether your $20/hour reasoning engine produces $200/hour outcomes or $2/hour confusion.

---

## Conclusion

The agent harness is the most important and most neglected component of agentic AI systems. While the industry focuses on model capability — larger context windows, better benchmarks, more training data — the actual determinant of agent reliability in production is the orchestration substrate: how context is assembled, how tool integrity is maintained, how loop discipline is enforced, how policies gate side effects, and how the context lifecycle is managed across turns.

Two systems with the same model produce dramatically different outcomes when their harnesses differ. The model is necessary but not sufficient. The harness is where engineering judgment, system design, and operational rigor create durable, compounding advantage.

The question for engineering leaders is not "which model should we use?" It is: **"how good is our harness?"**

---

## Sources and Further Reading

1. **Anthropic.** "Building Effective Agents." Anthropic Research, 2024. — Agent architecture patterns, ACI design, tool optimization, production deployment guidance.

2. **Zaharia, M. et al.** "The Shift from Models to Compound AI Systems." Berkeley Artificial Intelligence Research (BAIR), February 2024. — Compound system architectures, optimization challenges, production considerations.

3. **Anthropic.** "Prompting Best Practices for Claude 4.6." Anthropic Platform Documentation, 2026. — System prompt design, long-horizon reasoning, context management, subagent orchestration.

4. **Anthropic.** "Agent-Native Architecture." Compound Engineering Plugin, 2025-2026. — Parity, granularity, composability, emergent capability, and improvement-over-time principles.

5. **Anthropic.** "Agent Execution Patterns." Compound Engineering Plugin, 2025-2026. — Completion signals, partial completion, context limits, unified orchestrator pattern.

6. **Anthropic.** "Claude Code Swarm Orchestration." Compound Engineering Plugin, 2025-2026. — Multi-agent primitives, team coordination, spawn backends, messaging protocols.

7. **Microsoft Research.** "Magentic-One: A Generalist Multi-Agent System for Solving Complex Tasks." Microsoft Research, 2024. — Dual-ledger progress tracking, orchestrator-worker architecture, stall detection and replanning.

8. **Sridhar, S.** "Sharkbait: CLI Coding Assistant." GitHub, 2026. — Open-source implementation of the five pillars described in this paper, including dual-ledger loop discipline, Beads git-native persistence, and seven-agent unified orchestrator. https://github.com/shyamsridhar123/sharkbait

---

*This white paper was co-authored using Claude's compound engineering plugin for research synthesis and the brainstorming skill for argument development. The agent harness definition and pillar framework are adapted from an original concept document by the author. The case study in Section 8 draws from the author's open-source work on Sharkbait.*
