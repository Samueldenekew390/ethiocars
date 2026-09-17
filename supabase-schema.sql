-- ==========================================================
-- ኢትዮ ኤሌክትሪክ መኪኖች አስመጭና አከፋፋይ (Ethio Electric Vehicles)
-- COMPLETE SUPABASE SQL SCHEMA & ROW LEVEL SECURITY (RLS)
-- Paste this entire script into the Supabase SQL Editor and click RUN.
-- ==========================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ----------------------------------------------------------
-- 1. VEHICLES TABLE (የመኪና ሞዴሎች ሰንጠረዥ)
-- ----------------------------------------------------------
create table if not exists public.vehicles (
    id uuid primary key default gen_random_uuid(),
    model_name text not null,
    seats integer not null default 5,
    price_etb numeric not null default 0,
    range_km numeric not null default 0,
    motor_battery_capacity text not null,
    max_speed numeric not null default 0,
    description text,
    image_url text,
    image_path text,
    available boolean default true,
    featured boolean default false,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Index for speed
create index if not exists idx_vehicles_available on public.vehicles(available);
create index if not exists idx_vehicles_created_at on public.vehicles(created_at desc);

-- ----------------------------------------------------------
-- 2. PURCHASE APPLICATIONS TABLE (የግዢ ማመልከቻዎች ሰንጠረዥ)
-- ----------------------------------------------------------
create table if not exists public.purchase_applications (
    id uuid primary key default gen_random_uuid(),
    vehicle_id uuid references public.vehicles(id) on delete set null,
    vehicle_model_name text not null,
    vehicle_price_etb numeric not null,
    identity_file_path text not null,
    photo_file_path text not null,
    receipt_file_path text not null,
    phone_number text not null,
    destination_country text not null default 'ኢትዮጵያ (አዲስ አበባ)',
    registration_date date not null default current_date,
    status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'deleted')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Index for admin queries
create index if not exists idx_applications_status on public.purchase_applications(status);
create index if not exists idx_applications_created_at on public.purchase_applications(created_at desc);

-- ----------------------------------------------------------
-- 3. SITE SETTINGS TABLE (የድር ጣቢያ ቅንብሮች ሰንጠረዥ)
-- ----------------------------------------------------------
create table if not exists public.site_settings (
    id uuid primary key default gen_random_uuid(),
    setting_key text unique not null,
    setting_value text not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ----------------------------------------------------------
-- 4. AUTO-UPDATE TIMESTAMP FUNCTION & TRIGGERS
-- ----------------------------------------------------------
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_vehicles_updated_at on public.vehicles;
create trigger set_vehicles_updated_at
before update on public.vehicles
for each row execute procedure public.handle_updated_at();

drop trigger if exists set_applications_updated_at on public.purchase_applications;
create trigger set_applications_updated_at
before update on public.purchase_applications
for each row execute procedure public.handle_updated_at();

drop trigger if exists set_settings_updated_at on public.site_settings;
create trigger set_settings_updated_at
before update on public.site_settings
for each row execute procedure public.handle_updated_at();

-- ----------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------
alter table public.vehicles enable row level security;
alter table public.purchase_applications enable row level security;
alter table public.site_settings enable row level security;

-- Enable realtime events for the tables used by the website and admin dashboard
do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
            and schemaname = 'public'
            and tablename = 'vehicles'
    ) then
        alter publication supabase_realtime add table public.vehicles;
    end if;

    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
            and schemaname = 'public'
            and tablename = 'purchase_applications'
    ) then
        alter publication supabase_realtime add table public.purchase_applications;
    end if;

    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
            and schemaname = 'public'
            and tablename = 'site_settings'
    ) then
        alter publication supabase_realtime add table public.site_settings;
    end if;
end;
$$;

-- Vehicles policies:
-- Anyone (anon and authenticated) can view available vehicles
create policy "Public users can view available vehicles"
on public.vehicles for select
to anon, authenticated
using (available = true or auth.role() = 'authenticated');

-- Authenticated admins have full CRUD on vehicles
create policy "Admins can insert vehicles"
on public.vehicles for insert
to authenticated
with check (true);

create policy "Admins can update vehicles"
on public.vehicles for update
to authenticated
using (true)
with check (true);

