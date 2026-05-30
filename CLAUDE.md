# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Tarebar Smart Monitoring Platform** is a smart management system for fruit and vegetable markets (میادین میوه و تره‌بار). It manages the hierarchy of Fields → Markets → Booths, plus users, cameras, and real-time monitoring.

All 9 sprints are complete. The full application is implemented and production-ready.

## Tech Stack

- **Framework:** Next.js 15 (App Router) with TypeScript strict mode
- **UI:** TailwindCSS + shadcn/ui components
- **Auth:** Auth.js + JWT
- **Database:** PostgreSQL with Prisma ORM
- **API:** Next.js Route Handlers (REST, no separate backend service)
- **Validation:** Zod (all inputs)
- **Forms:** React Hook Form
- **Server state:** TanStack Query
- **Client state:** Zustand
- **Logging:** Pino

## Architecture

**Modular Monolith** — one Next.js app with clear module boundaries per domain entity. No microservices.

**Data hierarchy:**
```
Field → Market → Booth
```

**Core entities:** Field, Market, Booth, BoothCategory, User, Role, UserScope, Camera

**Authorization model:** RBAC + Scope-based. Three roles: `ORG_ADMIN`, `FIELD_MANAGER`, `MARKET_MANAGER`. UserScope links users to specific Fields/Markets they can manage.

**All deletes are soft deletes** — never hard delete records from the database.

## Commands (once scaffolded)

```bash
# Development
npm run dev

# Build
npm run build

# Lint
npm run lint

# Type check
npx tsc --noEmit

# Database migrations
npx prisma migrate dev

# Prisma Studio
npx prisma studio

# Run tests
npm test

# Run single test file
npm test -- path/to/test.spec.ts
```

## Coding Rules

- TypeScript strict mode everywhere — `any` is forbidden
- All API inputs validated with Zod schemas before touching the database
- Forms use React Hook Form; never manage form state manually
- Data fetching in components uses TanStack Query (`useQuery`, `useMutation`)
- Global/shared client state uses Zustand stores
- Log with Pino — structured JSON logs, not `console.log`
- Follow SOLID, DRY, KISS, YAGNI — no speculative abstractions

## MVP Feature Scope

Authentication, RBAC, Field Management, Market Management, Booth Management, Booth Category Management, User Management, Camera Management, Monitoring, Dashboard, Reports, Settings.

**Dashboard widgets:** Total Fields, Total Markets, Total Booths, Total Cameras, Online Cameras count, Offline Cameras count.

## Sprint Sequence

1. ✅ Authentication + Layout + RBAC
2. ✅ Field Module
3. ✅ Market Module
4. ✅ Booth + BoothCategory
5. ✅ User Management
6. ✅ Camera Management
7. ✅ Monitoring
8. ✅ Reports + Dashboard
9. ✅ Testing + Docker + Documentation
