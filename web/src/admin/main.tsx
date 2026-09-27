import { useEffect, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { supabase } from '../lib/supabase';
import ContentAdmin from './ContentAdmin';
import SiteAdmin from './SiteAdmin';
import Inquiries from './Inquiries';
import './admin.css';
import './lets-theme.css';

function Access({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'loading'|'login'|'pending'|'admin'>('loading');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [account, setAccount] = useState('');
  useEffect(() => {
    let alive = true;
    async function check() {
      const { data, error } = await supabase.auth.getUser();
      if (!alive) return;
      if (error || !data.user) { setState('login'); return; }
      setAccount(data.user.email || '');
      const profile = await supabase.from('profiles').select('is_admin').eq('id', data.user.id).maybeSingle();
      if (!alive) return;
      setMessage(profile.error ? 'Duomenų bazė dar neparuošta. Paleiskite LETS setup.sql Supabase SQL Editor.' : '');
      setState(profile.data?.is_admin ? 'admin' : 'pending');
    }
    void check();
    const { data } = supabase.auth.onAuthStateChange(() => { setTimeout(() => { if (alive) void check(); }, 0); });
    return () => { alive = false; data.subscription.unsubscribe(); };
  }, []);
  async function authenticate(signup = false) {
    if (!email.trim() || password.length < 8) { setMessage('Įveskite el. paštą ir bent 8 simbolių slaptažodį.'); return; }
    setBusy(true); setMessage('');
    try {
      const response = signup
        ? await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: `${location.origin}/admin/` } })
        : await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (response.error) setMessage(response.error.message);
      else if (signup && !response.data.session) setMessage('Patvirtinkite el. paštą gautoje žinutėje, tada prisijunkite.');
    } catch { setMessage('Nepavyko prisijungti prie serverio. Bandykite dar kartą.'); }
    finally { setBusy(false); }
  }
  if (state === 'loading') return <main className="admin-loading">Tikrinama prieiga…</main>;
  if (state === 'admin') return children;
  return <main className="admin-shell"><section className="admin-login">
    <a href="/">← Grįžti į svetainę</a><div className="brand-mark">LETS<span>.</span></div>
    <p className="login-kicker">ADMINISTRAVIMAS</p>
    <h1>{state === 'pending' ? 'Prieiga laukiama' : 'Turinio studija'}</h1>
    {state === 'pending' ? <><p><b>{account}</b> neturi administratoriaus teisių. Patvirtinkite el. paštą ir patikrinkite, ar paleistas paruošimo SQL.</p><button onClick={() => void supabase.auth.signOut()}>Atsijungti</button></> : <>
      <p>Valdykite LETS naujienas, projektą ir svetainės turinį.</p>
      <form onSubmit={e => { e.preventDefault(); void authenticate(); }}>
        <label>El. paštas<input autoComplete="username" type="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label>Slaptažodis<input autoComplete="current-password" type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} /></label>
        <button disabled={busy}>{busy ? 'Jungiama…' : 'Prisijungti'}</button>
        <button type="button" className="ghost" disabled={busy} onClick={() => void authenticate(true)}>Sukurti paskyrą</button>
      </form></>}
    {message && <p role="status" className="admin-message">{message}</p>}
  </section></main>;
}

const path = location.pathname.replace(/\/$/, '');
const page = path === '/admin/svetaine' ? <SiteAdmin/> : path === '/admin/uzklausos' ? <Inquiries/> : <ContentAdmin/>;
createRoot(document.getElementById('root')!).render(<Access>{page}</Access>);
