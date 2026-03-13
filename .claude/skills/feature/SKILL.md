---
name: feature
description: Manage current feature workflow - spec, plan, start, test, review or complete
argument-hint: spec|plan|start|test|review|complete
---

# Feature Workflow

Manages the full lifecycle of a feature from spec to merge.

## Working File

@context/current-feature.md

### File Structure

current-feature.md has these sections:

- `# Current Feature` - H1 heading
- `## Current Feature Spec File` - Spec file for feature
- `## Current Feature Plan File` - Technical plan file for feature
- `## History` - Completed features (append only)

## Task

Execute the requested action: $ARGUMENTS

| Action | Description |
|--------|-------------|
| `spec` | Create a spec for an inline description |
| `plan` | Create a plan for the spec, create branch |
| `start` | Begin implementation |
| `test` | Test implementation |
| `review` | Check goals met, code quality |
| `complete` | Commit, push, merge, reset |

See [actions/](actions/) for detailed instructions.

If no action provided, explain the available options.