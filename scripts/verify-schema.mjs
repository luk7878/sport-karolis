// Local PostgreSQL verification of setup syntax and authorization.
// Supabase-specific auth/storage infrastructure is represented by minimal tables.
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const db = new PGlite();
await db.exec(`
  create role anon; create role authenticated;
  create schema auth; create schema storage;
  create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  grant usage on schema auth, storage to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
  create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
  alter table storage.objects enable row level security;
  grant select,insert,update,delete on storage.objects to anon,authenticated;
`);
const sql = await readFile(new URL('../supabase/setup.sql',import.meta.url),'utf8');
await db.exec(sql); await db.exec(sql);
await db.exec(`insert into private.admin_emails values ('admin@example.test') on conflict do nothing`);
const admin='00000000-0000-4000-8000-000000000001';
const regular='00000000-0000-4000-8000-000000000002';
const unverified='00000000-0000-4000-8000-000000000003';
await db.query(`insert into auth.users values ($1,'admin@example.test',now()),($2,'reader@example.com',now()),($3,'admin@example.test',null)`,[admin,regular,unverified]);
assert.equal((await db.query('select count(*)::int as n from public.partners')).rows[0].n,4);
assert.equal((await db.query('select is_admin from public.profiles where id=$1',[unverified])).rows[0].is_admin,false);
async function as(role,id='') {await db.exec('reset role');await db.query(`select set_config('request.jwt.claim.sub',$1,false)`,[id]);await db.exec(`set role ${role}`);}
async function denied(sql) {await assert.rejects(db.exec(sql),err => err.code==='42501');}
await as('authenticated',admin);
assert.equal((await db.query('select public.is_admin() as yes')).rows[0].yes,true);
await db.exec(`insert into public.articles(slug,title_en,status,scheduled_at) values
  ('draft-example','Draft','draft',null),('future-example','Future','published',now()+interval '1 day'),('live-example','Live','published',null);
  update public.site_settings set impact_families=80;
  insert into storage.objects(bucket_id,name) values ('site-media','test.png');`);
assert.equal((await db.query('select count(*)::int as n from public.articles')).rows[0].n,3);
await as('anon');
assert.equal((await db.query('select count(*)::int as n from public.articles')).rows[0].n,1);
assert.equal((await db.query('select count(*)::int as n from public.profiles')).rows[0].n,0);
await denied(`update public.site_settings set impact_families=9000`);
await denied(`insert into public.articles(slug,title_en) values ('injected','Injected')`);
await denied(`insert into storage.objects(bucket_id,name) values ('site-media','injected.png')`);
await denied(`insert into public.inquiries(name,email,message) values ('Reader','reader@example.com','Test inquiry message')`);
await as('authenticated',regular);
assert.equal((await db.query('select public.is_admin() as yes')).rows[0].yes,false);
await denied(`update public.profiles set is_admin=true`);
await denied(`insert into public.projects(slug,title_en) values ('injected','Injected')`);
assert.equal((await db.query(`update public.site_settings set impact_families=9999 returning id`)).rows.length,0);
await as('authenticated',admin);
await db.exec(`update public.site_settings set contact_form_enabled=true`);
await as('anon');
await db.exec(`insert into public.inquiries(name,email,message) values ('Reader','reader@example.com','Test inquiry message'); insert into public.page_views(path) values ('/news/');`);
await denied(`select * from public.inquiries`);
await denied(`insert into public.inquiries(name,email,message,status) values ('Reader','reader@example.com','Test inquiry message','replied')`);
await denied(`select * from public.get_page_view_stats()`);
await as('authenticated',regular);
assert.equal((await db.query('select * from public.inquiries')).rows.length,0);
assert.equal((await db.query('select * from public.get_page_view_stats()')).rows.length,0);
await as('authenticated',admin);
assert.equal((await db.query('select * from public.inquiries')).rows.length,1);
await db.exec(`update public.inquiries set status='read',internal_notes='Admin-only note'; delete from public.articles where slug='draft-example'`);
assert.equal(Number((await db.query('select * from public.get_page_view_stats()')).rows[0].count),1);
await db.exec('reset role');
assert.equal((await db.query(`select hero_title_en from public.site_settings`)).rows[0].hero_title_en,'Movement\nbrings us\ntogether.');
await db.close();
console.log('PASS: schema runs twice; verified admin access; private drafts/schedules; no role escalation; inquiry privacy; storage writes; statistics authorization.');
