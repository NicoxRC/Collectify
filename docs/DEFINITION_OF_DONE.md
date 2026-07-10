# Definition of Done

A task is **not done** just because the code works on your machine. This document defines the minimum bar every Pull Request must meet before it can be merged into `main`. This applies to every task, regardless of size — a one-line fix and a full new module both go through the same checklist.

## Checklist before opening a Pull Request

- [ ] Code implements everything described in the Jira ticket's acceptance criteria
- [ ] Branch follows the naming convention in `CONTRIBUTING.md`
- [ ] Commits follow Conventional Commits + Jira ticket ID
- [ ] Branch is up to date with `main` (rebased, no conflicts)
- [ ] `npm run lint` passes with no errors
- [ ] `npm run test` passes with no failures
- [ ] **New or modified service logic has corresponding unit tests** (see `TESTING.md`) — no exceptions
- [ ] New endpoints are documented with Swagger decorators (see below)
- [ ] No `console.log`, commented-out code, or leftover debug code
- [ ] Environment variables, if any were added, are reflected in `.env.example` and `ENVIRONMENT_VARIABLES.md`
- [ ] You have manually run and tested the change yourself locally

## Swagger documentation requirement

Every new endpoint added to the API must be documented using `@nestjs/swagger` decorators before the PR is opened:

- `@ApiTags()` on the controller
- `@ApiOperation()` describing what the endpoint does
- `@ApiResponse()` for at least the success case and the most relevant error case
- DTOs annotated with `@ApiProperty()` so request/response shapes appear correctly in the Swagger UI

A PR that adds an endpoint without Swagger documentation is not done, even if the endpoint works correctly.

## Checklist for the reviewer

The reviewer is not just approving — they're the second gate before anything reaches `main`. Reviewing means reading the code closely, not skimming and clicking approve.

- [ ] The PR description clearly explains what changed and why
- [ ] The code matches what the Jira ticket asked for — nothing missing, nothing extra and unrelated
- [ ] Tests exist for any new business logic and actually test meaningful cases (see `TESTING.md`), not just the happy path
- [ ] No obvious bugs, edge cases, or security issues (e.g. missing input validation, exposed sensitive data)
- [ ] Naming and structure follow `CODING_STANDARDS.md`
- [ ] All review comments are resolved before approving

Manually running the branch locally is **not required** by default at this stage (no CI/CD yet), but is strongly recommended for any change to critical logic — payment registration, overdue calculation, WhatsApp sending. Use your judgment: if a bug here would be costly, take the two extra minutes to run it.

## After merge

- [ ] Branch is deleted
- [ ] Jira ticket is moved to "Done"
- [ ] If the change affects how the project is run locally (new env var, new dependency, new setup step), the relevant teammate is notified so they can pull `main` and update their local setup

## What "Done" does NOT mean

Being "done" does not require, at this stage:

- Passing through a CI/CD pipeline (not yet implemented — see `PROJECT_ROADMAP.md`)
- End-to-end or integration tests
- A fixed test coverage percentage
- Deployment to production (deployment is a separate step, not part of a single task's Definition of Done)

These will be incorporated into this document as the project and team grow.
