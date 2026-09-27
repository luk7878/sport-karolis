-- LETS admin setup. Run in project jsfoscfckqmekobbjxyp, Supabase SQL Editor.
-- Re-running preserves content. The administrator must verify their email.
begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.admin_emails (email text primary key);
-- Configure the allowlisted administrator in supabase/setup.sql before applying this setup.
insert into private.admin_emails values ('replace-with-your-admin-email@example.com') on conflict do nothing;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.site_settings (
  id text primary key default 'main' check (id = 'main'),
  hero_title_lt text, hero_title_en text, hero_text_lt text, hero_text_en text,
  hero_image_url text,
  impact_families integer not null default 70 check (impact_families >= 0),
  impact_professionals integer not null default 14 check (impact_professionals >= 0),
  impact_organizations integer not null default 27 check (impact_organizations >= 0),
  impact_reach integer not null default 1000 check (impact_reach >= 0),
  contact_email text, contact_phone text, platform_url text,
  contact_form_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title_lt text not null default '', title_en text, excerpt_lt text, excerpt_en text,
  content_lt text, content_en text, image_url text, seo_title_lt text, seo_title_en text,
  seo_description_lt text, seo_description_en text, social_image_url text,
  scheduled_at timestamptz, published_at timestamptz,
  status text not null default 'draft' check (status in ('draft','published')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (length(trim(title_lt)) > 0 or length(trim(coalesce(title_en,''))) > 0)
);
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title_lt text not null default '', title_en text, summary_lt text, summary_en text,
  description_lt text, description_en text, goal_lt text, goal_en text,
  audience_lt text, audience_en text, activities_lt text, activities_en text,
  outcomes_lt text, outcomes_en text, programme text, project_year text, project_code text,
  partner_name text, image_url text, gallery_urls text, document_links text,
  seo_title_lt text, seo_title_en text, seo_description_lt text, seo_description_en text,
  social_image_url text, scheduled_at timestamptz, published_at timestamptz,
  featured boolean not null default false,
  status text not null default 'draft' check (status in ('draft','published')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (length(trim(title_lt)) > 0 or length(trim(coalesce(title_en,''))) > 0)
);
create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(), name text not null,
  country text, description_en text, description_lt text, logo_url text,
  website_url text, sort_order integer not null default 0,
  is_visible boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  email text not null check (length(email) <= 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  organization text check (length(organization) <= 200),
  topic text not null default 'general' check (topic in ('general','project','partnership','volunteering','media')),
  message text not null check (length(trim(message)) between 10 and 10000),
  language text not null default 'en' check (language in ('lt','en')),
  status text not null default 'new' check (status in ('new','read','replied','archived')),
  internal_notes text, assignee text, tags text, created_at timestamptz not null default now()
);
create table if not exists public.page_views (
  id bigint generated always as identity primary key,
  path text not null check (path in ('/','/platform/','/news/','/contacts/','/news/article/','/project/')),
  created_at timestamptz not null default now()
);

-- This trigger is the only privileged code. It is private, cannot be called
-- through the Data API, and grants rights only to an allowlisted verified email.
create or replace function private.sync_admin_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, is_admin)
  values (new.id, new.email_confirmed_at is not null and exists (
    select 1 from private.admin_emails where email = lower(new.email)
  )) on conflict (id) do update set is_admin = excluded.is_admin;
  return new;
end $$;
revoke all on function private.sync_admin_profile() from public, anon, authenticated;
drop trigger if exists lets_sync_admin_profile on auth.users;
create trigger lets_sync_admin_profile after insert or update of email, email_confirmed_at
on auth.users for each row execute function private.sync_admin_profile();
insert into public.profiles (id, is_admin)
select u.id, u.email_confirmed_at is not null and exists (
  select 1 from private.admin_emails a where a.email = lower(u.email)
) from auth.users u on conflict (id) do update set is_admin = excluded.is_admin;

