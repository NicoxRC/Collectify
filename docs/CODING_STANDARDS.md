# Coding Standards

This document defines naming conventions, code style, and structural conventions for both `api` and `client`. The goal is that any file in this codebase looks like it was written by the same person, regardless of who actually wrote it.

## Tooling

Both projects use **ESLint + Prettier**. Prettier handles formatting (indentation, quotes, semicolons); ESLint handles code quality rules (unused variables, import order, etc.). They are configured to not conflict with each other (`eslint-config-prettier` disables ESLint's formatting rules).

```bash
npm run lint         # check for issues
npm run lint:fix     # auto-fix what can be fixed
npm run format        # run Prettier across the project
```

**A PR with lint errors does not meet the Definition of Done** — see `DEFINITION_OF_DONE.md`.

## TypeScript

Both `api` and `client` use **TypeScript strict mode** (`"strict": true` in `tsconfig.json`). This means:

- No implicit `any` — every variable, parameter, and return type must be typeable
- Null/undefined must be handled explicitly (`strictNullChecks`)
- Class properties must be initialized or explicitly marked optional

### Avoid `any`

Using `any` defeats the purpose of TypeScript. If the type is genuinely unknown, use `unknown` and narrow it, rather than reaching for `any`.

```typescript
// ❌ Avoid
function parseInput(data: any) { ... }

// ✅ Prefer
function parseInput(data: unknown) {
  if (typeof data === 'string') { ... }
}
```

### Prefer interfaces/types over inline object shapes

```typescript
// ❌ Avoid
function createLoan(input: { amount: number; clientId: string; dueDate: Date }) { ... }

// ✅ Prefer
interface CreateLoanInput {
  amount: number;
  clientId: string;
  dueDate: Date;
}
function createLoan(input: CreateLoanInput) { ... }
```

## File naming conventions

| File type | Convention | Example |
|---|---|---|
| React components | PascalCase | `ClientForm.tsx`, `ClientsListPage.tsx` |
| Everything else (services, controllers, DTOs, entities, hooks, guards, utils) | camelCase | `clients.service.ts`, `createClient.dto.ts`, `jwtAuth.guard.ts`, `useClients.ts` |
| Test files | same name as the file it tests + `.spec.ts` | `clients.service.spec.ts` |
| Folders | camelCase, or lowercase single word when possible | `clients/`, `messageTemplates/`, `whatsapp/` |

### Note on NestJS type suffixes

For non-component files, keep the `.type.ts` suffix pattern (`.service.ts`, `.controller.ts`, `.module.ts`, `.dto.ts`, `.entity.ts`, `.guard.ts`, `.decorator.ts`, `.spec.ts`), with the descriptive part in camelCase:

```
clients.service.ts
clients.controller.ts
createClient.dto.ts
updateClient.dto.ts
client.entity.ts
jwtAuth.guard.ts
overdueReminder.cron.ts
```

## Naming conventions (identifiers)

| Element | Convention | Example |
|---|---|---|
| Variables, functions | camelCase | `calculateOverdueDays`, `clientList` |
| Classes, interfaces, types, React components | PascalCase | `ClientsService`, `CreateLoanInput`, `ClientForm` |
| Constants (true constants, not just `const` variables) | UPPER_SNAKE_CASE | `MAX_RETRY_ATTEMPTS`, `DEFAULT_PAGE_SIZE` |
| Enums | PascalCase name, PascalCase members | `enum LoanStatus { Active, Overdue, Paid }` |
| Interfaces | No `I` prefix — just PascalCase | `Client`, not `IClient` |
| Boolean variables | prefixed with `is`, `has`, `should` | `isActive`, `hasOverduePayments` |

## API (NestJS) standards

### DTO validation

Every DTO uses `class-validator` decorators. Never trust unvalidated input reaching a service.

```typescript
export class CreateClientDto {
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsPhoneNumber('CO')
  phoneNumber: string;

  @IsEmail()
  @IsOptional()
  email?: string;
}
```

### Services throw, controllers don't catch

Business logic errors are thrown as NestJS exceptions from the service. Controllers do not wrap calls in try/catch — the global exception filter (see `ARCHITECTURE.md`) handles formatting.

```typescript
// clients.service.ts
async findOne(id: string): Promise<Client> {
  const client = await this.clientsRepository.findOneBy({ id });
  if (!client) {
    throw new NotFoundException(`Client with id ${id} not found`);
  }
  return client;
}
```

### One responsibility per service method

If a method needs a comment to explain "and then it also does X," it should probably be split into two methods.

### Environment variables — never accessed directly

Never call `process.env.X` outside of `config/configuration.ts`. All configuration is centralized and typed there, then injected via NestJS's `ConfigService`.

```typescript
// ❌ Avoid — scattered across the codebase
const secret = process.env.JWT_SECRET;

// ✅ Prefer — centralized and typed
constructor(private configService: ConfigService) {}
const secret = this.configService.get<string>('jwt.secret');
```

## Client (React + Vite) standards

### Named exports, not default exports

Named exports make refactors and auto-imports more reliable across the codebase.

```typescript
// ❌ Avoid
export default function ClientForm() { ... }

// ✅ Prefer
export function ClientForm() { ... }
```

### Component props — always typed with an interface

```typescript
interface ClientFormProps {
  client?: Client;
  onSubmit: (data: CreateClientInput) => void;
}

export function ClientForm({ client, onSubmit }: ClientFormProps) { ... }
```

### Data fetching only through feature hooks

Components never call `fetch` or the API client directly. All data access goes through the feature's TanStack Query hooks (see `ARCHITECTURE.md`), keeping components focused on rendering.

```typescript
// ❌ Avoid — inside a component
useEffect(() => {
  fetch('/api/v1/clients').then(...)
}, []);

// ✅ Prefer
const { data: clients, isLoading } = useClients(page);
```

### Keep components small and focused

If a component file exceeds ~200 lines or mixes multiple concerns (e.g. a list, a modal, and a form all in one file), split it. Each file should be easy to understand without scrolling through unrelated logic.

## Import order

Both projects follow the same import grouping, separated by a blank line:

1. External packages (`react`, `@nestjs/common`, etc.)
2. Internal absolute imports (`@/features/...`, `src/common/...`)
3. Relative imports (`./`, `../`)
4. Type-only imports last within each group

```typescript
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/lib/apiClient';

import { ClientForm } from './ClientForm';

import type { Client } from './types';
```

ESLint's `import/order` rule enforces this automatically — running `npm run lint:fix` will reorder imports for you.

## Comments

Code should be self-explanatory through good naming. Comments are for **why**, not **what**:

```typescript
// ❌ Avoid — restates what the code already says
// increment count by one
count++;

// ✅ Prefer — explains non-obvious reasoning
// Meta's API caps template messages at 1024 characters; truncate defensively
// in case a future template exceeds this.
const safeMessage = message.slice(0, 1024);
```

Avoid commented-out code — delete it. Git history preserves it if it's ever needed again.

## Related documents

- `ARCHITECTURE.md` — folder structure and design decisions these standards apply to
- `TESTING.md` — how service logic covered by these standards should be tested
- `DEFINITION_OF_DONE.md` — lint passing is a merge requirement
