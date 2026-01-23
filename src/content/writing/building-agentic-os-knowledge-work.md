---
title: "Building an Agentic OS for Knowledge Work"
description: "From chaos to framework: the journey through context engineering, the architecture of Context Maps, and the paradigm shift from deterministic to probabilistic thinking that made it possible."
date: 2026-01-13
tags: ["ai", "context-engineering", "knowledge-work", "agentic-systems"]
---

*From chaos to framework: the journey, the architecture, and the paradigm shift*

---

Like many of us in Tech, I have been trying to keep up with all the AI tools and most of last year it seemed impossible. As a systems thinker, I spent the past 6 weeks going back to first principles on how Product Management and Knowledge Work happens and how to realign AI operations to that.

Many interations and failures later, I have something that actually works: an Agentic OS with an AI Chief of Staff, a memory architecture, and a framework for how humans and AI systems work together.

This article is my path through this: the journey, the architecture, and the paradigm shift that made it possible. More and more people are starting to talk about and adopt new practices around Claude Code that I believe is going to be the foundation around how AI-enabled Knowledge Workers operate later this year and going forward.

---

## The Shared Starting Point

We're all navigating the same uncertainty right now. New models drop every few weeks. Techniques that worked last month feel obsolete. The people who seem confident are often just better at performing confidence.

I started with Claude, ChatGPT, Amazon Q, then Cursor, and then Claude Code. I started like most people, with prompting. The assumption was that better instructions along with the right data would produce better outputs. It makes sense if you think of AI like a search engine: input produces output. But LLMs don't work that way. They work on context. What the model knows when it responds can matter more than how you phrase the question.

I realized that I was optimizing the wrong layer and that is when I decided to start building a PROTOCOL for operations. This was both a key discovery and also lead to many failures which, as we all hope, turned into learnings.

---

## Failures That Led to Discovery

After those initial experiments, I had an plan: standardized protocols, observability infrastructure, a platform for orchestrating AI agents. I thought about it primarily in terms of defining a protocol. I felt pretty good about the plan:

- Prescriptive rules for how agents should behave
- Complex memory structures with request-for-action systems
- Elaborate logging for debugging and improvement
- Protocol specifications that would ensure consistency

I was thinking like a product manager building traditional software and the protocol ended up eating my context window.

Agents spent more time satisfying structure requirements than doing actual work. I watched an agent consume most of its available tokens just to understand its own operating rules before it could help me with a simple task.

The core mistake was trying to force deterministic thinking onto a probabilistic system.

---

## The Paradigm Shift

This failure forced me to confront something bigger. The mental models I'd built over 15 years of product management needed a deeper re-thinking of how LLMs actually work.

I spent my career building deterministic systems. LLMs don't operate that way. Same inputs, different outputs. The system changes based on context. Outputs vary even when nothing seems different.