create policy "Admins can delete vehicles"
on public.vehicles for delete
to authenticated
using (true);

-- Purchase Applications policies:
-- Anyone can submit a purchase application (insert)
create policy "Anyone can submit a purchase application"
on public.purchase_applications for insert
to anon, authenticated
with check (true);

-- ONLY authenticated admins can select/view applications
create policy "Only authenticated admins can view applications"
on public.purchase_applications for select
to authenticated
using (true);

-- ONLY authenticated admins can update application status
create policy "Only authenticated admins can update applications"
on public.purchase_applications for update
to authenticated
using (true)
with check (true);

-- Site Settings policies:
-- Anyone can view site settings (such as CBE payment account number)
create policy "Public can view site settings"
on public.site_settings for select
to anon, authenticated
using (true);

-- Only authenticated admins can modify site settings
create policy "Admins can insert or update site settings"
on public.site_settings for insert
to authenticated
with check (true);

create policy "Admins can update site settings"
on public.site_settings for update
to authenticated
using (true)
with check (true);

-- ----------------------------------------------------------
-- 6. STORAGE BUCKETS SETUP & SECURITY POLICIES
-- ----------------------------------------------------------
-- Create storage buckets if they do not exist
insert into storage.buckets (id, name, public)
values 
    ('vehicle-images', 'vehicle-images', true),
    ('customer-documents', 'customer-documents', false)
on conflict (id) do update set public = excluded.public;

-- Vehicle Images Bucket Policies (PUBLIC BUCKET)
-- Public can view vehicle images
create policy "Public can view vehicle images"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'vehicle-images');

-- Only authenticated admins can upload/manage vehicle images
create policy "Admins can upload vehicle images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'vehicle-images');

create policy "Admins can update vehicle images"
on storage.objects for update
to authenticated
using (bucket_id = 'vehicle-images');

create policy "Admins can delete vehicle images"
on storage.objects for delete
to authenticated
using (bucket_id = 'vehicle-images');

-- Customer Documents Bucket Policies (PRIVATE BUCKET)
-- Anyone submitting an application can upload their documents (identity, photo, receipt)
create policy "Anyone can upload customer documents"
on storage.objects for insert
to anon, authenticated
with check (bucket_id = 'customer-documents');

-- ONLY authenticated admins can view customer documents (via signed URLs or select)
create policy "Only authenticated admins can view customer documents"
on storage.objects for select
to authenticated
using (bucket_id = 'customer-documents');

create policy "Only authenticated admins can delete customer documents"
on storage.objects for delete
to authenticated
using (bucket_id = 'customer-documents');

-- ----------------------------------------------------------
-- 7. INITIAL SEED DATA (ነባሪ መረጃዎች)
-- ----------------------------------------------------------

-- Default Site Settings
insert into public.site_settings (setting_key, setting_value)
values
    ('payment_account', 'CBE: 1000245519668'),
    ('payment_instructions', 'የ 10% የቅድመ ክፍያ በኢትዮጵያ ንግድ ባንክ (CBE) አካውንት 1000245519668 ካስገቡ በኋላ የተቆረጠውን ደረሰኝ በማያያዝ ያመልክቱ።'),
    ('business_phone', '+251 911 23 45 67 / +251 922 88 99 00'),
    ('business_email', 'info@ethioelectriccars.et'),
    ('business_address', 'ቦሌ አትላስ፣ አዲስ አበባ፣ ኢትዮጵያ'),
    ('hero_title', 'ኢትዮ ኤሌክትሪክ መኪኖች — የዘመናዊ መጓጓዣ ምርጫ!'),
    ('hero_description', 'ኢትዮ ኤሌክትሪክ መኪኖች አስመጭና አከፋፋይ በኢትዮጵያ የኤሌክትሪክ መኪና ቴክኖሎጂን ለማስፋፋት የተቋቋመ ድርጅት ሲሆን፣ ጥራት ያላቸውንና ዘመናዊ የኤሌክትሪክ መኪኖችን ከውጭ በማስመጣት ለግለሰቦች፣ ለድርጅቶችና ለተለያዩ ተቋማት ያቀርባል።')
on conflict (setting_key) do update set setting_value = excluded.setting_value;

