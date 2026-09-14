# Admin-Talent-Bridge

Platform **Global Admin / Manager / Support** app for TalentBridge. Creates and enables/disables tenants, invites the first tenant Administrator via SendGrid, and handles Help & Support tickets from TalentBridge.

TalentBridge Contact Manager (`C:\Office\Talent-Bridge`) is the tenant workspace. This app sits above tenants.

## Prerequisites

1. PostgreSQL from Talent-Bridge (`npm run db:up` in Talent-Bridge)
2. Schema migrations / `prisma db push` run **from Talent-Bridge** (this repo does not own migrations)
3. Seed platform admins from Talent-Bridge: `npm run db:seed` (admins only — create tenants in this app)

Default accounts (after seed), password `ChangeMe123!`:

- Global Admin: `global.admin@talentbridge.example`
- Manager: `manager@talentbridge.example`
- Support: `support@talentbridge.example`

## Setup

```bash
cp .env.example .env
# Point DATABASE_URL at the same DB as Talent-Bridge
npm install
npm run dev
```

App runs at [http://localhost:3012](http://localhost:3012). Uses the same Postgres as Talent-Bridge (`127.0.0.1:5435`).

### Production / Dev server via Docker

Prefer starting from Talent-Bridge (sibling folder required):

```bash
cd ../Talent-Bridge
cp .env.docker.example .env
npm run docker:up
```

Admin is built from this repo’s `Dockerfile` and published on `127.0.0.1:3012`.

## Env

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Same Postgres as Talent-Bridge |
| `AUTH_JWT_SECRET` | Platform session JWT (≥16 chars) |
| `APP_BASE_URL` | This admin app URL |
| `TALENTBRIDGE_APP_BASE_URL` | TalentBridge URL used in invite set-password links |
| `SENDGRID_API_KEY` / `SENDGRID_FROM_EMAIL` | Invitation and ticket emails; stub mode if unset |

## Roles

- **Global Admin** — all tenant operations; invite/manage platform users
- **Manager** — create tenants; full control only on tenants they created
- **Support** — tickets from TalentBridge Help & Support; read-only tenant support access

## MVP actions

- Sign in as Global Admin, Manager, or Support
- List / create tenants (Global Admin and Manager)
- Enable / disable tenants they may mutate (disabled tenants cannot sign in to TalentBridge)
- Create first tenant Admin + SendGrid invite (link opens TalentBridge `/set-password`)
- Resend invite
- Support tickets: reply, assign, resolve; requester sees the thread in TalentBridge Help and gets email

## Schema note

Slim Prisma models in `prisma/schema.prisma` mirror Talent-Bridge tables needed here (`platform_admins`, `tenants`, `platform_support_tickets`, etc.). Always apply schema changes in Talent-Bridge first, then update this slim schema to match.