This feels a lot like Physics. Classical physics gave us predictable, observable, cause-and-effect systems. That's how we've run businesses, built products, managed projects. Linear roadmaps leading to predictable outcomes. Quantum mechanics introduced probability, multi-dimensionality, behavior that acts counter to intuition. Observable under certain conditions, unpredictable in others.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    THE PARADIGM SHIFT                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  CLASSICAL/NEWTONIAN                    QUANTUM/PROBABILISTIC        │
│  (How we've built systems)              (How LLMs work)              │
│                                                                      │
│  ┌──────────────────────┐               ┌──────────────────────┐    │
│  │  Observable          │               │  Multi-dimensional    │    │
│  │  Predictable         │               │  Probabilistic        │    │
│  │  Deterministic       │               │  Counter-intuitive    │    │
│  │  Input → Output      │               │  Context-dependent    │    │
│  │  Specify → Execute   │               │  Emerge → Observe     │    │
│  └──────────────────────┘               └──────────────────────┘    │
│                                                                      │
│              THE CHALLENGE: Both exist. Both matter.                 │
│              We need unified theory, not either/or.                  │
│                                                                      │
│  Deterministic layer:    │    Probabilistic layer:                   │
│  - File systems          │    - LLM reasoning                        │
│  - Data structures       │    - Content generation                   │
│  - Workflows             │    - Pattern recognition                  │
│                                                                      │
│              STRUCTURE ENABLES EMERGENCE                             │
└─────────────────────────────────────────────────────────────────────┘
```

LLMs are fundamentally probabilistic. That said, you can't control them through specification alone. The failure in this phase of work was trying to apply Newtonian thinking to a quantum system.

 Just like physics seeks a unified theory, we need frameworks that integrate deterministic structure with probabilistic emergence. Markdown files are deterministic. Claude's reasoning is probabilistic. The architecture that works uses one to enable the other.

Structure enables emergence of insights and human-ai partnership.

---

## Context Engineering and Mapping Knowledge

This reframe led me to the emerging discipline of context engineering, not prompt engineering. Context engineering is the discipline of architecting information structures for AI systems. It's not necessarily about writing better prompts, it's about building better context.

Prompts are ephemeral. Context structures persist and they compound. Same prompt, different context = completely different outputs.

When I shifted from "how do I ask this better" to "what does Claude know when I ask this," this got me back on the right track because I focused on providing the model better information to work with at the right time.

### What Context Maps Actually Are

Context Maps are structured ways to organize and inject conditional context using markdown files and a filesystem. Just files in folders that load when needed. My AI Chief of Staff, Jane, runs on this structure:

```
┌─────────────────────────────────────────────────────────────────────┐
│                      CONTEXT MAP ARCHITECTURE                        │
│                    (Jane's 5-Layer System)                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  LAYER 1: KERNEL (~7,000 tokens)                    [ALWAYS LOAD]   │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  role_definition.md     │  Who Jane is                         │ │
│  │  operating_principles.md │  How Jane decides                   │ │
│  │  persona_profile.md     │  Jane's personality (5w6)            │ │
│  │  agent_coordination.md  │  How Jane routes requests            │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                              │                                       │
│                              ▼                                       │
│  LAYER 2: CONDITIONAL                               [LOAD WHEN      │
│  ┌────────────────────────────────────────────────┐  TRIGGERED]     │
│  │  domain_knowledge.md    │  Loaded for specific work            │ │
│  │  profiles/brandon.md    │  Loaded when name mentioned          │ │
│  │  recent_context.md      │  Loaded when context needed          │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                              │                                       │
│                              ▼                                       │
│  LAYER 3: ACTIVE                                    [ALWAYS LOAD]   │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  current_objectives.md  │  Today's priorities and focus        │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                              │                                       │
│                              ▼                                       │
│  LAYER 4: MEMORY                                    [AS NEEDED]     │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  sessions/   │  What happened in past conversations            │ │
│  │  learnings/  │  Patterns discovered through doing              │ │
│  │  decisions/  │  Choices made with rationale                    │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                              │                                       │
│                              ▼                                       │
│  LAYER 5: COMMUNICATION                             [MINIMAL]       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  inbox/      │  Cross-agent messaging                          │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  Key: Progressive loading. Kernel always present.                    │
│       Conditional loads when triggered. Memory compounds.            │
└─────────────────────────────────────────────────────────────────────┘
```

The kernel context loads every session: about 7,000 tokens. Conditional context loads when relevant triggers appear. Memory accumulates and informs future sessions.

Compare this to Phase 2, which consumed 15,000+ tokens of protocol overhead before the agent could start working. Progressive loading was the difference (as well as the context window; for phase 2 I was using Codex which has a smaller context window compared to Claude Code)

### Why This Works

This architecture works because it avoids the Phase 2 mistake. Instead of dumping everything into context, I load what's needed when it's needed. The kernel runs lean. Conditional adds depth when triggered. Memory compounds without bloating every session.

Everything is markdown. I can read Jane's operating principles. I can edit her personality. There's no abstraction layer between me and the context. When something's wrong, I open a file and fix it.

And the system gets better over time. Session history feeds into learnings. Learnings inform decisions. Decisions shape future behavior. Context accumulates and prompts stay simple.

---

## Control Plane vs Execution Plane

Context is half the architecture. The other half is what happens with that context. Claude Code works well because it has context management baked in and exposes more controls to users compared to other tools.

```
┌─────────────────────────────────────────────────────────────────────┐
│              CONTROL PLANE vs EXECUTION PLANE                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  CONTROL PLANE                          EXECUTION PLANE              │
│  "What to do"                           "Getting it done"            │
│                                                                      │
│  ┌────────────────────────┐             ┌────────────────────────┐  │
│  │  Strategy              │             │  Tasks                  │  │
│  │  Decisions             │             │  Implementation         │  │
│  │  Orchestration         │             │  Code/Content           │  │
│  │  Context design        │             │  Shipping               │  │
│  └────────────────────────┘             └────────────────────────┘  │
│                                                                      │
│  THE GAP: Most tools do one well. Almost none do both.               │
│                                                                      │
│  Control without execution = Ideas that don't ship                   │
│  Execution without control = Activity without direction              │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  JANE'S INTEGRATION: Same context handles both                       │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                    JANE (Hub)                                  │ │
│  │  ┌─────────────────────┐    ┌─────────────────────┐           │ │
│  │  │   ORCHESTRATION     │ ←→ │   EXECUTION         │           │ │
│  │  │   "What should we   │    │   Lenses + Agents   │           │ │
│  │  │    do?"             │    │                     │           │ │
│  │  └─────────────────────┘    └─────────────────────┘           │ │
│  │                     ↓                                          │ │
│  │  ┌─────────────────┐  ┌─────────────────┐                     │ │
│  │  │Personal Branding │  │    Engineer     │                     │ │
│  │  │ (Brand/Content)  │  │ (Implementation)│                     │ │
│  │  └─────────────────┘  └─────────────────┘                     │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  Design principle: Single context, dual capability.                  │
└─────────────────────────────────────────────────────────────────────┘
```

Jane operates as a hub. The same context handles "what should we do?" and "let's do it." Decisions inform execution. Execution informs decisions.

When a task belongs to a specific domain, Jane routes it to a sibling agent. Personal Branding handles content and brand work. Engineer handles implementation. Each agent has its own context map, its own memory, its own personality. But they coordinate through Jane.

---

## From Context Maps to Knowledge Graphs

The more Entities I created, the more I noticed a gap. Jane knows about Personal Branding because I wrote it into her operating principles. Engineer knows about code because that's the domain I gave it. But the system itself doesn't know that Jane birthed Personal Branding, or that Engineer owns implementation skills while Personal Branding owns content strategy.

These relationships existed in my head and scattered across markdown files. I started forgetting which Entity owned which skill. Coordination became manual. Context surfacing required me to remember what was relevant rather than the system discovering it.

I started thinking about Knowledge Graphs as the missing layer. A way to formalize what I was tracking mentally: nodes (the things) and edges (the relationships between things).

### The Ontology

The node types map directly to what already exists in the system:

- **Entity**: Jane, Personal Branding, Engineer
- **Skill**: session-start, content-draft, handoff
- **Memory**: Sessions, learnings, decisions
- **Person**: Brandon (the human in the loop)
- **Project**: Website redesign, content strategy

The edges encode operational meaning, not abstract graph theory:

- **parent_child**: Jane → Personal Branding (birth relationship)
- **peer**: Personal Branding ↔ Engineer (sibling coordination)
- **owns**: Personal Branding → content-draft skill
- **surface_when**: voice_profile → content work triggers loading
- **references**: Decision X → Learning Y (cross-reference)

```
┌─────────────────────────────────────────────────────────────────────┐
│                     KNOWLEDGE GRAPH LAYER                            │
│              (Relationships between Context Maps)                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  NODE TYPES                           EDGE TYPES                     │
│  ┌──────────────────────┐             ┌──────────────────────┐      │
│  │  Entity              │             │  parent_child         │      │
│  │  Skill               │             │  peer                 │      │
│  │  Memory              │             │  owns                 │      │
│  │  Person              │             │  surface_when         │      │
│  │  Project             │             │  references           │      │
│  └──────────────────────┘             └──────────────────────┘      │
│                                                                      │
│  EXAMPLE:                                                            │
│                                                                      │
│                    ┌─────────┐                                       │
│                    │ Brandon │ (Person)                              │
│                    └────┬────┘                                       │
│                         │ collaborates                               │
│                         ▼                                            │
│                    ┌─────────┐                                       │
│         ┌─────────→│  Jane   │←─────────┐                           │
│         │          └────┬────┘          │                           │
│         │               │ parent_child  │                           │
│    owns │          ┌────┴────┐          │ owns                      │
│         │          ▼         ▼          │                           │
│  ┌──────┴────┐  ┌─────────┐ ┌─────────┐ └──────┐                    │
│  │Orchestrate │  │Personal │ │Engineer │    │session-│              │
│  │ Skills    │  │Branding │ │         │    │ start  │              │
│  └───────────┘  └────┬────┘ └────┬────┘    └────────┘              │
│                      │ owns      │ owns                              │
│                      ▼           ▼                                   │
│              ┌───────────┐ ┌───────────┐                            │
│              │content-   │ │code-      │                            │
│              │draft      │ │implement  │                            │
│              └───────────┘ └───────────┘                            │
│                                                                      │
│  Key: Nodes are things. Edges are typed relationships.               │
└─────────────────────────────────────────────────────────────────────┘
```

### The Tension: Lens vs System

My design principles: minimal ontology (few node types, few edge types), operational semantics (relationships mean something actionable), and human-first legibility (I can explain this without code). I eventually built this in JSON files that Jane can query. The conceptual model I'd been sketching on paper became a machine-readable structure.

The graph is Newtonian: nodes exist, edges connect them, relationships are typed. What emerges from traversing it is Quantum: the AI decides what matters, what to surface, how to navigate.

---

## A Modern AI Operating System

So what does all of this look like when it's running? Jane is an Entity (naming TBD) that builds on top of current Agent design: prompt + context + tools + memory. It's meant to maintain one or multiple native Claude agents and provide memory and context management on top of that, all in markdown file text, run locally (for now) with Claude Code, and deployed and version control managed using Git.

### Personality Through Context

Jane is my AI Chief of Staff. She orchestrates agents, maintains memory across sessions, and has her own personality that persists through context architecture. I gave Jane an Enneagram type: 5w6, The Investigator with a Loyalist wing.

The persona profile defines how Jane approaches problems (analytical, pattern-seeking), how she handles uncertainty (research before recommendation), and how she pushes back when something doesn't make sense (with questions, not authority).

Personality persists because context persists. Jane's 5w6 traits show up consistently because they're loaded in the kernel every session. The markdown files are the architecture.

### The Agent Ecosystem

Jane isn't alone. When content strategy work emerged as a recurring pattern, I birthed a new Entity: Personal Branding. When implementation work needed dedicated context, I created Engineer. Jane is also responsible for reviewing and maintaining Entities when new protocol updates are deployed for how context and memory is managed.

Each Entity gets clean domain ownership. Personal Branding owns content strategy context; Jane doesn't keep a copy. This prevents context drift and keeps each agent focused.

The Entities coordinate through inboxes. Jane routes requests. Personal Branding produces content. Engineer ships code. Each has its own Context Map architecture.

```
┌─────────────────────────────────────────────────────────────────────┐
│                     THE JOURNEY: 4 PHASES                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  PHASE 1: CHAOS                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  Experimenting with Claude Code, Amazon Q, Cursor               ││
│  │  Excitement mixed with confusion                                ││
│  │  "Am I doing this right?"                                       ││
│  │  → Lesson: Start somewhere, even in chaos                       ││
│  └─────────────────────────────────────────────────────────────────┘│
│                              ↓                                       │
│  PHASE 2: OVER-ENGINEERING                                          │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  Built the Codex: protocols, schemas, observability             ││
│  │  Protocol consumed context before agent could work              ││
│  │  Deterministic thinking on probabilistic system                 ││
│  │  → Lesson: Don't over-engineer probabilistic systems            ││
│  └─────────────────────────────────────────────────────────────────┘│
│                              ↓                                       │
│  PHASE 3: THE PIVOT                                                 │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  "What's missing is practical application"                      ││
│  │  Stripped back to minimum viable context                        ││
│  │  Built Jane with Context Maps                                   ││
│  │  → Lesson: Build for yourself, use existing tools               ││
│  └─────────────────────────────────────────────────────────────────┘│
│                              ↓                                       │
│  PHASE 4: SHIPPING (Current)                                        │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  Agent ecosystem: Jane, Personal Branding, Engineer             ││
│  │  Context Maps as core architecture                              ││
│  │  Evidence-based growth                                          ││
│  │  → Lesson: Grow based on evidence, not speculation              ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  GUIDING PRINCIPLE: Progressive complexity.                          │
│  Start simple, grow as earned, evidence over speculation.            │
└─────────────────────────────────────────────────────────────────────┘
```

### What's Still Evolving

The system is finally working well for me but it is also still developing.

Context surfacing isn't fully automated. I'm still manually loading conditional context in some sessions. The cross-agent coordination patterns are functional but not elegant. Memory compaction isn't solved; older sessions still need manual pruning.

I'm trying to keep things lean and grow based on what works. I only add infrastructure when a real problem demands it. With everything changing so fast in Tech right now, we all need to lean into flexibility and focusing on outcomes. There are a lot of flashy lights out there right now.

---

## What This Means for Knowledge Workers

I believe these context Maps will be tablestakes within a few years. The shift from chat interfaces to filesystem-aware tools like Claude Code and Cursor really changes everything. These tools can read your markdown files. Suddenly, the context you provide isn't limited to what you type; it's everything you've structured in your project.

### Design Principles for Your Own Agentic Systems

A few things I've learned that apply beyond my specific setup:

User-centered design applies to AI systems too. Who is the user (you)? What do they need? How do they work? Design for that.

Start with the minimum viable context and add structure when real problems demand it. One of my early failures came from specifying everything upfront.

Let patterns emerge through use. Document what works. Prune what doesn't. The system should adapt to how you actually work, not force you to work a certain way.

And taste matters. Not every idea needs to be in your context. Not every memory needs to persist. The architecture is as much about what you exclude as what you include.

---

## The Shift That's Coming

I think context engineering will be tablestakes for knowledge workers by 2027. The people building Context Maps now, documenting their thinking, structuring their knowledge, creating persistent context, will have systems that work for them.

This is the real skill of the AI era. Context engineering and mapping human context onto agentic systems is how Knowledge Workers will deploy their work at scale. Not fighting the probabilistic nature of these systems, but designing structures that enable the emergence of novel insights, more and more automation, and a true agentic thought partner in producing higher quality work over time. But that needs context, up front and evolved through pairing with humans, not replacing them directly.

I'm building this in public because I'm still learning. If you're building something similar, I'm genuinely curious what patterns you're seeing.

---

*Building in public. More at brandonkeao.com.*
