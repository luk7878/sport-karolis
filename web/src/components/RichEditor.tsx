
import { useRef } from "react";
export default function RichEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  function wrap(before: string, after = before) {
    const el = ref.current;
    if (!el) return;
    const a = el.selectionStart,
      b = el.selectionEnd,
      selected = value.slice(a, b) || "tekstas";
    onChange(value.slice(0, a) + before + selected + after + value.slice(b));
    setTimeout(() => el.focus());
  }
  return (
    <div className="rich-editor">
      <div className="rich-toolbar">
        <button type="button" onClick={() => wrap("**")}>
          B
        </button>
        <button type="button" onClick={() => wrap("_", "_")}>
          <i>I</i>
        </button>
        <button type="button" onClick={() => wrap("## ", "")}>
          H2
        </button>
        <button type="button" onClick={() => wrap("- ", "")}>
          • Sąrašas
        </button>
        <button type="button" onClick={() => wrap("[", "](https://)")}>
          ↗ Nuoroda
        </button>
        <button type="button" onClick={() => wrap("> ", "")}>
          ❝ Citata
        </button>
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <small>
        Galite naudoti antraštes, sąrašus, paryškinimą, citatas ir nuorodas.
      </small>
    </div>
  );
}