create or replace function public.is_admin() returns boolean
language sql stable security invoker set search_path = '' as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin)
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create or replace function public.get_page_view_stats()
returns table(path text, count bigint) language sql stable security invoker set search_path = '' as $$
  select p.path, count(*) from public.page_views p
  where (select public.is_admin()) group by p.path order by count(*) desc
$$;
revoke all on function public.get_page_view_stats() from public, anon;
grant execute on function public.get_page_view_stats() to authenticated;

create or replace function private.touch_updated_at() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;
revoke all on function private.touch_updated_at() from public, anon, authenticated;
do $$ declare t text; begin
  foreach t in array array['site_settings','articles','projects'] loop
    execute format('drop trigger if exists lets_updated_at on public.%I',t);
    execute format('create trigger lets_updated_at before update on public.%I for each row execute function private.touch_updated_at()',t);
  end loop;
end $$;

alter table private.admin_emails enable row level security;
alter table public.profiles enable row level security;
alter table public.site_settings enable row level security;
alter table public.articles enable row level security;
alter table public.projects enable row level security;
alter table public.partners enable row level security;
alter table public.inquiries enable row level security;
alter table public.page_views enable row level security;

revoke all on public.profiles, public.site_settings, public.articles, public.projects,
  public.partners, public.inquiries, public.page_views from anon, authenticated;
grant select on public.profiles, public.site_settings, public.articles, public.projects, public.partners to anon, authenticated;
grant update on public.site_settings to authenticated;
grant insert, update, delete on public.articles, public.projects, public.partners to authenticated;
grant select, update, delete on public.inquiries to authenticated;
grant insert(name,email,organization,topic,message,language) on public.inquiries to anon, authenticated;
grant select on public.page_views to authenticated;
grant insert(path) on public.page_views to anon, authenticated;
grant usage on sequence public.page_views_id_seq to anon, authenticated;

drop policy if exists "lets own profile" on public.profiles;
create policy "lets own profile" on public.profiles for select to authenticated using (id = (select auth.uid()));
drop policy if exists "lets public settings" on public.site_settings;
create policy "lets public settings" on public.site_settings for select to anon, authenticated using (true);
drop policy if exists "lets admin settings" on public.site_settings;
create policy "lets admin settings" on public.site_settings for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

do $$ declare t text; begin
  foreach t in array array['articles','projects'] loop
    execute format('drop policy if exists "lets published content" on public.%I',t);
    execute format('create policy "lets published content" on public.%I for select to anon, authenticated using ((status = ''published'' and (scheduled_at is null or scheduled_at <= now())) or (select public.is_admin()))',t);
  end loop;
  foreach t in array array['articles','projects','partners'] loop
    execute format('drop policy if exists "lets admin insert" on public.%I',t);
    execute format('create policy "lets admin insert" on public.%I for insert to authenticated with check ((select public.is_admin()))',t);
    execute format('drop policy if exists "lets admin update" on public.%I',t);
    execute format('create policy "lets admin update" on public.%I for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))',t);
    execute format('drop policy if exists "lets admin delete" on public.%I',t);
    execute format('create policy "lets admin delete" on public.%I for delete to authenticated using ((select public.is_admin()))',t);
  end loop;
end $$;
drop policy if exists "lets visible partners" on public.partners;
create policy "lets visible partners" on public.partners for select to anon, authenticated
using (is_visible or (select public.is_admin()));
drop policy if exists "lets public inquiries" on public.inquiries;
create policy "lets public inquiries" on public.inquiries for insert to anon, authenticated
with check (status = 'new' and internal_notes is null and assignee is null and tags is null
  and exists(select 1 from public.site_settings where id = 'main' and contact_form_enabled));
drop policy if exists "lets admin inquiries read" on public.inquiries;
create policy "lets admin inquiries read" on public.inquiries for select to authenticated using ((select public.is_admin()));
drop policy if exists "lets admin inquiries update" on public.inquiries;
create policy "lets admin inquiries update" on public.inquiries for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "lets admin inquiries delete" on public.inquiries;
create policy "lets admin inquiries delete" on public.inquiries for delete to authenticated using ((select public.is_admin()));
drop policy if exists "lets public page views" on public.page_views;
create policy "lets public page views" on public.page_views for insert to anon, authenticated with check (true);
drop policy if exists "lets admin page views" on public.page_views;
create policy "lets admin page views" on public.page_views for select to authenticated using ((select public.is_admin()));

