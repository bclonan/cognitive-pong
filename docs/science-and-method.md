# Science and Method

Cognitive Pong is an interaction design for inspecting multi-agent reasoning. It borrows ideas from debate, adversarial collaboration, cognitive tracing, active learning, and reinforcement-style feedback, but it should be read as a decision-support environment rather than a scientific benchmark.

## Why Pong?

Pong gives a simple physical metaphor:

- a paddle hit means an agent takes a turn;
- ball direction shows who is responding;
- speed and glow communicate momentum;
- scoring events make successful proposals visible;
- replay makes the debate inspectable after the fact.

The point is not to gamify truth. The point is to make abstract reasoning state visible enough that a human can inspect it.

## Two-Agent Debate

The arena uses two agents because many reasoning failures appear only when a claim is challenged. A single answer can hide weak assumptions. A second agent can:

- expose missing constraints;
- test operational edge cases;
- ask for evidence;
- propose alternatives;
- force synthesis instead of one-shot completion.

Agent A and Agent B can be configured with different models, providers, prompts, and strategic profiles. This makes the arena useful for comparing not only models, but also roles.

## Agent Profiles

Agent profiles influence style and pressure:

- competitive drive;
- debate style;
- psychology archetype;
- risk tolerance;
- collaboration bias;
- aggressiveness;
- empathy;
- custom instructions.

These values shape the prompt, but they must not override truthfulness, safety, evidence quality, the master goal, or valid schema compliance. That constraint is enforced in `server/agentProfile.ts`.

## Turn Types

Cognitive Pong normalizes output into turn types:

- `proposal`: a constructive claim or plan;
- `critique`: an objection, risk, or challenge;
- `rebuttal`: a counterargument or revision;
- `agreement`: synthesis or convergence.

The UI uses turn type to label shots, replay the exchange, and build final artifacts.

## Conviction and Complexity

Conviction score is a local signal of how strongly the current turn is presented. It is not proof.

Complexity labels are:

- `quick lookup`;
- `deep research`;
- `complex simulation`.

They help the UI explain what kind of reasoning posture the turn used.

## Judge Scoring

Judge scoring uses dimensions such as:

- intellect;
- precision;
- rhetoric.

The judge can mark a turn as a scoring goal. A scoring goal can create a finalized consensus milestone if the turn contains a proposal.

Interpret judge scores as:

- a consistency and quality signal;
- a way to drive the game loop;
- a prompt for human review.

Do not interpret them as objective truth.

## Spectator Reactions

Spectator reactions simulate domain reviewer comments. They provide another perspective on whether a claim is operationally useful, risky, clear, or decision-relevant.

They are useful for UI inspection and narrative review, but they are not independent external validation.

## Active Research State

The active research panel treats a turn like a research object with:

- core claim;
- evidence hints;
- memory traces;
- complexity;
- attractor-style state.

This is a visualization strategy. It helps users follow how the debate is moving, especially during longer loops.

## Timeline Dependencies

The timeline graph maps relationships among turns, claims, and consensus outputs. It is useful for seeing whether later conclusions actually address earlier objections.

The desired pattern is:

1. proposal;
2. critique;
3. revised proposal or rebuttal;
4. agreement or milestone.

## Arena Loop Research

Arena Loop persistence stores structured battle data. Optional search providers can attach sources to a turn. Search is bounded so the loop does not become unbounded crawling.

Supported research providers:

- mock;
- SearXNG;
- Brave Search;
- Tavily.

The source ledger is strongest when the user sets low, reviewable limits and reads the attached excerpts.

## Consensus

Consensus in Cognitive Pong means:

- the judge saw a proposal as strong enough to award a point;
- the proposal was saved as a finalized milestone;
- the transcript and export record how that milestone emerged.

It does not mean all real-world uncertainty is resolved.

## Neural Trainer

The neural trainer converts seed examples and live debate turns into a small local training dataset. It can train a compact neural network and export:

- weights;
- training data;
- portable evaluator code.

This is an exploratory feedback surface. It helps users think about how debate signals could influence future scoring or velocity. It is not a replacement for model fine-tuning, formal evaluation, or safety review.

## What Counts as a Good Run?

A strong run usually has:

- a clear main goal;
- visibly different agent roles;
- grounded critiques;
- specific counterexamples;
- a revised plan;
- an exportable consensus milestone;
- no hidden provider failure;
- traceable sources when research is enabled.

## Limitations

Cognitive Pong cannot guarantee:

- factual correctness;
- model safety;
- unbiased judging;
- source quality;
- production readiness of a consensus plan.

Humans should review important outputs, especially for legal, medical, financial, safety, or security decisions.

## Why This Is Useful Anyway

The value is inspectability. A one-shot model answer can feel polished while hiding fragile assumptions. A visible, replayable debate makes the reasoning process easier to inspect, compare, export, and improve.
