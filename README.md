# Welcome to your Lovable project

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS

## Overdue Scan Cron

The endpoint `POST /api/public/hooks/overdue-scan` generates upcoming-delivery
reminders (24h / 4h / 1h) and overdue notifications. It requires a Bearer
token stored in Supabase Vault under the name `OVERDUE_SCAN_SECRET`.

- The token is generated automatically the first time the migration runs
  (random 48-byte hex) and never leaves the database.
- The endpoint validates each request by calling the security-definer
  function `public.verify_overdue_scan_secret(_token)`, which reads the
  value from `vault.decrypted_secrets` and does a constant-time compare.
- The `pg_cron` job `elsewedy-overdue-scan` runs every hour at minute 0 and
  posts to the endpoint with `Authorization: Bearer <vault secret>`.
- No frontend or public env var ever holds the secret.

To rotate the secret, delete the row in `vault.secrets` where
`name = 'OVERDUE_SCAN_SECRET'` and re-run the migration — a fresh value
will be generated and the cron will keep working (it reads from Vault at
call time).

All delivery deadlines are computed in the `Africa/Cairo` timezone via the
`set_task_due_at` trigger, which combines `delivery_due_date` and
`delivery_due_time`.
