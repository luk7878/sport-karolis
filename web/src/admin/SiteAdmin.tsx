
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import MediaUpload from "../components/MediaUpload";
type Tab = "home" | "partners" | "stats";
type Item = Record<string, string | number | boolean> & { id: string };
const blankPartner = {
  name: "",
  country: "",
  description_en: "",
  description_lt: "",
  logo_url: "",
  website_url: "",
  sort_order: 0,
  is_visible: true,
};
export default function SiteAdmin() {
  const [tab, setTab] = useState<Tab>("home"),
    [ready, setReady] = useState(false),
    [message, setMessage] = useState(""),
    [settings, setSettings] = useState<Record<string, string | number | boolean>>({}),
    [partners, setPartners] = useState<Item[]>([]),
    [views, setViews] = useState<{ path: string; count: number }[]>([]),
    [draft, setDraft] =
      useState<Record<string, string | number | boolean>>(blankPartner),
    [editing, setEditing] = useState<string | null>(null);
  useEffect(() => {
    void load();
  }, []);
  async function load() {
    const { data: a } = await supabase.auth.getUser();
    if (!a.user) return location.replace("/admin");
    const { data: p } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", a.user.id)
      .single();
    if (!p?.is_admin) return location.replace("/admin");
    const [s, pa, v] = await Promise.all([
      supabase.from("site_settings").select("*").single(),
      supabase.from("partners").select("*").order("sort_order"),
      supabase.rpc("get_page_view_stats"),
    ]);
    setSettings(s.data || {});
    setPartners((pa.data || []) as Item[]);
    setViews((v.data || []).map((x: {path: string; count: number}) => ({path:x.path,count:Number(x.count)})));
    setMessage([s.error, pa.error, v.error].filter(Boolean).map(x => x!.message).join(" · "));
    setReady(true);
  }
  const set = (k: string, v: string | number) =>
    setSettings({ ...settings, [k]: v });
  async function saveSettings() {
    if (settings.platform_url && !/^https?:\/\//.test(String(settings.platform_url))) return setMessage("Platformos adresas turi prasidėti https:// arba http://.");
    const { id, updated_at, ...payload } = settings;
    const { error } = await supabase
      .from("site_settings")
      .update(payload)
      .eq("id", "main").select("id").single();
    setMessage(error ? error.message : "Svetainės nustatymai išsaugoti");
  }
  function begin(item?: Item) {
    setTab("partners");
    setEditing(item?.id || null);
    setDraft(item || blankPartner);
  }
  async function saveItem() {
    if (!String(draft.name || "").trim()) return setMessage("Įrašykite partnerio pavadinimą.");
    if (draft.website_url && !/^https?:\/\//.test(String(draft.website_url))) return setMessage("Svetainės nuoroda turi prasidėti https:// arba http://.");
    const table = "partners";
    const { id, created_at, ...payload } = draft as Item;
    const q = editing
      ? supabase.from(table).update(payload).eq("id", editing)
      : supabase.from(table).insert(payload);
    const { error } = await q.select("id").single();
    if (error) return setMessage(error.message);
    setMessage("Išsaugota");
    setEditing(null);
    setDraft(blankPartner);
    await load();
  }
  async function remove(table: string, id: string) {
    if (!confirm("Ištrinti?")) return;
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) return setMessage(error.message);
    await load();
  }
  if (!ready) return <main className="admin-loading">Kraunama…</main>;
  return (
    <main className="site-admin">
      <header className="studio-top">
        <div>
          <span className="brand-mark">LETS</span>
          <b>Svetainės valdymas</b>
        </div>
        <div className="studio-top-actions">
          <a href="/admin">← Turinio studija</a>
          {message && <span className="save-message">{message}</span>}
        </div>
      </header>
      <nav className="site-admin-tabs">
        {(["home", "partners", "stats"] as Tab[]).map((x) => (
          <button
            className={tab === x ? "active" : ""}
            onClick={() => {
              setTab(x);
              setEditing(null);
            }}
            key={x}
          >
            {x === "home"
              ? "Pagrindinis"
              : x === "partners"
                  ? "Partneriai"
                  : "Statistika"}
          </button>
        ))}
      </nav>
      <section className="site-admin-body">
        {tab === "home" && (
          <div className="settings-form">
            <div className="block-heading">
              <span>01</span>
              <div>
                <h2>Pagrindinis puslapis</h2>
                <p>Keiskite pagrindinę žinutę, vaizdą ir poveikio rodiklius. Svetainėje rodoma EN versija.</p>
              </div>
            </div>
            <div className="editor-two">
              <label>
                Hero antraštė LT
                <textarea
                  value={String(settings.hero_title_lt || "")}
                  onChange={(e) => set("hero_title_lt", e.target.value)}
                />
              </label>
              <label>
                Hero antraštė EN
                <textarea
                  value={String(settings.hero_title_en || "")}
                  onChange={(e) => set("hero_title_en", e.target.value)}
                />
              </label>
              <label>
                Hero tekstas LT
                <textarea
                  value={String(settings.hero_text_lt || "")}
                  onChange={(e) => set("hero_text_lt", e.target.value)}
                />
              </label>
              <label>
                Hero tekstas EN
                <textarea
                  value={String(settings.hero_text_en || "")}
                  onChange={(e) => set("hero_text_en", e.target.value)}
                />
              </label>
            </div>
            <label>
              Pagrindinė nuotrauka
              <input
                value={String(settings.hero_image_url || "")}
                onChange={(e) => set("hero_image_url", e.target.value)}
              />
            </label>
            <MediaUpload
              label="Įkelti pagrindinę nuotrauką"
              value={String(settings.hero_image_url || "")}
              onChange={(v) => set("hero_image_url", v)}
            />
            <div className="impact-inputs">
              {([['impact_families','Šeimos'],['impact_professionals','Specialistai'],['impact_organizations','Organizacijos'],['impact_reach','Pasiekti žmonės']] as const).map(([key,label]) => <label key={key}>{label}<input type="number" min="0" value={Number(settings[key] || 0)} onChange={e => set(key, Math.max(0, Number(e.target.value)))}/></label>)}
            </div>
            <div className="block-heading"><span>02</span><div><h2>Kontaktai ir platforma</h2><p>Tušti laukai svetainėje nerodomi. Galėsite juos papildyti vėliau.</p></div></div>
            <div className="editor-two">
              <label>Kontaktinis el. paštas<input type="email" value={String(settings.contact_email || '')} onChange={e => set('contact_email',e.target.value)}/></label>
              <label>Telefonas<input type="tel" value={String(settings.contact_phone || '')} onChange={e => set('contact_phone',e.target.value)}/></label>
            </div>
            <label>Platformos adresas<input type="url" placeholder="https://…" value={String(settings.platform_url || '')} onChange={e => set('platform_url',e.target.value)}/></label>
            <label className="studio-check"><input type="checkbox" checked={Boolean(settings.contact_form_enabled)} onChange={e => setSettings({...settings,contact_form_enabled:e.target.checked})}/>Įjungti kontaktų formą (užklausos bus administravimo panelėje)</label>
            <button
              className="studio-publish settings-save"
              onClick={() => void saveSettings()}
            >
              Išsaugoti pakeitimus
            </button>
          </div>
        )}
        {tab === "partners" && (
          <div className="manage-grid">
            <div>
              <div className="manage-head">
                <h2>Partneriai</h2>
                <button onClick={() => begin()}>＋ Pridėti</button>
              </div>
              {partners.map((item) => (
                <article className="manage-row" key={item.id}>
                  <div>
                    {String(item.image_url || item.logo_url) ? (
                      <img
                        src={String(item.image_url || item.logo_url)}
                        alt=""
                      />
                    ) : (
                      <span>{String(item.name).slice(0, 2).toUpperCase()}</span>
                    )}
                  </div>
                  <strong>{String(item.name)}</strong>
                  <small>{item.is_visible ? "Rodoma" : "Paslėpta"}</small>
                  <button onClick={() => begin(item)}>Redaguoti</button>
                  <button
                    onClick={() =>
                      void remove("partners", item.id)
                    }
                  >
                    ×
                  </button>
                </article>
              ))}
            </div>
            <div className="manage-form">
              <h3>{editing ? "Redaguoti" : "Naujas įrašas"}</h3>
              <label>
                Pavadinimas / vardas
                <input
                  value={String(draft.name || "")}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </label>
              <label>Šalis<input value={String(draft.country || '')} onChange={e => setDraft({...draft,country:e.target.value})}/></label>
              <label>Partnerio veikla · EN<textarea value={String(draft.description_en || '')} onChange={e => setDraft({...draft,description_en:e.target.value})}/></label>
              <label>Partnerio veikla · LT<textarea value={String(draft.description_lt || '')} onChange={e => setDraft({...draft,description_lt:e.target.value})}/></label>
              <>
                  <label>
                    Interneto svetainė
                    <input
                      value={String(draft.website_url || "")}
                      onChange={(e) =>
                        setDraft({ ...draft, website_url: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Logotipas
                    <input
                      value={String(draft.logo_url || "")}
                      onChange={(e) =>
                        setDraft({ ...draft, logo_url: e.target.value })
                      }
                    />
                  </label>
                  <MediaUpload
                    label="Įkelti logotipą"
                    value={String(draft.logo_url || "")}
                    onChange={(v) => setDraft({ ...draft, logo_url: v })}
                  />
              </>
              <div className="editor-two">
                <label>
                  Eiliškumas
                  <input
                    type="number"
                    value={Number(draft.sort_order || 0)}
                    onChange={(e) =>
                      setDraft({ ...draft, sort_order: +e.target.value })
                    }
                  />
                </label>
                <label className="studio-check">
                  <input
                    type="checkbox"
                    checked={Boolean(draft.is_visible)}
                    onChange={(e) =>
                      setDraft({ ...draft, is_visible: e.target.checked })
                    }
                  />{" "}
                  Rodyti svetainėje
                </label>
              </div>
              <button className="settings-save" onClick={() => void saveItem()}>
                Išsaugoti
              </button>
            </div>
          </div>
        )}
        {tab === "stats" && (
          <div className="stats-panel">
            <div className="block-heading">
              <span>04</span>
              <div>
                <h2>Svetainės statistika</h2>
                <p>Puslapių peržiūros nuo statistikos įjungimo.</p>
              </div>
            </div>
            <div className="stat-cards">
              <div>
                <strong>{views.reduce((n, x) => n + x.count, 0)}</strong>
                <span>visos peržiūros</span>
              </div>
              <div>
                <strong>{views.length}</strong>
                <span>lankyti puslapiai</span>
              </div>
            </div>
            <div className="stats-list">
              {views.map((x, i) => (
                <div key={x.path}>
                  <span>{i + 1}</span>
                  <strong>{x.path}</strong>
                  <b>{x.count}</b>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
