# Contributing to Collectify

This document defines how we branch, commit, and merge code in this repository. Following these rules consistently is what allows anyone — including a developer joining the team for the first time — to understand the history of the project and collaborate without friction.

## Branching strategy — GitHub Flow

We use a simplified **GitHub Flow**: a single long-lived branch (`main`) plus short-lived feature branches. No `develop` branch, no `release` branches.

```
main
 ├── feature/COL-12-create-client-endpoint
 ├── fix/COL-19-mora-calculation-bug
 └── chore/COL-25-update-dependencies
```

### Rules

1. `main` is always deployable. Nothing broken ever lives on `main`.
2. Every piece of work starts from a branch off `main`.
3. Branches are short-lived — a few days at most. Long-lived branches drift and cause painful merges.
4. Once a branch is merged into `main` (via Pull Request), it must be deleted.

### Branch naming convention

```
<type>/<JIRA-TICKET-ID>-<short-description>
```

| Type | Use for |
|---|---|
| `feature/` | New functionality |
| `fix/` | Bug fixes |
| `chore/` | Maintenance tasks (deps, config, cleanup) |
| `refactor/` | Code changes that don't alter behavior |
| `docs/` | Documentation-only changes |

**Examples:**

```
feature/COL-14-loan-creation-endpoint
fix/COL-21-overdue-days-off-by-one
chore/COL-30-upgrade-nestjs
docs/COL-33-update-readme
```

The short description is lowercase, hyphen-separated, and in English.

## Commit convention — Conventional Commits + Jira ticket

Every commit must follow this format:

```
<type>(<scope>): <description> [<JIRA-TICKET-ID>]
```

### Types

| Type | Use for |
|---|---|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation only |
| `style` | Formatting, no code logic change (whitespace, semicolons) |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `test` | Adding or fixing tests |
| `chore` | Build process, dependencies, tooling |

### Scope

The module or area affected — e.g. `clients`, `loans`, `whatsapp`, `auth`, `dashboard`.

### Examples

```
feat(loans): add endpoint to register a payment [COL-14]
fix(whatsapp): correct overdue days calculation off-by-one [COL-21]
test(clients): add unit tests for client service [COL-18]
docs(readme): add local setup instructions [COL-05]
chore(deps): upgrade TypeORM to 0.3.20 [COL-30]
```

### Commit body (optional but encouraged for non-trivial changes)

```
feat(loans): add endpoint to register a payment [COL-14]

Adds POST /loans/:id/payments. Updates loan status to PAID
when the accumulated payments cover the full amount.
```

## Pull Request process

**Every change to `main` goes through a Pull Request. No direct pushes to `main`, ever — even for small changes, even with only two developers on the team.**

### Before opening a PR

- [ ] Your branch is up to date with `main` (rebase or merge `main` into your branch)
- [ ] All unit tests pass locally (`npm run test`)
- [ ] No linter errors (`npm run lint`)
- [ ] You've manually tested the change locally

### PR requirements

1. **Title** follows the same convention as commits: `feat(loans): add endpoint to register a payment [COL-14]`
2. **Description** must include:
   - What changed and why
   - Jira ticket link
   - Screenshots (for `client` changes with UI impact)
   - Any manual testing steps for the reviewer
3. **At least one approval** from the other developer is required before merging.
4. **All conversations must be resolved** before merging — no unresolved review comments.

### Merge strategy

- Use **Squash and Merge** when merging into `main`. This keeps `main`'s history clean — one commit per feature/fix, matching the PR title.
- Delete the branch immediately after merging.

### Reviewing a PR

When reviewing a teammate's PR:

- Pull the branch locally and test it if the change is non-trivial — don't approve from reading code alone when behavior is hard to verify by eye.
- Be specific in comments: point to the line, explain the concern, suggest an alternative if you have one.
- Approve only when you'd be comfortable if this code broke in production and your name was on the approval.

## Keeping your branch updated

If `main` has moved forward while you were working on your branch:

```bash
git checkout main
git pull origin main
git checkout feature/COL-14-loan-creation-endpoint
git rebase main
```

Resolve any conflicts, then force-push your branch (only ever force-push your **own** feature branch, never `main`):

```bash
git push --force-with-lease
```

## Quick reference

```bash
# Start new work
git checkout main
git pull origin main
git checkout -b feature/COL-14-loan-creation-endpoint

# Work, commit
git add .
git commit -m "feat(loans): add endpoint to register a payment [COL-14]"

# Push and open PR
git push -u origin feature/COL-14-loan-creation-endpoint
# Open PR on GitHub, request review, wait for approval

# After merge — clean up
git checkout main
git pull origin main
git branch -d feature/COL-14-loan-creation-endpoint
```