create index if not exists lets_articles_published_idx on public.articles(status,scheduled_at);
create index if not exists lets_projects_published_idx on public.projects(status,scheduled_at);
create index if not exists lets_inquiries_created_idx on public.inquiries(created_at desc);
create index if not exists lets_page_views_path_idx on public.page_views(path);

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('site-media','site-media',true,10485760,array['image/jpeg','image/png','image/webp','image/gif','image/avif','application/pdf'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "lets media read" on storage.objects;
create policy "lets media read" on storage.objects for select to anon, authenticated using (bucket_id = 'site-media');
drop policy if exists "lets media insert" on storage.objects;
create policy "lets media insert" on storage.objects for insert to authenticated with check (bucket_id = 'site-media' and (select public.is_admin()));
drop policy if exists "lets media update" on storage.objects;
create policy "lets media update" on storage.objects for update to authenticated
using (bucket_id = 'site-media' and (select public.is_admin())) with check (bucket_id = 'site-media' and (select public.is_admin()));
drop policy if exists "lets media delete" on storage.objects;
create policy "lets media delete" on storage.objects for delete to authenticated using (bucket_id = 'site-media' and (select public.is_admin()));

insert into public.site_settings (id,hero_title_en,hero_text_en,hero_image_url)
values ('main',E'Movement\nbrings us\ntogether.','LETS — Lets Communicate Through Sports — connects generations and brings families closer through physical activity.','/assets/family-sports.webp')
on conflict (id) do nothing;
insert into public.partners (name,country,description_en,sort_order)
select * from (values
 ('NGO Darnoje','Lithuania','Overall project management · Quality assurance · Reporting and coordination',1),
 ('Lithuanian Obstacle Course Racing Federation (LEBF)','Lithuania','Innovative outdoor sports · Large-scale event expertise · Sport activities coordination',2),
 ('Sport Club Beniaminek 03','Poland','Youth sports training · International training host · PR and dissemination strategy',3),
 ('EBAGEM Development Center for Individuals with Disabilities','Turkey','Inclusive sports expertise · Local cooperation leadership · Quality standards development',4)
) as v(name,country,description_en,sort_order) where not exists (select 1 from public.partners);
insert into public.projects (slug,title_en,summary_en,description_en,goal_en,audience_en,activities_en,outcomes_en,
programme,project_year,project_code,partner_name,image_url,featured,status,published_at)
values ('lets-communicate-through-sports','Lets Communicate Through Sports',
 'Connecting generations and bringing families closer through physical activity.',
 E'Over 15 months, LETS aims to foster intergenerational connections and family engagement in physical activity through sports, enhancing social inclusion across communities.\n\nPartners in Lithuania, Poland and Turkey are working with families, sports professionals and local organizations to make shared movement more accessible.',
 'Foster intergenerational connections and family engagement in physical activity through sports, enhancing social inclusion across communities.',
 'Families, sports professionals, NGOs, policymakers, public institutions and the broader European community.',
 E'Kick-off meeting and final conference in Kaunas\nInternational training in Starogard Gdański\nParticipation in the Istanbul Marathon\nFamily workshops and community sports days\nOpen-access digital resources and dissemination',
 E'Stronger family bonds and intergenerational communication\nMore active lifestyles and reduced social isolation among seniors\nIncreased professional confidence and LETS methodology integration\nStronger cross-sector collaboration\nA lasting network and replicable European model',
 'Erasmus+ Sport','2025–2027','ERASMUS-SPORT-2025-SSCP-101245991','NGO Darnoje',
 '/assets/family-sports.webp',true,'published',now()) on conflict (slug) do nothing;

notify pgrst, 'reload schema';
commit;
