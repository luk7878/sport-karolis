import { supabase } from './lib/supabase';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import './public.css';

type Row = Record<string, any>;
const params = new URLSearchParams(location.search);
const language = params.get('lang') === 'lt' ? 'lt' : 'en';
const field = (row: Row, key: string) => String(row[`${key}_${language}`] || row[`${key}_en`] || row[`${key}_lt`] || '');
export function safeURL(value: unknown, local = false) {
  const url = String(value || '').trim();
  if (local && /^\/(?!\/)/.test(url)) return url;
  try { const parsed = new URL(url); return ['https:', 'http:'].includes(parsed.protocol) ? parsed.href : ''; } catch { return ''; }
}
function el<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = '') {
  const node = document.createElement(tag); node.textContent = text; node.className = className; return node;
}
function rich(value: string) {
  const node = el('div', '', 'content-copy');
  node.innerHTML = DOMPurify.sanitize(marked.parse(value, { async: false }), { FORBID_TAGS: ['style','form','input','iframe'], FORBID_ATTR: ['style'] });
  node.querySelectorAll('a').forEach(a => { a.rel = 'noopener noreferrer'; });
  return node;
}
function published(table: 'articles'|'projects') {
  return supabase.from(table).select('*').eq('status','published').or(`scheduled_at.is.null,scheduled_at.lte.${new Date().toISOString()}`);
}
function card(row: Row, kind: 'articles'|'projects') {
  const link = el('a', '', 'cms-card');
  link.href = `${kind === 'articles' ? '/news/article/' : '/project/'}?slug=${encodeURIComponent(row.slug)}`;
  const image = safeURL(row.image_url, true);
  if (image) { const img = el('img'); img.src = image; img.alt = ''; img.loading = 'lazy'; link.append(img); }
  const body = el('div'); body.append(el('span', kind === 'articles' ? 'PROJECT NEWS' : row.programme || 'PROJECT', 'eyebrow'));
  body.append(el('h3', field(row,'title')), el('p', field(row,kind === 'articles' ? 'excerpt' : 'summary')), el('span', 'Read more ↗', 'text-link'));
  link.append(body); return link;
}
async function settings() {
  const { data, error } = await supabase.from('site_settings').select('*').eq('id','main').maybeSingle();
  if (error || !data) return;
  const title = document.querySelector('.hero h1');
  if (title && data.hero_title_en) {
    title.replaceChildren(); const lines = data.hero_title_en.split('\n');
    lines.forEach((line: string, i: number) => { title.append(i === lines.length - 1 ? el('em',line) : document.createTextNode(line)); if (i < lines.length - 1) title.append(el('br')); });
  }
  const lead = document.querySelector('.hero-lead'); if (lead && data.hero_text_en) lead.textContent = data.hero_text_en;
  const img = document.querySelector<HTMLImageElement>('.hero-visual>img'); const image = safeURL(data.hero_image_url,true); if (img && image) { img.src = image; img.alt = 'LETS · generations connected through sport'; }
  const keys = ['impact_families','impact_professionals','impact_organizations','impact_reach'];
  document.querySelectorAll('.impact-inner>div>strong').forEach((node,i) => { node.textContent = Number(data[keys[i]]).toLocaleString('en-GB') + ([0,3].includes(i) ? '+' : ''); });
  if (location.pathname === '/contacts/') {
    const notice = document.querySelector('#contact-details');
    if (notice && (data.contact_email || data.contact_phone)) {
      notice.replaceChildren();
      if (data.contact_email) { const email = el('a',data.contact_email); email.href = `mailto:${encodeURIComponent(data.contact_email)}`; notice.append(email); }
      if (data.contact_phone) { const phone = el('a',data.contact_phone); phone.href = `tel:${String(data.contact_phone).replace(/[^+\d]/g,'')}`; notice.append(phone); }
    }
    if (data.contact_form_enabled) contactForm();
  }
  const platform = safeURL(data.platform_url);
  if (platform) {
    const notice = document.querySelector('#platform-access');
    if (notice) { const a = el('a','Open the LETS platform ↗','button button-dark'); a.href = platform; a.target = '_blank'; a.rel = 'noopener noreferrer'; notice.replaceChildren(a); }
  }
}
async function partners() {
  const { data, error } = await supabase.from('partners').select('*').eq('is_visible',true).order('sort_order');
  if (error || !data) return;
  const root = document.querySelector('.partner-list');
  const contact = document.querySelector('.contact-partners');
  if (root) root.replaceChildren(...data.map(p => partner(p)));
  if (contact) contact.replaceChildren(...data.slice(1).map(p => partner(p)));
  const coordinator = document.querySelector('.contact-coordinator');
  if (coordinator && data[0]) {
    coordinator.replaceChildren(el('span',`${data[0].country || ''} · PROJECT COORDINATOR`), el('h2',data[0].name),el('p',data[0].description_en || ''));
  }
}
function partner(p: Row) {
  const item = el('article'); const identity = el('div'); const logo = safeURL(p.logo_url,true);
  if (logo) { const img = el('img'); img.src=logo;img.alt=p.name;img.className='cms-partner-logo';img.loading='lazy';identity.append(img); }
  identity.append(el('span',p.country || '','country'));
  const title = el('h3',p.name); const website = safeURL(p.website_url);
  if (website) { const link = el('a',p.name);link.href=website;link.target='_blank';link.rel='noopener noreferrer';title.replaceChildren(link); }
  identity.append(title); item.append(identity,el('p',p.description_en || p.description_lt || ''));return item;
}
async function contentLists() {
  if (location.pathname === '/news/') {
    const { data, error } = await published('articles').order('published_at',{ascending:false});
    const section = document.querySelector<HTMLElement>('#published-news');
    if (!error && data?.length && section) { section.hidden=false; section.querySelector('.cms-grid')!.replaceChildren(...data.map(row => card(row,'articles'))); document.querySelector('#news-placeholder')?.remove(); }
  }
  if (location.pathname === '/' || location.pathname === '/platform/') {
    const { data, error } = await published('projects').order('featured',{ascending:false}).order('updated_at',{ascending:false});
    if (error || !data) return;
    const section = document.querySelector<HTMLElement>('#published-projects');
    if (section && data.length) { section.hidden=false;section.querySelector('.cms-grid')!.replaceChildren(...data.map(row => card(row,'projects'))); }
    const primary = data.find(p => p.project_code === 'ERASMUS-SPORT-2025-SSCP-101245991');
    const intro = document.querySelector('.intro-body'); if (intro && primary?.description_en) intro.replaceChildren(rich(primary.description_en));
    const resources = document.querySelector<HTMLElement>('#published-resources');
    if (resources) {
      const links = data.flatMap(p => String(p.document_links || '').split('\n').map(line => ({line,project:field(p,'title')}))).filter(x => x.line.trim());
      const list = resources.querySelector('.cms-downloads')!;
      for (const {line,project} of links) { const parts = line.split('|');const url=safeURL(parts.length>1?parts[1]:parts[0],true);if(!url)continue;const a=el('a',parts.length>1?parts[0]:'Project document','cms-download');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.append(el('small',project),el('span','Open document ↗'));list.append(a); }
      resources.hidden = list.childElementCount === 0;
    }
  }
}
async function detail() {
  const root = document.querySelector<HTMLElement>('#content-detail'); if (!root) return;
  const kind = location.pathname === '/project/' ? 'projects' : 'articles';
  const slug = params.get('slug'); if (!slug) {root.textContent='Choose an entry from the website.';return;}
  let preview = false;
  if (params.get('preview') === '1') {
    const {data} = await supabase.auth.getUser();
    if (data.user) {const profile=await supabase.from('profiles').select('is_admin').eq('id',data.user.id).maybeSingle();preview=Boolean(profile.data?.is_admin);}
  }
  const query = preview ? supabase.from(kind).select('*') : published(kind);
  const {data,error} = await query.eq('slug',slug).maybeSingle();
  if (error) {root.textContent='This content could not be loaded. Please try again later.';return;}
  if (!data) {root.textContent='This entry is not available.';return;}
  root.replaceChildren();
  if (preview) root.append(el('p','Administrator preview · unpublished content may be shown','notice'));
  root.append(el('p',kind==='articles'?'LETS / NEWS':data.programme || 'LETS / PROJECT','eyebrow'),el('h1',field(data,'title')),el('p',field(data,kind==='articles'?'excerpt':'summary'),'content-lead'));
  const image=safeURL(data.image_url,true);if(image){const img=el('img');img.src=image;img.alt=field(data,'title');img.className='cms-detail-image';root.append(img);}
  root.append(rich(field(data,kind==='articles'?'content':'description')));
  if (kind === 'projects') {
    for(const [key,title] of [['goal','Project goal'],['audience','Who it serves'],['activities','Activities'],['outcomes','Expected impact']]) {const text=field(data,key);if(!text)continue;root.append(el('h2',title)); if(['activities','outcomes'].includes(key)){const list=el('ul');text.split('\n').filter(Boolean).forEach(line=>list.append(el('li',line)));root.append(list);}else root.append(rich(text));}
    const metadata=el('div','','cms-project-meta');for(const key of ['programme','project_year','project_code','partner_name']){if(data[key])metadata.append(el('span',String(data[key])));}if(metadata.childElementCount)root.append(metadata);
    const gallery=el('div','','cms-gallery');String(data.gallery_urls || '').split('\n').forEach(url=>{const src=safeURL(url,true);if(src){const img=el('img');img.src=src;img.alt=field(data,'title');img.loading='lazy';gallery.append(img);}});root.append(gallery);
    String(data.document_links||'').split('\n').forEach(line=>{const parts=line.split('|');const url=safeURL(parts[1]||parts[0],true);if(url){const a=el('a',parts[1]?parts[0]:'Project document','cms-download');a.href=url;a.target='_blank';a.rel='noopener noreferrer';root.append(a);}});
  }
  document.title=`${field(data,'seo_title') || field(data,'title')} — LETS`;
  document.documentElement.lang=language;
  document.querySelector('meta[name="description"]')?.setAttribute('content',field(data,'seo_description') || field(data,kind==='articles'?'excerpt':'summary'));
  for (const [property,content] of Object.entries({'og:title':field(data,'seo_title')||field(data,'title'),'og:description':field(data,'seo_description')||field(data,kind==='articles'?'excerpt':'summary'),'og:image':safeURL(data.social_image_url || data.image_url,true)})) { if(content){const meta=el('meta');meta.setAttribute('property',property);meta.content=content;document.head.append(meta);} }
  if(preview){const robots=el('meta');robots.name='robots';robots.content='noindex,nofollow';document.head.append(robots);}
}
function contactForm() {
  const section=document.querySelector<HTMLElement>('#contact-form-section');const form=document.querySelector<HTMLFormElement>('#contact-form');if(!section||!form)return;section.hidden=false;
  form.addEventListener('submit',async e=>{
    e.preventDefault();const fields=new FormData(form);if(fields.get('website'))return;
    const button=form.querySelector<HTMLButtonElement>('button')!;const message=form.querySelector<HTMLElement>('[role=status]')!;button.disabled=true;message.textContent='Sending…';
    try { const {error}=await supabase.from('inquiries').insert({name:String(fields.get('name')).trim(),email:String(fields.get('email')).trim(),organization:String(fields.get('organization')||'').trim(),topic:fields.get('topic'),message:String(fields.get('message')).trim(),language:'en'});if(error)throw error;form.reset();message.textContent='Thank you. Your message has been received by the project team.'; }
    catch {message.textContent='Your message could not be sent. Please try again later.';}
    finally{button.disabled=false;}
  });
}
async function start() {
  await Promise.allSettled([settings(),partners(),contentLists(),detail()]);
  if(params.get('preview')!=='1') await supabase.from('page_views').insert({path:location.pathname});
}
void start();
