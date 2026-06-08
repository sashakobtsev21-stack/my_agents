---
name: "New Project"
description: "Build a brand-new project from an idea to a working, tested first version using a planned multi-agent pipeline with a verify gate. Use when the user wants to create/scaffold something new (app, CLI, bot, service, library) rather than analyze an existing codebase."
---

# New Project

Repeatable "build something new" flow: from a short idea to a working,
**building, tested** first version. Iterative with the user as the
product owner — not a black box.

## Clarify first (once)

Before scaffolding, confirm three things (ask only what's missing):
1. **What** — the project and its single most important feature.
2. **Stack** — language/framework, or "propose one" (then recommend + proceed).
   From the stated type/stack, pick the matching agent pack in `docs/CORE-AGENTS.md`
   (game → game-dev pack; scraper → `web-scraping-specialist` + `ruflo-browser`; API →
   `backend-dev` …). Don't pull in unrelated specialists or the Advanced agents.
3. **Where** — a new folder next to the repo, or a new GitHub repo
   (`gh repo create`). Default: a new sibling folder with `git init`.

## Pipeline

1. **Plan / Spec** — for non-trivial work, write a short spec (functional +
   non-functional + acceptance criteria) and the architecture, and confirm it.
   Agents: `planner`, `specification`, `system-architect`. Skip the heavy spec
   for a small prototype.
2. **Scaffold** — minimal runnable skeleton: build config, entry point,
   `.gitignore`, README, test runner. Keep files <500 lines.
3. **Implement** — build the core feature from the design. Agent: `coder`
   (parallelize independent modules).
4. **Test** — write tests for the implemented behavior. Agent: `tester`.
5. **Review** — correctness/security/quality pass. Agents: `reviewer`,
   `security-auditor`.

Spawn independent agents in parallel; tell each who to hand off to.

## Verify gate (mandatory — definition of "done")

Do **not** report the project as ready until, in the new project:
- it **builds** (compile/typecheck passes), and
- its **tests run and pass** (show the real output), and
- it actually **runs** (a smoke invocation), shown to the user.

If any gate fails, fix and re-run before claiming done. Report failures
honestly with the output.

## Output contract

- The created project (path or repo URL) with a working first version.
- A short "what's built / what's next" note.
- For a new **sibling folder / repo**, ask once where to push; the repo's
  auto-commit-to-`main` policy applies to **this** repo, not the new one.

## Anti-drift

Build exactly the agreed scope; verify before claiming done; prefer editing
generated files over re-generating; keep the structure clean and typed.
