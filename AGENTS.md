<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Git workflow

- After completing every requested code, configuration, or documentation change, run the relevant verification, commit the completed change with a descriptive message, and push it to the current branch's configured upstream remote.
- Add a dated entry at the top of `CHANGELOG.md`: one to three lines on what changed and why, naming the main files. Put test counts, the checks run and design detail in the commit body instead. Don't read the whole change log; it's long and loads nothing you need. Read only the top few entries if you need recent context.
- The change log moved out of this file on 2026-10-18, because this file loads into every session. If a merge conflicts here because a branch still added its entry under "## Change log" in this file, keep this version and move the entry, shortened, to the top of `CHANGELOG.md`.
