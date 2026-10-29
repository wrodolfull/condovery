"use client";
import { useRef, useState } from "react";
import { clientUUID } from "@/lib/client-uuid";
export function PushComposer() {
  const [title, setTitle] = useState(""),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const key = useRef<string | null>(null);
  return (
    <section className="white-panel form-stack" style={{ marginTop: 24 }}>
      <h2>
        Avisos do condomínio
      </h2>
      <p>
        Publique um aviso institucional para os moradores deste condomínio.{" "}
        A notificação push depende da permissão e das preferências no
        aplicativo.
      </p>
      <label>
        Título
        <input
          value={title}
          maxLength={70}
          disabled={busy}
          onChange={(e) => {
            setTitle(e.target.value);
            key.current = null;
          }}
        />
      </label>
      <label>
        Mensagem
        <textarea
          value={text}
          maxLength={240}
          disabled={busy}
          onChange={(e) => {
            setText(e.target.value);
            key.current = null;
          }}
        />
      </label>
      <button
        className="primary-button"
        disabled={busy || title.trim().length < 3 || text.trim().length < 3}
        onClick={async () => {
          if (
            !window.confirm(
              "Publicar este aviso e notificar os moradores elegíveis?",
            )
          )
            return;
          setBusy(true);
          setMessage("");
          key.current ??= clientUUID();
          try {
            const r = await fetch(
              "/api/admin/push/announcements",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  title: title.trim(),
                  body: text.trim(),
                  client_key: key.current,
                }),
              },
            );
            const data = await r.json();
            if (!r.ok)
              throw new Error(data.error || "Não foi possível publicar.");
            setMessage(
              "Aviso publicado para " +
                data.recipients +
                " moradores. Os dispositivos habilitados receberão o push após o processamento.",
            );
            setTitle("");
            setText("");
            key.current = null;
          } catch (e) {
            setMessage(
              e instanceof Error ? e.message : "Não foi possível publicar.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Publicando…" : "Publicar aviso"}
      </button>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
