import { UIEvent, useEffect, useRef, useState } from "react";
import { PrivacyPolicy, TermsOfUse } from "../content/policies";

type Doc = "terms" | "privacy";
const TITLES: Record<Doc, string> = { terms: "Terms of Use", privacy: "Privacy Policy" };

interface Props {
  checked: boolean;
  error?: string;
  onChange: (checked: boolean) => void;
}

export default function ConsentSection({ checked, error, onChange }: Props) {
  const [open, setOpen] = useState<Doc | null>(null);
  const [read, setRead] = useState<Record<Doc, boolean>>({ terms: false, privacy: false });
  const [atEnd, setAtEnd] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const ready = read.terms && read.privacy;

  // The native <dialog> gives us focus trapping and Esc to close for free.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // If the text is short enough to fit without scrolling, count it as reached.
  useEffect(() => {
    const el = bodyRef.current;
    if (!open || !el) return;
    el.scrollTop = 0;
    setAtEnd(read[open] || el.scrollHeight <= el.clientHeight + 8);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function onScroll(e: UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 8) setAtEnd(true);
  }

  function finish() {
    if (open) setRead((r) => ({ ...r, [open]: true }));
    setOpen(null);
  }

  return (
    <div id="acceptTerms" tabIndex={-1} className="consent">
      <p className="consent__lead">Before you join, please read our policies.</p>
      <div className="consent__docs">
        {(["terms", "privacy"] as const).map((doc) => (
          <button key={doc} type="button" className="btn btn--small" onClick={() => setOpen(doc)}>
            {read[doc] ? "✓ " : ""}Read {TITLES[doc]}
          </button>
        ))}
      </div>

      <div className="check">
        <input
          id="acceptTerms-box"
          type="checkbox"
          checked={checked}
          disabled={!ready}
          onChange={(e) => onChange(e.target.checked)}
          aria-describedby={!ready ? "consent-hint" : error ? "acceptTerms-error" : undefined}
        />
        <label htmlFor="acceptTerms-box">I have read and agree to the Terms of Use and Privacy Policy.</label>
      </div>
      {!ready && <p id="consent-hint" className="field__hint">Open and read both documents to enable this box.</p>}
      {error && <p id="acceptTerms-error" className="field__error">{error}</p>}

      <dialog ref={dialogRef} className="policy" aria-labelledby="policy-title" onClose={() => setOpen(null)}>
        {open && (
          <>
            <h2 id="policy-title" className="policy__title">{TITLES[open]}</h2>
            <div ref={bodyRef} className="policy__body" tabIndex={0} onScroll={onScroll}>
              {open === "terms" ? <TermsOfUse /> : <PrivacyPolicy />}
            </div>
            <div className="policy__foot">
              <span>{atEnd ? "Thanks for reading." : "Scroll to the end to continue."}</span>
              <button type="button" className="btn btn--primary btn--small" disabled={!atEnd} onClick={finish}>
                I've read this
              </button>
            </div>
          </>
        )}
      </dialog>
    </div>
  );
}