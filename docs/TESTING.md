# Testing Standards

This document defines what must be tested, how, and to what level in the `api`. Frontend testing conventions will be added once the `client` test setup is defined.

## Testing framework

We use **Jest** — NestJS's default testing framework. It comes pre-configured when a NestJS project is scaffolded with the Nest CLI, so no additional setup is required.

## What must be tested

**Unit tests are mandatory for the Service layer.** Services contain the business logic — overdue day calculations, loan status transitions, message template rendering, WhatsApp sending logic. This is where bugs are most costly and where tests provide the most value.

Controllers, guards, and DTOs are **not required** to have dedicated unit tests at this stage. They are thin layers that mostly delegate to services, and are covered indirectly through manual testing and, later, through end-to-end tests (not in scope yet).

| Layer | Required? |
|---|---|
| Services | ✅ Mandatory |
| Controllers | ❌ Not required (for now) |
| Guards / Interceptors | ❌ Not required (for now) |
| Entities / DTOs | ❌ Not required (no logic to test) |

This scope may expand as the team grows — see `PROJECT_ROADMAP.md` for planned future testing improvements (e2e tests, CI/CD integration).

## No fixed coverage percentage

We are **not enforcing a minimum coverage percentage** (e.g. 80%) at this stage. Chasing a coverage number tends to produce shallow, low-value tests written just to hit the metric.

Instead, the standard is: **every method in a service that contains a decision, a calculation, or a business rule must have at least one test covering its expected behavior, plus tests for its edge cases.**

## What a good service test covers

For each public method in a service, tests should cover:

1. **The happy path** — normal input, expected output.
2. **Edge cases** — boundary values (e.g. exactly 0 days overdue, exactly on the due date).
3. **Error cases** — invalid input, entity not found, business rule violations (should throw the expected exception).
4. **Any branching logic** — if the method has an `if/else`, both branches need a test.

### Example — testing the overdue calculation logic

```typescript
// loans.service.spec.ts

describe('LoansService', () => {
  let service: LoansService;
  let repository: Repository<Loan>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoansService,
        {
          provide: getRepositoryToken(Loan),
          useValue: mockLoanRepository, // see "Mocking" section below
        },
      ],
    }).compile();

    service = module.get<LoansService>(LoansService);
    repository = module.get<Repository<Loan>>(getRepositoryToken(Loan));
  });

  describe('calculateOverdueDays', () => {
    it('should return 0 when the due date is today', () => {
      const dueDate = new Date();
      expect(service.calculateOverdueDays(dueDate)).toBe(0);
    });

    it('should return 0 when the due date is in the future', () => {
      const dueDate = addDays(new Date(), 5);
      expect(service.calculateOverdueDays(dueDate)).toBe(0);
    });

    it('should return the correct number of days when the due date has passed', () => {
      const dueDate = subDays(new Date(), 10);
      expect(service.calculateOverdueDays(dueDate)).toBe(10);
    });
  });

  describe('registerPayment', () => {
    it('should mark the loan as PAID when the accumulated payment covers the full amount', async () => {
      // arrange, act, assert
    });

    it('should keep the loan as ACTIVE when the payment is partial', async () => {
      // arrange, act, assert
    });

    it('should throw NotFoundException when the loan does not exist', async () => {
      // arrange, act, assert
    });
  });
});
```

## Mocking

- **Never hit a real database in a unit test.** Mock the TypeORM repository using `getRepositoryToken()` and a mock object (see example above).
- **Never make a real call to Meta Cloud API in a unit test.** Mock `WhatsAppService` when testing anything that depends on it.
- Use Jest's `jest.fn()` and `jest.spyOn()` for mocking individual methods.
- Keep mocks close to the test file — avoid a shared "god mock" file that every test imports, since it becomes a hidden coupling point between unrelated tests.

## File naming and location

Test files live **next to the file they test**, with a `.spec.ts` suffix:

```
src/
└── loans/
    ├── loans.service.ts
    ├── loans.service.spec.ts
    ├── loans.controller.ts
    └── loans.module.ts
```

## Running tests

```bash
npm run test          # run all unit tests once
npm run test:watch    # re-run on file changes, useful during development
npm run test:cov      # run with a coverage report (informational, not enforced)
```

## Definition of Done requirement

Per `DEFINITION_OF_DONE.md`, a Pull Request that adds or modifies business logic in a service **cannot be merged without corresponding unit tests.** The reviewer should treat "no tests for new service logic" as a blocking comment, not a suggestion.

## Out of scope (for now)

The following are intentionally not part of the current testing strategy, but are worth revisiting as the team and project grow:

- End-to-end (e2e) tests
- Frontend component/unit tests
- CI/CD pipeline running tests automatically on every PR
- Fixed coverage thresholds

These are tracked as future improvements in `PROJECT_ROADMAP.md`.
