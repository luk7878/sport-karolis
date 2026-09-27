
import { useRef, useState } from "react";
import { supabase } from "../lib/supabase";

export default function MediaUpload({
  label,
  value,
  onChange,
  accept = "image/*",
  multiple = false,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  accept?: string;
  multiple?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError("");
    const urls: string[] = [];
    for (const file of Array.from(files).slice(0, multiple ? 20 : 1)) {
      const allowed = accept === "application/pdf" ? ["application/pdf"] : ["image/jpeg","image/png","image/webp","image/gif","image/avif"];
      if (file.size > 10 * 1024 * 1024 || !allowed.includes(file.type)) {
        setError("Rinkitės JPG, PNG, WebP, GIF, AVIF nuotrauką arba PDF dokumentą iki 10 MB."); continue;
      }
      const safe = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-");
      const path = `${new Date().getFullYear()}/${crypto.randomUUID()}-${safe}`;
      const { error } = await supabase.storage
        .from("site-media")
        .upload(path, file);
      if (error) {
        setError(error.message);
        continue;
      }
      const url = supabase.storage.from("site-media").getPublicUrl(path).data.publicUrl;
      urls.push(accept === "application/pdf" ? `${file.name.replaceAll("|", "-")}|${url}` : url);
    }
    setBusy(false);
    if (urls.length)
      onChange(
        multiple ? [value, ...urls].filter(Boolean).join("\n") : urls[0],
      );
  }
  return (
    <div
      className="media-uploader"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        void upload(e.dataTransfer.files);
      }}
    >
      <input
        ref={ref}
        hidden
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={(e) => void upload(e.target.files)}
      />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={busy}
      >
        {busy ? "Įkeliama…" : `＋ ${label}`}
      </button>
      <span>arba nutempkite failą čia · iki 10 MB</span>
      {error && <small>{error}</small>}
    </div>
  );
}
