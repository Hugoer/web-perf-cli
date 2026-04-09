---
name: finish-task
description: Describe what this skill does and when to use it. Include keywords that help agents identify relevant tasks.
---
# Finish task

## Objectives
1. **Documentation Persistence:** Ensure all architectural decisions and project knowledge are saved in the repository.
2. **Atomic Version Control:** Execute a clean, standardized commit for the work completed.
3. **Token Hygiene:** Prepare the environment for a full context reset to minimize API costs.

## Execution Flow

### Step 1: Documentation Update
Analyze the changes made during this session and update the following files:
- **`README.md`**: Update if there are changes to installation, usage, or core features.
- **`CLAUDE.md`**: Update if new patterns, specific test commands, or project-wide rules were established. Ensure this file acts as the "long-term memory" for future sessions.

### Step 2: Standardized Commit (Strict Mode)
Stage the relevant files and generate a commit message following this exact schema:

`<type>(<scope>): <short summary>`

**Constraints:**
- **type**: Choose strictly from: `build`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`, `test`.
- **scope**: Optional, if present, choose strictly from: `lab`, `psi`, `crux`, `crux-history`, `sitemap`, `links`, `cli`, `prompts`, `profiles`, `utils`.
- **summary**: Use present tense, lowercase only, no trailing period.

*Example:* `feat(sitemap): add automated priority calculation`

### Step 3: Shutdown Protocol (Cost Optimization)
Once the commit is successful and documentation is updated:
1. Briefly state the most important context to keep in mind for the next session.
2. **Reset Instruction:** You MUST explicitly prompt the user to clear the session, run **/clear**

> [!IMPORTANT]
> Avoid `/compact`. To ensure maximum token savings, the final response must conclude with:
> **"Work finalized. Documentation and commit are synced. Please run `/clear` now to reset the context and stop token consumption."**