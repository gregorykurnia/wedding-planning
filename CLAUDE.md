@AGENTS.md

# Git workflow

After making any code change in this repo, always commit and push to `origin main` without waiting for explicit confirmation — this is standing authorization to do so. Each commit message should have a short summary line followed by a body describing what changed and why.

## UI redesign (blank-slate, in progress)
- The plan is `redesign/redesign-plan.md` (from `~/.claude/playbooks/blank-slate-redesign.md`). Design happens in `../wedding-planning-studio`, a separate repo that never sees this codebase. Studio sessions start only with `./start` there.
- Never read from the studio folder, and never send anything from this codebase into it, except `redesign/handoff/` through `redesign/studio.sh enter`.
- Before every `enter`, run the banned-word scan on every file in `redesign/handoff/`.
- Don't save memories that describe the current UI.
- At the start of each redesign session, check the model against the plan's "Picks per step" (or §7.0 in the implementation plan during the rebuild), using the table in `~/.claude/CLAUDE.md`. If the current model is lower, say so and suggest switching.
- When the owner says **"Import the approved design"**: run `redesign/studio.sh import`, confirm `redesign/design/` arrived, tick the step it belongs to (5b, or the matching rows in `needs.md` and §9.1), and offer the next step.
- Rebuild (Step 7): work only on the `redesign` branch, one task per session, reading only that task's plan section, design-guide section and prototype file. Never copy markup, CSS, names or wording from the old UI.
- After every rebuild task: tick its **Done** box in the implementation plan's §7.0 table and under its task heading in §7 (date, commit, real `/cost`), tick its rows in §5, §6 and §10, and when a phase's review passes, tick that phase in `redesign/redesign-plan.md`'s checklist.
- Design gaps: add them to §9.1 of the implementation plan, then write them as needs in `redesign/handoff/needs.md` (the design-gap loop). Never fill a gap from the old app.
