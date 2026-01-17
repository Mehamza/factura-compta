# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
 - Framer Motion
 - Supabase (Auth, DB, Edge Functions)

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

## Animations & UI Patterns

- Page transitions: implemented with `framer-motion` in `src/App.tsx` (`AnimatePresence` + `motion.div`).
- Buttons: subtle hover/tap scale; optional ripple via `ripple` prop on `Button` (requires keyframes in `src/index.css`).
- Cards/Rows/Alerts: entrance fade/slide via `framer-motion` in `ui` components.
- Forms: error messages shake; inputs highlight error/success using `aria-invalid`/`data-valid`.
- Loading: `Loader`, `LoadingOverlay`, and `TableSkeleton` components for consistent UX.
- Charts: `recharts` with `isAnimationActive` and eased durations.
- Reduced Motion: global `MotionConfig` set to `reducedMotion="user"`.

## Secure CSV Export (Admin)

An Edge Function `export_data` enforces Admin-only exports on the server.

Deploy:

```bash
supabase functions deploy export_data
```

Frontend usage falls back to client-side CSV if the function is unavailable.

## Supabase Post-deploy Health Check

These checks ensure `SUPER_ADMIN` detection works reliably in production.

### Apply DB migrations to remote

```bash
# Link your local repo to the remote Supabase project (run once)
supabase link --project-ref <YOUR_PROJECT_REF>

# Push local migrations/schema to the linked remote
supabase db push --linked
```

## Production Hosting Notes (SPA)

This app is a Vite single-page application (SPA). For production hosting:

```bash
npm ci
npm run typecheck
npm run build

# Local simulation of production serving
npm run start
```

Hosting requires an SPA rewrite rule so that unknown routes (e.g. `/clients`) serve `index.html`.
- **Nginx:** `try_files $uri $uri/ /index.html;`
- **Netlify:** add a catch-all redirect to `/index.html`
- **Cloudflare Pages / Vercel static:** enable SPA fallback

## Environment Variables

- Copy `.env.example` to `.env.local` (or set vars in your hosting provider).
- Do not commit `.env` files.
- `VITE_*` variables are public (bundled into the browser). Never put secrets there.

## Supabase Auth: Email Confirmation + Forgot Password

This app supports:
- Email confirmation after signup
- Forgot password (email link) + password reset

### App-side routes used by Supabase

- `https://www.smartfin.tn/auth/callback` (production)
- `http://localhost:5173/auth/callback` (local dev)

These routes are handled by `src/pages/AuthCallback.tsx` and will redirect users to:
- `/dashboard` after email confirmation
- `/auth?mode=reset` for password recovery

### Required public env var

Set this in production hosting so emails redirect to your official website:
- `VITE_APP_ORIGIN=https://www.smartfin.tn`

### Supabase Dashboard settings (hosted)

In Supabase Dashboard → Authentication → URL Configuration:
- **Site URL**: `https://www.smartfin.tn`
- **Redirect URLs**: add
	- `https://www.smartfin.tn/auth/callback`
	- `http://localhost:5173/auth/callback`

In Supabase Dashboard → Authentication → Providers:
- Enable **Email** provider
- Enable **Confirm email** (recommended)

### Sending emails from contact@smartfin.tn

To send Auth emails (confirmation + reset password) from `contact@smartfin.tn`, configure SMTP in:
Supabase Dashboard → Authentication → SMTP settings.

You must own/verify the domain `smartfin.tn` with your email provider.

### Verify `user_global_roles` table + RLS + policies

Run in Supabase SQL Editor (or via psql) as an admin/owner:

```sql
-- 1) Table exists?
select to_regclass('public.user_global_roles') as user_global_roles;

-- 2) RLS enabled?
select c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
	and c.relname = 'user_global_roles';

-- 3) Policies present?
select polname, cmd, roles
from pg_policies
where schemaname = 'public'
	and tablename = 'user_global_roles'
order by polname;
```

Expected:
- `user_global_roles` is not null.
- `rls_enabled = true`.
- A SELECT policy exists for `authenticated` users to read their own rows (commonly `ugr_select_own`).

### Verify a user is SUPER_ADMIN

```sql
select *
from public.user_global_roles
where user_id = '<USER_UUID>'
	and role = 'SUPER_ADMIN';
```
