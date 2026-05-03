# Contributing to CompliGuard v2

Thank you for your interest in contributing to CompliGuard v2. This document covers the development workflow, code standards, and contribution process.

---

## Prerequisites

- Node.js 20+
- PostgreSQL 16
- Redis 7
- Docker + Docker Compose (optional, for full stack)
- Git

---

## Development Setup

```bash
# 1. Fork and clone
git clone https://github.com/YOUR_USERNAME/compliguard-v2
cd compliguard-v2

# 2. Install dependencies
npm install --legacy-peer-deps

# 3. Set up environment
cp .env.example .env.local
# Edit .env.local — set DATABASE_URL, JWT_SECRET, STORAGE_LOCAL_DIR

# 4. Run migrations and seed
npm run db:migrate
npm run db:seed

# 5. Start development server
npm run dev
```

---

## Branch Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Production-ready code. Protected — requires PR. |
| `develop` | Integration branch for features. |
| `feature/*` | New features. Branch from `develop`. |
| `fix/*` | Bug fixes. Branch from `develop` or `main`. |
| `hotfix/*` | Critical production fixes. Branch from `main`. |

```bash
# Create a feature branch
git checkout develop
git pull origin develop
git checkout -b feature/your-feature-name
```

---

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>

[optional body]

[optional footer]
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `ci`

**Examples:**
```
feat(evidence): add bulk upload endpoint
fix(auth): handle expired JWT tokens correctly
docs(readme): update docker compose quickstart
test(rbac): add missing edge cases for super_admin
```

---

## Code Standards

### TypeScript

- Strict mode enabled — no `any` without explicit justification
- All functions must have explicit return types on public APIs
- Use `interface` for object shapes, `type` for unions/intersections
- Prefer `const` over `let`; avoid `var`

### API Routes

- All API routes must use `requireAuth()` from `lib/api/auth-helper.ts`
- Write an audit log entry for all mutating operations
- Return consistent error shapes: `{ error: string, code?: string }`
- Handle database errors — never let raw Postgres errors reach the client

### Database

- All schema changes must have a corresponding Drizzle migration
- Never modify existing migration files — create new ones
- Use `db:generate` to generate migrations from schema changes
- Seed data goes in `seed/frameworks/` as JSON files

### Components

- Use shadcn/ui components as the base layer
- Keep components focused — one responsibility per file
- Use `"use client"` only when necessary (prefer Server Components)
- All form submissions should show loading states and error handling

---

## Testing

```bash
# Run all unit tests
npm run test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# E2E tests (requires running app)
npm run test:e2e
```

**Coverage requirements:**
- Lines: 60%
- Functions: 60%
- Branches: 50%

New features should include unit tests. Bug fixes should include a regression test.

---

## Pull Request Process

1. Ensure all tests pass: `npm run test`
2. Ensure TypeScript is clean: `npm run typecheck`
3. Ensure lint passes: `npm run lint`
4. Update `CHANGELOG.md` under `[Unreleased]`
5. Open PR against `develop` (not `main`)
6. Fill out the PR template completely
7. Request review from a maintainer

PR title should follow the same Conventional Commits format as commit messages.

---

## Adding a New Framework

1. Create `seed/frameworks/{slug}.json` following the existing schema
2. Required fields: `id`, `name`, `slug`, `version`, `description`, `authority`, `category`, `website`, `is_active`, `controls`
3. Each control needs: `ref`, `title`, `description`, `category`, `weight` (1-3)
4. Run `npm run db:seed` to verify it loads without errors
5. Add the framework to the table in `README.md`

---

## Adding a New Storage Provider

1. Create `lib/storage/providers/{provider-name}.ts`
2. Implement the `StorageProvider` interface from `lib/storage/types.ts`
3. Add the new type to `StorageProviderType` in `types.ts`
4. Register it in the factory in `lib/storage/index.ts`
5. Add corresponding env vars to `.env.example`
6. Add a test entry for the `test-storage` setup wizard API route

---

## Security Reporting

Do **not** open a public GitHub issue for security vulnerabilities.

Email security reports to the maintainer directly. Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested mitigations

---

## Code of Conduct

This project adheres to the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold these standards.
