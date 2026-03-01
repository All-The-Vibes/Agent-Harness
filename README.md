<div align="center">

# 🏗️ The Agent Harness

### *Why the Orchestration Layer — Not the Model — Determines Agent Success*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![White Paper](https://img.shields.io/badge/Read-White%20Paper-blue.svg)](Agent-Harness-POV-WhitePaper.md)
[![Prompt Guide](https://img.shields.io/badge/Prompt-Build%20Guide-green.svg)](.github/prompts/build-harness.prompt.md)

---

**Everyone blames the model. We think the orchestration layer is what actually matters.**

This is a philosophy of agent design — born from studying how agents fail, tracing the patterns back to their root causes, and arriving at a conviction: the harness (context assembly, tool integrity, loop discipline, policy enforcement, context lifecycle) determines outcomes more than the model inside it.

This repo contains the white paper, the architectural framework, a **hands-on prompt guide you can use today** to scaffold and test a harness yourself, and generative art that makes the philosophy visible.

</div>

---

## The Five Pillars — At a Glance

<div align="center">

![The Five Pillars of the Agent Harness](five-pillars-poster.png)

*The five architectural pillars rendered as structural cartography — open [five-pillars-poster.html](five-pillars-poster.html) locally for the full animated version*

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

## Not Theory — A Practitioner's Toolkit

This repo is structured so you can **read the why, then immediately build the what**:

### 📖 Understand

| File | What You Get |
|------|-------------|
| [**Agent-Harness-POV-WhitePaper.md**](Agent-Harness-POV-WhitePaper.md) | Full white paper — the five pillars framework, common failure modes and their root causes, architectural patterns drawn from Anthropic, Berkeley, and Microsoft Research |
| [**Agent-Harness.md**](Agent-Harness.md) | Concise concept document with a worked pagination example showing a controlled harness run step by step |

### 🔧 Build

| File | What You Get |
|------|-------------|
| [**.github/prompts/build-harness.prompt.md**](.github/prompts/build-harness.prompt.md) | **Actionable prompt guide** — TypeScript type contracts, scaffold order, build directives for each pillar. Feed this to an AI coding agent or use it as a blueprint to implement your own harness from scratch |

> **Try it now:** Open the prompt guide in VS Code with GitHub Copilot, or paste it into Claude/ChatGPT and say *"Scaffold this harness in TypeScript."* You'll have a working five-pillar skeleton in minutes.

### 🎨 See

| File | What You Get |
|------|-------------|
| [**five-pillars-poster.html**](five-pillars-poster.html) | Visual poster — the five pillars rendered as structural cartography |
| [**structural-resonance.html**](structural-resonance.html) | Generative art — particle flow through invisible architecture, showing how structure determines reliability and the bright center just gets the credit |
| [**design-philosophy.md**](design-philosophy.md) | Structural Cartography — the visual philosophy behind the artwork |
| [**algorithmic-art-philosophy.md**](algorithmic-art-philosophy.md) | Structural Resonance — the algorithmic philosophy behind the generative art |

---

## The Philosophy in Practice

Every pillar exists because of a failure mode that's well-documented across the agentic AI space:

- **Context Assembly** → Agents that don't know what tools exist or what the user expects aren't dumb — they're uninformed
- **Tool Integrity** → Malformed tool calls aren't a model problem — they're a bad API design problem
- **Policy Enforcement** → Destructive actions don't happen because the model lacks judgment — they happen because nobody built the gate
- **Loop Discipline** → $50 API bills from infinite loops aren't about model reasoning — they're about missing stop signals
- **Context Lifecycle** → Agents that "forget" their objective on turn 15 aren't forgetful — their context window drowned in noise

> **"Anthropic spent more time optimizing tools than the overall prompt."**  
> — Anthropic SWE-bench team

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

**MIT License** · A philosophy of agent design, with tools to test it yourself

</div>
