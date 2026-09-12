# SYORA canonical workspace guard

- Perform all SYORA development, Git operations, validation, commits, and pushes only from `C:\KUMARS-SPACE-ORIGINAL\MY PROJECTS\confidential_web`.
- Before any mutation, confirm `git rev-parse --show-toplevel` resolves exactly to `C:/KUMARS-SPACE-ORIGINAL/MY PROJECTS/confidential_web`. Stop if it does not.
- `C:\KUMARS-SPACE-ORIGINAL\Personal-Space` is provenance-only. Do not develop, restore, merge, commit, or validate there.
- Do not copy `.git` metadata between folders or initialize a replacement repository inside another SYORA directory.
- Preserve the password-recovery and Resend work from commits `254f897` and `e726c87`.
- Preserve domain-owned styles under `frontend/src/styles`; keep component files focused on markup, behavior, state, and accessibility.
- Keep local environment files ignored. Never print, copy into tracked files, or commit their contents.
