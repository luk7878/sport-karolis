

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Status = "new" | "read" | "replied" | "archived";
type Inquiry = {
  id: string;
  name: string;
  email: string;
  organization: string;
  topic: string;
  message: string;
  language: string;
  status: Status;
  created_at: string;
  internal_notes: string;
  assignee: string;
  tags: string;
};

const topicNames: Record<string, string> = {
  general: "Bendras klausimas",
  project: "Projektas",
  partnership: "Partnerystė",
  volunteering: "Savanorystė",
  media: "Žiniasklaida",
};

export default function InquiriesPage() {
  const [items, setItems] = useState<Inquiry[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return location.replace("/admin");
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", auth.user.id)
      .single();
    if (!profile?.is_admin) return location.replace("/admin");
    const { data, error } = await supabase
      .from("inquiries")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) setErrorMessage(error.message);
    const rows = (data || []) as Inquiry[];
    setItems(rows);
    setSelected(rows[0]?.id || null);
    setLoading(false);
  }

  const visible = useMemo(
    () =>
      items.filter(
        (item) =>
          (filter === "all" || item.status === filter) &&
          `${item.name} ${item.email} ${item.organization} ${item.message} ${item.tags}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [items, filter, search],
  );
  const current = items.find((item) => item.id === selected);
  const newCount = items.filter((item) => item.status === "new").length;

  async function open(item: Inquiry) {
    setSelected(item.id);
    if (item.status === "new") await changeStatus(item.id, "read");
  }

  async function changeStatus(id: string, status: Status) {
    const { error } = await supabase
      .from("inquiries")
      .update({ status })
      .eq("id", id);
    if (error) setErrorMessage(error.message);
    if (!error)
      setItems((list) =>
        list.map((item) => (item.id === id ? { ...item, status } : item)),
      );
  }
  async function updateField(
    id: string,
    key: "internal_notes" | "assignee" | "tags",
    value: string,
  ) {
    setItems((list) =>
      list.map((x) => (x.id === id ? { ...x, [key]: value } : x)),
    );
    const { error } = await supabase.from("inquiries").update({[key]:value}).eq("id",id).select("id").single();
    setErrorMessage(error ? error.message : "Išsaugota");
  }

  async function remove(id: string) {
    if (!confirm("Ištrinti šią užklausą?")) return;
    const { error } = await supabase.from("inquiries").delete().eq("id", id);
    if (error) setErrorMessage(error.message);
    if (!error) {
      const next = items.filter((item) => item.id !== id);
      setItems(next);
      setSelected(next[0]?.id || null);
    }
  }

  if (loading)
    return <main className="admin-loading">Kraunamos užklausos…</main>;

  return (
    <main className="inbox">
      <header className="studio-top">
        <div>
          <span className="brand-mark">LETS</span>
          <b>Gautos užklausos</b>
        </div>
        <div className="studio-top-actions">
          {errorMessage && <span className="save-message" role="status">{errorMessage}</span>}
          <a href="/admin/">← Turinio studija</a>
          <a href="/contacts/">Kontaktų puslapis ↗</a>
        </div>
      </header>
      <aside className="inbox-sidebar">
        <p>PAŠTO DĖŽUTĖ</p>
        {(["all", "new", "read", "replied", "archived"] as const).map(
          (status) => (
            <button
              key={status}
              className={filter === status ? "active" : ""}
              onClick={() => setFilter(status)}
            >
              <span>
                {status === "all"
                  ? "Visos"
                  : status === "new"
                    ? "Naujos"
                    : status === "read"
                      ? "Perskaitytos"
                      : status === "replied"
                        ? "Atsakytos"
                        : "Archyvas"}
              </span>
              {status === "new" && newCount > 0 && <b>{newCount}</b>}
            </button>
          ),
        )}
      </aside>
      <section className="inbox-list">
        <div className="inbox-list-head">
          <b>{visible.length} užklausos</b>
          <span>Naujausios viršuje</span>
        </div>
        <input
          className="inbox-search"
          placeholder="Ieškoti užklausose…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {visible.length === 0 && (
          <div className="inbox-empty">Šiame aplanke užklausų nėra.</div>
        )}
        {visible.map((item) => (
          <button
            key={item.id}
            className={`${selected === item.id ? "active" : ""} ${item.status === "new" ? "unread" : ""}`}
            onClick={() => void open(item)}
          >
            <div>
              <strong>{item.name}</strong>
              <time>
                {new Date(item.created_at).toLocaleDateString("lt-LT")}
              </time>
            </div>
            <b>{topicNames[item.topic] || item.topic}</b>
            <p>{item.message}</p>
          </button>
        ))}
      </section>
      <article className="inbox-reader">
        {!current ? (
          <div className="inbox-empty">Pasirinkite užklausą.</div>
        ) : (
          <>
            <div className="reader-kicker">
              <span className={`status-${current.status}`}>
                {current.status === "new"
                  ? "Nauja"
                  : current.status === "read"
                    ? "Perskaityta"
                    : current.status === "replied"
                      ? "Atsakyta"
                      : "Archyve"}
              </span>
              <span>{topicNames[current.topic]}</span>
            </div>
            <h1>{current.name}</h1>
            <div className="reader-meta">
              <a href={`mailto:${current.email}`}>{current.email}</a>
              {current.organization && <span>{current.organization}</span>}
              <time>
                {new Date(current.created_at).toLocaleString("lt-LT")}
              </time>
            </div>
            <div className="reader-message">{current.message}</div>
            <div className="inquiry-crm">
              <label>
                Atsakingas žmogus
                <input
                  value={current.assignee || ""}
                  placeholder="Vardas arba el. paštas"
                  onChange={e => setItems(list => list.map(x => x.id === current.id ? {...x,assignee:e.target.value} : x))}
                  onBlur={e => void updateField(current.id,"assignee",e.target.value)}
                />
              </label>
              <label>
                Žymos
                <input
                  value={current.tags || ""}
                  placeholder="partnerystė, skubu…"
                  onChange={e => setItems(list => list.map(x => x.id === current.id ? {...x,tags:e.target.value} : x))}
                  onBlur={e => void updateField(current.id,"tags",e.target.value)}
                />
              </label>
              <label>
                Vidinės pastabos
                <textarea
                  value={current.internal_notes || ""}
                  placeholder="Šias pastabas mato tik administratoriai"
                  onChange={e => setItems(list => list.map(x => x.id === current.id ? {...x,internal_notes:e.target.value} : x))}
                  onBlur={e => void updateField(current.id,"internal_notes",e.target.value)}
                />
              </label>
            </div>
            <div className="reader-actions">
              <a
                className="reply"
                href={`mailto:${current.email}?subject=${encodeURIComponent("Re: Jūsų užklausa LETS komandai")}`}
              >
                Atsakyti el. paštu ↗
              </a>
              {current.status !== "replied" && <button onClick={() => void changeStatus(current.id,"replied")}>Pažymėti atsakyta</button>}
              {current.status !== "archived" && (
                <button
                  onClick={() => void changeStatus(current.id, "archived")}
                >
                  Archyvuoti
                </button>
              )}
              <button
                className="danger"
                onClick={() => void remove(current.id)}
              >
                Ištrinti
              </button>
            </div>
          </>
        )}
      </article>
    </main>
  );
}
