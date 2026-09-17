# Ethio Electric Vehicles

Static Vite site with a Supabase database, authentication, storage, and realtime updates.

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste all of [supabase-schema.sql](supabase-schema.sql), and run it once.
3. Open **Project Settings -> API** and copy the project URL and the `anon` public key into [js/supabase-config.js](js/supabase-config.js).
4. Open **Authentication -> Users**, choose **Add user**, and create the private admin email and password used by [admin.html](admin.html). Do not create a public sign-up form.
5. Confirm these storage buckets exist under **Storage**:
   - `vehicle-images` - public, for catalog images.
   - `customer-documents` - private, for identity files, photos, and payment receipts.
6. Confirm **Database -> Publications -> supabase_realtime** includes `vehicles`, `purchase_applications`, and `site_settings`. The SQL schema adds them automatically.
7. In **Authentication -> URL Configuration**, add the deployed site URL. For local testing, use the URL printed by Vite, usually `http://localhost:3000`.

## Run locally

Prerequisite: Node.js.

```bash
npm install
npm run dev
```

Open `http://localhost:3000` for the public site and `http://localhost:3000/admin.html` for the dashboard.

## Supabase file map

- [js/supabase-config.js](js/supabase-config.js) creates the browser client.
- [js/vehicles.js](js/vehicles.js) reads `vehicles` and listens for vehicle realtime changes.
- [js/purchase.js](js/purchase.js) uploads customer documents, inserts `purchase_applications`, and listens for `site_settings` changes.
- [js/admin.js](js/admin.js) handles email/password login, vehicle CRUD, signed document URLs, settings, and admin realtime updates.
- [index.html](index.html) loads the public Supabase CDN and scripts in the required order.
- [admin.html](admin.html) loads the admin Supabase CDN and scripts in the required order.
- [supabase-schema.sql](supabase-schema.sql) creates tables, indexes, RLS policies, buckets, storage policies, realtime publication entries, and seed data.

## Important security note

The current SQL policies allow any authenticated Supabase user to use admin operations. Keep user creation restricted to the project owner. For multiple staff accounts, add an admin allow-list or roles table and change every `to authenticated` admin policy to check that table. Never put a Supabase `service_role` key in this browser application.

The `anon` key is designed to be public, but it is only safe when the RLS and Storage policies are correct.
