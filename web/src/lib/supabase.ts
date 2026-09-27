import { createClient } from '@supabase/supabase-js';

// Publishable key: database and storage access are enforced by RLS.
export const supabase = createClient(
  'https://jsfoscfckqmekobbjxyp.supabase.co',
  'sb_publishable_Tz9M5eQksXoPgmTBHmRQHA_oPDD4lVo',
  { auth: { storageKey: 'lets-admin-auth' } }
);
