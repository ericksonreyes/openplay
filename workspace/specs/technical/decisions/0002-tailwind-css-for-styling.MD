# ADR-0002: Use Tailwind CSS Across the Web Frontends

## Status

Accepted

## Context

OpenPlay has four separate web frontends: a public Next.js site and player, venue, and Platform Administrator React portals. They must work on mobile and desktop screens and keep a consistent look.

## Decision

Use Tailwind CSS in all four web frontends.

- Use Tailwind utility classes for responsive layouts and interface elements.
- Keep shared design tokens and common presentation patterns consistent across the apps.
- Share presentation components where practical. Keep routing, authentication, and business logic within the app or backend that owns them.
- Keep styling separate from booking, payment, permission, and other business rules.
- This decision does not select a component library, icon set, final visual design, or the package format for shared components.

## Reasons

- Tailwind works with both Next.js and standalone React apps.
- Its responsive utilities support the mobile-first web experience.
- Shared design values help the separate apps look and behave consistently.

## Consequences

- Components may contain many utility classes. The team should extract shared components or patterns when repeated styling becomes hard to maintain.
- Separate apps must use compatible Tailwind settings and shared design values.
- Tailwind does not ensure accessible design by itself. The team must still provide keyboard support, visible focus states, readable contrast, and clear labels.
- The team must decide how to package and version shared presentation components.

## Alternatives considered

### CSS Modules or plain CSS

These options offer direct control over styles but require the team to define its own conventions for responsive styles and shared design patterns.

### A component library

A component library could provide ready-made interface elements. Choosing one is a separate decision and is not required to use Tailwind CSS.
