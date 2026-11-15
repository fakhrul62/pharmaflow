# Pharmacy workspace design

Approved direction: the user accepted the design and stack in chat and instructed full implementation without questions.

## Intent

Build a new pharmacy inventory and management application using the existing PharmaLy template as the feature reference. Preserve its module coverage, replace simulated actions with persistent operations, and prioritize speed and usability. The reference directory remains untouched.

## Experience

Light canvas, navy navigation, teal actions, readable compact tables, restrained borders, meaningful warning colors. Overview surfaces actionable sales, stock and expiry metrics. Inventory provides search, filters, details, batches, categories, brands, units, stock levels, adjustments, transfers, and barcodes. Checkout has searchable products, cart, customers, payment recording and printable receipts. Cover sales, returns, invoices, quotations, purchases, receiving, suppliers, customers and groups, prescriptions, finance, reports, staff, settings, notifications and help. Responsive navigation, keyboard focus, accessible dialogs, loading, empty and error states are required.

## Approaches

A direct frontend port would retain many disconnected demo actions. A new React/Vite frontend with a NestJS API and relational database requires more work but produces consistent operational workflows; this is the selected direction. A new visual design replaces the reference's layout while preserving its domain concepts and useful sample assets.

## Architecture

TypeScript npm workspace with apps/web (React, Vite, React Router, Tailwind, Radix, TanStack Query/Table, React Hook Form, Zod, Recharts), apps/api (NestJS, Prisma, PostgreSQL, Argon2 cookie sessions, validation and server permissions), and packages/shared (API contracts). Docker Compose supplies PostgreSQL. Local seed contains clearly fictional demonstration records. Use database transactions for stock and money, integer minor currency units, validated DTOs, authenticated API access, role enforcement, same-origin CSRF protection, audit history, indexed queries and paginated lists. Lazy load substantial screens. Payment methods record payments; external payment gateways and email delivery are not integrated.

## Builder decisions

Working name PharmaFlow; configurable currency defaults to USD to preserve sample meaning, timezone Asia/Dhaka. All module operations use a common validated resource interface where appropriate and dedicated transaction endpoints for checkout, receiving, returns, stock movement. Authentication has a seeded local admin, real hashed password and session expiry. Document any hosting requirements, email limitations and demo credentials clearly. Production must reject local default credentials.

## Verification

Build and typecheck both applications. Integration tests prove login protection, validation, stock depletion, oversell rejection, expired batch exclusion, purchase receipt, returns, persistence, and restricted access. Browser tests exercise dashboard, inventory create/search, checkout, responsive layout and navigation.
