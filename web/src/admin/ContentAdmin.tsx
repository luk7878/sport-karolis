
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import MediaUpload from "../components/MediaUpload";
import RichEditor from "../components/RichEditor";

type Kind = "articles" | "projects";
type Lang = "lt" | "en";
type Step = "basics" | "content" | "details";
type Row = Record<string, string | boolean | null> & {
  id: string;
  status: string;
};
const article = {
  slug: "",
  title_lt: "",
  title_en: "",
  excerpt_lt: "",
  excerpt_en: "",
  content_lt: "",
  content_en: "",
  image_url: "",
  seo_title_lt: "",
  seo_title_en: "",
  seo_description_lt: "",
  seo_description_en: "",
  social_image_url: "",
  scheduled_at: "",
  status: "draft",
};
const project = {
  slug: "",
  title_lt: "",
  title_en: "",
  summary_lt: "",
  summary_en: "",
  description_lt: "",
  description_en: "",
  goal_lt: "",
  goal_en: "",
  audience_lt: "",
  audience_en: "",
  activities_lt: "",
  activities_en: "",
  outcomes_lt: "",
  outcomes_en: "",
  programme: "",
  project_year: "",
  project_code: "",
  partner_name: "",
  image_url: "",
  gallery_urls: "",
  document_links: "",
  seo_title_lt: "",
  seo_title_en: "",
  seo_description_lt: "",
  seo_description_en: "",
  social_image_url: "",
  scheduled_at: "",
  featured: false,
  status: "draft",
};
const slugify = (v: string) =>
  v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export default function AdminPage() {
  const [user, setUser] = useState("Administratorius");
  const [dirty, setDirty] = useState(false);
  const [recovery, setRecovery] = useState<Record<string,string|boolean> | null>(null);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [kind, setKind] = useState<Kind>("articles"),
    [rows, setRows] = useState<Row[]>([]),
    [form, setForm] = useState<Record<string, string | boolean>>(article),
    [editing, setEditing] = useState<string | null>(null);
  const [lang, setLang] = useState<Lang>("en"),
    [step, setStep] = useState<Step>("basics"),
    [message, setMessage] = useState(""),
    [saving, setSaving] = useState(false),
    [search, setSearch] = useState(""),
    [lastSaved, setLastSaved] = useState(""),
    [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">(
      "desktop",
    );
  useEffect(() => { void supabase.auth.getUser().then(({data}) => setUser(data.user?.email || "Administratorius")); }, []);
  useEffect(() => { setRows([]); void loadRows(); newEntry(); }, [kind]);
  useEffect(() => {
    if (!dirty) return;
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(`lets-draft-${kind}-${editing || "new"}`, JSON.stringify(form));
        setLastSaved(new Date().toLocaleTimeString("lt-LT", { hour: "2-digit", minute: "2-digit" }));
      } catch { setMessage("Naršyklėje nepavyko išsaugoti juodraščio. Išsaugokite mygtuku."); }
    }, 1500);
    return () => clearTimeout(timer);
  }, [form, editing, kind, dirty]);
  async function logout() { await supabase.auth.signOut(); }
  async function loadRows() {
    const { data, error } = await supabase
      .from(kind)
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) setMessage(error.message);
    else setRows((data || []) as Row[]);
  }
  function newEntry() {
    const base = kind === "articles" ? article : project;
    const local =
      typeof window !== "undefined"
        ? localStorage.getItem(`lets-draft-${kind}-new`)
        : null;
    try { setForm(local ? { ...base, ...JSON.parse(local) } : base); }
    catch { setForm(base); }
    setDirty(false); setRecovery(null); setPublishedAt(null); setLastSaved("");
    setEditing(null);
    setStep("basics");
    setLang("en");
    setMessage("");
  }
  function edit(row: Row) {
    const base = kind === "articles" ? article : project,
      next: Record<string, string | boolean> = {};
    Object.keys(base).forEach(
      (k) =>
        (next[k] = (k === "scheduled_at" && row[k] ? new Date(new Date(String(row[k])).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0,16) : row[k] ?? base[k as keyof typeof base]) as string | boolean),
    );
    const saved = localStorage.getItem(`lets-draft-${kind}-${row.id}`);
    setForm(next); setDirty(false); setPublishedAt(row.published_at ? String(row.published_at) : null); setLastSaved(""); setMessage("");
    try { setRecovery(saved ? {...next,...JSON.parse(saved)} : null); } catch { setRecovery(null); }
    setEditing(row.id);
    setStep("basics");
    setLang("en");
  }
  async function save(status?: "draft" | "published") {
    if (!String(form.title_en || form.title_lt).trim()) return setMessage("Įrašykite pavadinimą.");
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(String(form.slug))) return setMessage("Nuorodos adrese naudokite mažąsias lotyniškas raides, skaičius ir brūkšnelius.");
    if (status === "published" && !String(form.title_en || "").trim()) return setMessage("Vieša svetainė yra anglų kalba. Prieš publikavimą įrašykite EN pavadinimą.");
    setSaving(true);
    setMessage("");
    const finalStatus =
      status || (String(form.status) as "draft" | "published");
    const payload = {
      ...form,
      status: finalStatus,
      published_at: publishedAt || (finalStatus === "published" ? (form.scheduled_at ? new Date(String(form.scheduled_at)).toISOString() : new Date().toISOString()) : null),
      scheduled_at: form.scheduled_at ? new Date(String(form.scheduled_at)).toISOString() : null,
    };
    const { data: savedRow, error } = editing
      ? await supabase.from(kind).update(payload).eq("id", editing).select("id").single()
      : await supabase.from(kind).insert(payload).select("id").single();
    setSaving(false);
    if (error) return setMessage(error.message);
    localStorage.removeItem(`lets-draft-${kind}-${editing || "new"}`);
    setEditing(savedRow!.id);
    setForm({ ...form, status: finalStatus });
    setDirty(false); setRecovery(null); setLastSaved(""); setPublishedAt(payload.published_at);
    setMessage(finalStatus === "published" ? (form.scheduled_at && new Date(String(form.scheduled_at)) > new Date() ? "Publikavimas suplanuotas" : "Paskelbta svetainėje") : "Juodraštis išsaugotas");
    await loadRows();
  }
  async function remove(id: string) {
    if (!confirm("Ištrinti šį įrašą?")) return;
    const { error } = await supabase.from(kind).delete().eq("id", id);
    if (error) setMessage(error.message);
    else {
      loadRows();
      localStorage.removeItem(`lets-draft-${kind}-${id}`);
      if (editing === id) newEntry();
    }
  }
  const set = (key: string, value: string | boolean) => { setDirty(true); setForm(current => ({...current,[key]:value})); };
  const input = (
    key: string,
    placeholder: string,
    area = false,
    large = false,
  ) => (
    <div className={`studio-input ${large ? "large" : ""}`}>
      {area ? (
        <textarea
          aria-label={placeholder}
          placeholder={placeholder}
          value={String(form[key] || "")}
          onChange={(e) => set(key, e.target.value)}
        />
      ) : (
        <input
          aria-label={placeholder}
          placeholder={placeholder}
          value={String(form[key] || "")}
          onChange={(e) => set(key, e.target.value)}
          onBlur={(e) =>
            key === `title_${lang}` &&
            !form.slug &&
            set("slug", slugify(e.target.value))
          }
        />
      )}
    </div>
  );
  const filtered = useMemo(
    () =>
      rows.filter((r) =>
        (String(r.title_lt) + " " + String(r.title_en))
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [rows, search],
  );
  const title = String(form[`title_${lang}`] || "");
  const summary = String(
    form[`${kind === "articles" ? "excerpt" : "summary"}_${lang}`] || "",
  );
  const previewUrl =
    editing && form.slug
      ? `${kind === "articles" ? "/news/article/" : "/project/"}?slug=${encodeURIComponent(String(form.slug))}&lang=${lang}`
      : "";

  return (
    <main className="studio">
      <header className="studio-top">
        <div>
          <span className="brand-mark">LETS</span>
          <b>Turinio studija</b>
        </div>
        <div className="studio-top-actions">
          <a href="/" target="_blank" rel="noreferrer">Svetainė ↗</a>
          <a href="/admin/svetaine/">Nustatymai ◫</a>
          <a href="/admin/uzklausos/">Užklausos ✉</a>
          {message && <span className="save-message">{message}</span>}
          {!message && lastSaved && (
            <span className="save-message">
              Naršyklės juodraštis {lastSaved}
            </span>
          )}
          {previewUrl && <a href={`${previewUrl}&preview=1`}>Peržiūrėti ↗</a>}
          {recovery && <button onClick={() => { setForm(recovery);setDirty(true);setRecovery(null);setMessage("Naršyklės juodraštis atkurtas"); }}>Atkurti juodraštį</button>}
          <button
            className="studio-draft"
            disabled={saving}
            onClick={() => save()}
          >
            Išsaugoti
          </button>
          <button
            className="studio-publish"
            disabled={saving}
            onClick={() => save("published")}
          >
            {saving ? "Saugoma…" : "Publikuoti"}
          </button>
          <button className="studio-user" onClick={logout} title={user || ""}>
            ↪
          </button>
        </div>
      </header>
      <aside className="studio-library">
        <div className="library-switch">
          <button
            className={kind === "articles" ? "active" : ""}
            disabled={saving}
            onClick={() => setKind("articles")}
          >
            Naujienos
          </button>
          <button
            className={kind === "projects" ? "active" : ""}
            disabled={saving}
            onClick={() => setKind("projects")}
          >
            Projektai
          </button>
        </div>
        <button className="new-content" disabled={saving} onClick={newEntry}>
          ＋ Naujas {kind === "articles" ? "straipsnis" : "projektas"}
        </button>
        <input
          className="library-search"
          placeholder="Ieškoti…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="library-count">{filtered.length} ĮRAŠAI</div>
        <div className="library-list">
          {filtered.length === 0 && <p className="library-empty">{search ? "Įrašų pagal paiešką nerasta." : "Įrašų dar nėra. Sukurkite pirmąjį."}</p>}
          {filtered.map((row) => (
            <button
              className={`library-item ${editing === row.id ? "selected" : ""}`}
              key={row.id}
              disabled={saving}
              onClick={() => edit(row)}
            >
              <span className={`status-dot ${row.status}`}></span>
              <div>
                <strong>{String(row.title_en || row.title_lt || "Be pavadinimo")}</strong>
                <small>
                  {row.status === "published" ? "Paskelbta" : "Juodraštis"}
                </small>
              </div>
              <b>›</b>
            </button>
          ))}
        </div>
      </aside>
      <section className="studio-workspace">
        <div className="workspace-head">
          <div>
            <small>{editing ? "REDAGUOJAMAS ĮRAŠAS" : "NAUJAS ĮRAŠAS"}</small>
            <h1>
              {title ||
                (kind === "articles"
                  ? "Naujas straipsnis"
                  : "Naujas projektas")}
            </h1>
          </div>
          <div className="language-tabs">
            <button
              className={lang === "lt" ? "active" : ""}
              onClick={() => setLang("en")}
            >
              LT Lietuvių
            </button>
            <button
              className={lang === "en" ? "active" : ""}
              onClick={() => setLang("en")}
            >
              EN English
            </button>
          </div>
        </div>
        <nav className="editor-steps">
          <button
            className={step === "basics" ? "active" : ""}
            onClick={() => setStep("basics")}
          >
            <span>1</span>Pagrindai
          </button>
          <button
            className={step === "content" ? "active" : ""}
            onClick={() => setStep("content")}
          >
            <span>2</span>Turinys
          </button>
          {kind === "projects" && (
            <button
              className={step === "details" ? "active" : ""}
              onClick={() => setStep("details")}
            >
              <span>3</span>Detalės
            </button>
          )}
        </nav>
        <fieldset className="editor-canvas" disabled={saving}>
          {step === "basics" && (
            <>
              <div className="block-heading">
                <span>01</span>
                <div>
                  <h2>Pagrindinė informacija</h2>
                  <p>Tai pirmiausia pamatys svetainės lankytojas.</p>
                </div>
              </div>
              <label className="studio-label">
                Pavadinimas · {lang.toUpperCase()}
              </label>
              {input(
                `title_${lang}`,
                lang === "lt" ? "Įrašykite pavadinimą…" : "Enter title…",
                false,
                true,
              )}
              <label className="studio-label">
                Trumpa įžanga · {lang.toUpperCase()}
              </label>
              {input(
                `${kind === "articles" ? "excerpt" : "summary"}_${lang}`,
                "1–3 sakiniai, pristatantys turinį…",
                true,
              )}
              <div className="media-block">
                <div>
                  <span>▧</span>
                  <h3>Viršelio nuotrauka</h3>
                  <p>Įkelkite failą arba įklijuokite viešą nuorodą.</p>
                </div>
                <div>
                  {input("image_url", "https://…")}
                  <MediaUpload
                    label="Įkelti viršelį"
                    value={String(form.image_url || "")}
                    onChange={(url) => set("image_url", url)}
                  />
                </div>
              </div>
              <details className="technical">
                <summary>Adresas ir techniniai nustatymai</summary>
                <label className="studio-label">Nuorodos adresas</label>
                {input("slug", "pvz. mano-projektas")}
                <label className="studio-label">
                  Publikavimo data ir laikas
                </label>
                <input
                  className="studio-date"
                  type="datetime-local"
                  value={String(form.scheduled_at || "").slice(0, 16)}
                  onChange={(e) => set("scheduled_at", e.target.value)}
                />
                <label className="studio-label">
                  SEO pavadinimas · {lang.toUpperCase()}
                </label>
                {input(`seo_title_${lang}`, "Pavadinimas Google paieškoje")}
                <label className="studio-label">
                  SEO aprašymas · {lang.toUpperCase()}
                </label>
                {input(`seo_description_${lang}`, "Iki 160 simbolių", true)}
                <label className="studio-label">
                  Socialinių tinklų nuotrauka
                </label>
                {input("social_image_url", "https://…")}
                <MediaUpload
                  label="Įkelti socialinę nuotrauką"
                  value={String(form.social_image_url || "")}
                  onChange={(url) => set("social_image_url", url)}
                />
              </details>
            </>
          )}
          {step === "content" && (
            <>
              <div className="block-heading">
                <span>02</span>
                <div>
                  <h2>
                    {kind === "articles"
                      ? "Straipsnio tekstas"
                      : "Projekto pasakojimas"}
                  </h2>
                  <p>
                    Rašykite natūraliai — pastraipas atskirkite tuščia eilute.
                  </p>
                </div>
              </div>
              <label className="studio-label">
                {kind === "articles"
                  ? "Pagrindinis tekstas"
                  : "Išsamus aprašymas"}{" "}
                · {lang.toUpperCase()}
              </label>
              <RichEditor
                value={String(
                  form[
                    `${kind === "articles" ? "content" : "description"}_${lang}`
                  ] || "",
                )}
                onChange={(v) =>
                  set(
                    `${kind === "articles" ? "content" : "description"}_${lang}`,
                    v,
                  )
                }
                placeholder="Pradėkite rašyti…"
              />
              {kind === "projects" && (
                <div className="editor-two">
                  <div>
                    <label className="studio-label">
                      Projekto tikslas · {lang.toUpperCase()}
                    </label>
                    {input(
                      `goal_${lang}`,
                      "Kodėl vykdomas šis projektas?",
                      true,
                    )}
                  </div>
                  <div>
                    <label className="studio-label">
                      Kam skirtas · {lang.toUpperCase()}
                    </label>
                    {input(
                      `audience_${lang}`,
                      "Kas yra projekto dalyviai?",
                      true,
                    )}
                  </div>
                </div>
              )}
            </>
          )}
          {step === "details" && kind === "projects" && (
            <>
              <div className="block-heading">
                <span>03</span>
                <div>
                  <h2>Veiklos ir poveikis</h2>
                  <p>Kiekvieną punktą rašykite naujoje eilutėje.</p>
                </div>
              </div>
              <div className="editor-two">
                <div>
                  <label className="studio-label">
                    Pagrindinės veiklos · {lang.toUpperCase()}
                  </label>
                  {input(
                    `activities_${lang}`,
                    "Dirbtuvės\nDiskusijos\nJaunimo iniciatyvos",
                    true,
                    true,
                  )}
                </div>
                <div>
                  <label className="studio-label">
                    Numatomas poveikis · {lang.toUpperCase()}
                  </label>
                  {input(
                    `outcomes_${lang}`,
                    "Nauji įgūdžiai\nDidesnis įsitraukimas",
                    true,
                    true,
                  )}
                </div>
              </div>
              <div className="project-data">
                <h3>Projekto duomenys</h3>
                <div className="editor-two">
                  {input("programme", "Programa, pvz. Erasmus+ KA154")}
                  {input("project_year", "Metai")}
                  {input("project_code", "Projekto kodas")}
                  {input("partner_name", "Partneris / pareiškėjas")}
                </div>
                <label className="studio-check">
                  <input
                    type="checkbox"
                    checked={Boolean(form.featured)}
                    onChange={(e) => set("featured", e.target.checked)}
                  />
                  <span>Rodyti kaip išskirtinį projektą</span>
                </label>
                <label className="studio-label">Galerijos nuotraukos</label>
                {input(
                  "gallery_urls",
                  "Po vieną viešą nuotraukos nuorodą kiekvienoje eilutėje",
                  true,
                )}
                <MediaUpload
                  label="Įkelti nuotraukas"
                  multiple
                  value={String(form.gallery_urls || "")}
                  onChange={(v) => set("gallery_urls", v)}
                />
                <label className="studio-label">Projekto dokumentai</label>
                {input(
                  "document_links",
                  "Pavadinimas|https://nuoroda.pdf\nPo vieną dokumentą kiekvienoje eilutėje",
                  true,
                )}
                <MediaUpload
                  label="Įkelti dokumentą"
                  multiple
                  accept="application/pdf"
                  value={String(form.document_links || "")}
                  onChange={(v) => set("document_links", v)}
                />
              </div>
            </>
          )}
        </fieldset>
      </section>
      <aside className="studio-preview">
        <div className="preview-label">
          GYVA PERŽIŪRA{" "}
          <span className="device-switch">
            <button
              className={previewDevice === "desktop" ? "active" : ""}
              onClick={() => setPreviewDevice("desktop")}
            >
              ▱
            </button>
            <button
              className={previewDevice === "mobile" ? "active" : ""}
              onClick={() => setPreviewDevice("mobile")}
            >
              ▯
            </button>
          </span>
        </div>
        <div className={`preview-card ${previewDevice}`}>
          {form.image_url ? (
            <img src={String(form.image_url)} alt="" />
          ) : (
            <div className="preview-placeholder">LETS</div>
          )}
          <div>
            <small>
              {kind === "articles"
                ? lang === "lt"
                  ? "STRAIPSNIS"
                  : "ARTICLE"
                : String(form.programme) || "PROJECT"}
            </small>
            <h2>{title || "Pavadinimas atsiras čia"}</h2>
            <p>
              {summary ||
                "Trumpas aprašymas padės suprasti, apie ką šis įrašas."}
            </p>
          </div>
        </div>
        <div className="publish-box">
          <span className={`status-dot ${form.status}`}></span>
          <div>
            <strong>
              {form.status === "published" ? "Paskelbta" : "Juodraštis"}
            </strong>
            <p>
              {form.status === "published"
                ? form.scheduled_at && new Date(String(form.scheduled_at)) > new Date() ? "Įrašas pasirodys suplanuotu laiku." : "Įrašą mato svetainės lankytojai."
                : "Įrašas matomas tik administravime."}
            </p>
          </div>
        </div>
        {editing && form.status === "published" && <button className="delete-entry" onClick={() => save("draft")}>Paslėpti · grąžinti į juodraštį</button>}
        {editing && (
          <button className="delete-entry" onClick={() => remove(editing)}>
            Ištrinti įrašą
          </button>
        )}
      </aside>
    </main>
  );
}
