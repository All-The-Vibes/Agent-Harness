<div align="center">

# 🏗️ The Agent Harness

### *Why the Orchestration Layer — Not the Model — Determines Agent Success*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![White Paper](https://img.shields.io/badge/Read-White%20Paper-blue.svg)](Agent-Harness-POV-WhitePaper.md)

---

**The AI industry is in the grip of a model attribution error.**

When an autonomous agent fails — hallucinating, looping, taking destructive action — the instinct is to blame the model.  
But across production deployments, the pattern is clear: **the agent harness is the primary determinant of whether an agent is reliable, safe, and useful.**

</div>

---

## What Is the Agent Harness?

An **agent harness** is the orchestration layer around a language model — the runtime that constructs context, executes tool calls, enforces guardrails, and decides when each loop iteration should continue or stop.

> The model is the reasoning engine. The harness is the operating system and control plane that makes the engine useful, safe, and repeatable.

```
User task
    │
    ▼
┌──────────────────────────────────────────┐
│            Agent Harness                 │
│                                          │
│   Context Builder → Language Model       │
│         → Decision Router                │
│         → Tool Runner + Validators       │
│         → Policy + Permission Checks     │
│                                          │
└──────────────────────────────────────────┘
    │
    ▼
Output (action executed or response delivered)
```

---

## The Five Pillars

A production-grade harness stands on five architectural pillars. Remove any one and the system collapses — not eventually, but within the first multi-step task.

| # | Pillar | Guarantee |
|---|--------|-----------|
| **1** | **Context Assembly** | Every model invocation receives a token payload that maximizes comprehension per token spent |
| **2** | **Tool Integrity** | Every tool call is schema-validated before execution, with actionable error messages |
| **3** | **Loop Discipline** | The execution cycle uses explicit signals — not heuristics — to continue, retry, or halt |
| **4** | **Policy Enforcement** | Every tool call passes through a permission gate before any side effect occurs |
| **5** | **Context Lifecycle** | The context window is actively managed as a finite, depletable resource |

---

## The Attribution Error

Most reliability problems blamed on "the model" are actually harness design problems:

| Symptom | Misattribution | Actual Cause |
|---------|---------------|--------------|
| Infinite loops | *"Model can't figure out when to stop"* | No explicit completion mechanism in the harness |
| Context exhaustion | *"Context window isn't big enough"* | Harness dumps full outputs without summarization |
| Destructive actions | *"Model doesn't understand consequences"* | No policy layer — no actions require confirmation |
| Tool misuse | *"Model doesn't understand the tools"* | Vague tool descriptions and ambiguous parameters |
| No self-correction | *"Model can't recognize mistakes"* | Harness doesn't feed actionable errors back into the loop |

---

## Repository Contents

| File | Description |
|------|-------------|
| [**Agent-Harness-POV-WhitePaper.md**](Agent-Harness-POV-WhitePaper.md) | Full white paper — defines the harness, decomposes the five pillars, catalogs failure modes, and provides architectural patterns |
| [**Agent-Harness.md**](Agent-Harness.md) | Concise concept document with worked examples |
| [**five-pillars-poster.html**](five-pillars-poster.html) | Visual poster — the five pillars rendered as structural cartography |
| [**structural-resonance.html**](structural-resonance.html) | Generative art — particle flow through invisible architecture, visualizing how structure determines reliability |
| [**design-philosophy.md**](design-philosophy.md) | Structural Cartography — the visual philosophy behind the artwork |
| [**algorithmic-art-philosophy.md**](algorithmic-art-philosophy.md) | Structural Resonance — the algorithmic philosophy behind the generative art |

---

## Key Insights

> **"Anthropic spent more time optimizing tools than the overall prompt."**  
> — Anthropic SWE-bench team

> **"Success in the LLM space isn't about building the most sophisticated system."**  
> — Anthropic, Building Effective Agents

### Six Design Principles

1. **Simplicity over sophistication** — Start with the simplest harness that enforces the five pillars
2. **Transparency over opacity** — Surface the agent's state at every point in its loop
3. **ACI-native tool design** — Treat tool design with the same rigor as UX design
4. **Explicit over heuristic** — Prefer explicit signals over heuristic detection
5. **Feedback loops over one-shot** — Value controlled loops that self-correct
6. **Atomic tools, compound behavior** — Tools are primitives; features emerge from composition

---

## The Investment Case

| Investment Area | Durability |
|-----------------|------------|
| Model selection | Low — next release resets the advantage |
| Prompt engineering | Medium — prompts need updating as models change |
| **Harness architecture** | **High — the five pillars persist regardless of model** |
| **Tool design (ACI)** | **High — good tools work with any model** |
| **Policy framework** | **High — safety requirements only increase** |

---

## Sources

- **Anthropic.** "Building Effective Agents." 2024.
- **Zaharia, M. et al.** "The Shift from Models to Compound AI Systems." BAIR, 2024.
- **Microsoft Research.** "Magentic-One: A Generalist Multi-Agent System." 2024.
- **Anthropic.** "Agent-Native Architecture." Compound Engineering Plugin, 2025–2026.

---

<div align="center">

*The question for engineering leaders is not "which model should we use?"*  
*It is: **"how good is our harness?"***

---

**MIT License** · Made with deliberate harness design

</div>