-- Seed Vehicles (Initial Catalog)
insert into public.vehicles (
    model_name,
    seats,
    price_etb,
    range_km,
    motor_battery_capacity,
    max_speed,
    description,
    image_url,
    available,
    featured
) values
(
    'ኢትዮ ኢ-ጎልፍ ቪዥን 4S (Electric Sightseeing Golf Cart)',
    4,
    1850000,
    120,
    '72V / 5.0 KW (Li-ion 105Ah)',
    45,
    'ዘመናዊ እና ለአካባቢ ተስማሚ የሆነ የ 4 መቀመጫ የኤሌክትሪክ ጎልፍ መኪና። የ 5 ዓመት ሙሉ ዋስትና ያለው የሊቲየም ባትሪ የተገጠመለት። ለሆቴሎች፣ ለሪዞርቶች፣ ለግቢ ውስጥ መጓጓዣ እና ለመዝናኛ ተስማሚ።',
    'https://images.unsplash.com/photo-1593941707882-a5bba14938c7?auto=format&fit=crop&w=900&q=80',
    true,
    true
),
(
    'ኢትዮ ኢ-ጎልፍ ቱሪስት 6S (Electric Sightseeing Golf Cart)',
    6,
    2450000,
    110,
    '72V / 7.5 KW (Li-ion 150Ah)',
    40,
    'የ 6 መቀመጫ ባለከፍተኛ አቅም የኤሌክትሪክ ጎልፍ መኪና። ለቱሪስት ማመላለሻ፣ ለኤርፖርት፣ ለትላልቅ ፋብሪካዎችና ግቢዎች ተመራጭ። ከብክለት ነፃ እና እጅግ ወጪ ቆጣቢ።',
    'https://images.unsplash.com/photo-1535732820275-9ffd998cac22?auto=format&fit=crop&w=900&q=80',
    true,
    true
),
(
    'ኢትዮ ፕራይም ክሮስ ኤስዩቪ (Ethio Prime Cross EV SUV)',
    5,
    4900000,
    510,
    '400V / 150 KW (66.5 kWh Li-ion)',
    165,
    'ምቹ እና ዘመናዊ ባለ 5 መቀመጫ የቤተሰብ እና የስራ ኤስዩቪ። ፈጣን ቻርጅንግ (Fast Charging) የሚደግፍ፣ በአንድ ቻርጅ 510 ኪሎሜትር የሚጓዝ።',
    'https://images.unsplash.com/photo-1563720223185-11003d516935?auto=format&fit=crop&w=900&q=80',
    true,
    true
),
(
    'ኢትዮ ሲቲ ስማርት ኮምፓክት (Ethio City Smart EV)',
    4,
    2950000,
    305,
    '320V / 55 KW (38.8 kWh Li-ion)',
    130,
    'ለከተማ ትራፊክ ፍቱን የሆነ፣ የመኪና ማቆሚያ የማያስቸግር፣ እጅግ ኢኮኖሚያዊ እና ዘመናዊ ባለ 4 መቀመጫ የከተማ መኪና።',
    'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=900&q=80',
    true,
    false
),
(
    'ኢትዮ ኤክስኪዩቲቭ ሴዳን (Ethio Executive Luxury EV)',
    5,
    6200000,
    605,
    '450V / 200 KW (82 kWh Li-ion)',
    190,
    'ከፍተኛ ምቾትና ደህንነት የተላበሰ የኤሌክትሪክ ሴዳን። ለድርጅት መሪዎች እና ለረጅም ጉዞ የተሰራ፣ የላቀ የመንዳት ልምድ የሚያጎናጽፍ።',
    'https://images.unsplash.com/photo-1617788138017-80ad40651399?auto=format&fit=crop&w=900&q=80',
    true,
    true
),
(
    'ኢትዮ ካርጎ ኢ-ቫን (Ethio Cargo Commercial EV)',
    2,
    3600000,
    280,
    '380V / 70 KW (50.2 kWh Li-ion)',
    110,
    'ለዕቃ ማመላለሻ፣ ለሽያጭና ለከተማ ውስጥ ስርጭት የተዘጋጀ ከፍተኛ የመጫን አቅም ያለው የኤሌክትሪክ ቫን። የነዳጅ ወጪን 100% ያስቀራል።',
    'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=900&q=80',
    true,
    false
);
