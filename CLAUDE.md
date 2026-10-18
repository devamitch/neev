@AGENTS.md

# Claude Code — BlinkQuest

`AGENTS.md` is the contract and map; don't duplicate it here.

- Re-read files before editing; other agents work in this repo in parallel.
- pnpm only. Repo deny rules block `rm -rf`, `git reset --hard`, `git clean`, editing `android/`, reading `build/` — work around them, don't fight them.
- Feature-wise commits are authorized; never push.
- Don't run a Gradle build while another one is running on this project.
- With two adb transports (USB + wireless), pass `-s <serial>`.
