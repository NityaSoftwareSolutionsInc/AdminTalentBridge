# Admin-Talent-Bridge

Platform **Global Admin** app for TalentBridge. Creates and enables/disables tenants, and invites the first tenant Administrator via SendGrid.

TalentBridge Contact Manager (`C:\Office\Talent-Bridge`) is the tenant workspace. This app sits above tenants.

## Prerequisites

1. PostgreSQL from Talent-Bridge (`npm run db:up` in Talent-Bridge)
2. Schema migrations / `prisma db push` run **from Talent-Bridge** (this repo does not own migrations)
3. Seed Global Admin from Talent-Bridge: `npm run db:seed`

Default Global Admin (after seed):

- Email: `global.admin@talentbridge.example`
- Password: `ChangeMe123!`

## Setup

```bash
cp .env.example .env
# Point DATABASE_URL at the same DB as Talent-Bridge
npm install
npm run dev
```

App runs at [http://localhost:3002](http://localhost:3002).

## Env

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Same Postgres as Talent-Bridge |
| `AUTH_JWT_SECRET` | Platform session JWT (≥16 chars) |
| `APP_BASE_URL` | This admin app URL |
| `TALENTBRIDGE_APP_BASE_URL` | TalentBridge URL used in invite set-password links |
| `SENDGRID_API_KEY` / `SENDGRID_FROM_EMAIL` | Invitation email; stub mode if unset |

## MVP actions

- Sign in as Global Admin
- List / create tenants
- Enable / disable tenants (disabled tenants cannot sign in to TalentBridge)
- Create first tenant Admin + SendGrid invite (link opens TalentBridge `/set-password`)
- Resend invite

## Schema note

Slim Prisma models in `prisma/schema.prisma` mirror Talent-Bridge tables needed here (`platform_admins`, `tenants`, etc.). Always apply schema changes in Talent-Bridge first, then update this slim schema to match.
