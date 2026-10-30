# ADR-0001: Separate the Public Site and Portal Frontends

## Status

Accepted

## Context

OpenPlay needs public Business Profile Pages and event pages, plus separate player, venue, and Platform Administrator portals. These frontends have different audiences and access needs.

React is a library for building user interfaces. Next.js is a web framework built on React. It adds routing and server rendering, which help public pages appear in search results and link previews. A standalone React app can serve the interactive portals.

All four frontends call the OpenPlay backend API. The backend is the only application that reads or writes business data.

## Decision

Build four separate web frontends:

- A **Next.js public site** for published business profiles, venue information, public events, and public discovery pages.
- A **React player portal** for signed-in player workflows.
- A **React venue portal** for Business Owners, venue managers, and delegated staff.
- A **React Platform Administrator portal** for authorized platform operations.

Next.js and the portals use React components. The portals are separate applications; their router and build tool remain open.

- All four frontends use the NestJS backend API. Public data access, portal permissions, database boundaries, and caching rules are defined in [ADR-0004](0004-nestjs-backend-api.MD).
- Use Tailwind CSS across all four frontends as recorded in [ADR-0002](0002-tailwind-css-for-styling.MD).
- Native iOS and Android apps remain outside this decision.

## Reasons

- Next.js supports search-friendly public pages, while standalone React apps suit the interactive portals.
- Separate apps let each audience have its own routes, release cycle, and access-focused interface.
- All apps still use React, so common presentation components and skills can be shared.

## Consequences

- Each frontend needs its own build, local setup, configuration, and release process.
- The team must keep API contracts, styling, and shared presentation components consistent across apps.
- The public Next.js server must fetch content through backend APIs. It must not use database credentials or query backend tables directly.
- Cache rules must protect private data and keep time-sensitive availability and prices current.
- Backend APIs remain responsible for authorization and all business decisions.

## Alternatives considered

### One Next.js app for all users

This could reduce the number of applications to build and deploy. It was not selected because OpenPlay will keep the public site and the three portals separate.

### React-only public site

A client-rendered React site could show public content, but it would need extra work to support search indexing and rich link previews. Next.js is selected for the public site.
