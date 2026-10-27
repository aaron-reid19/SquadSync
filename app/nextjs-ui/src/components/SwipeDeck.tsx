import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { Suggestion } from "../lib/data/types";
import { useStore } from "../lib/data/store";
import { emojiFor, priceLabel, toneFor } from "../lib/format";

interface Props {
  cards: Suggestion[]; // the ones I haven't swiped yet, top card first
  total: number;
  onVote: (id: string, like: boolean) => void;
}

const THRESHOLD = 110;

export default function SwipeDeck({ cards, total, onVote }: Props) {
  const { user } = useStore();
  const [drag, setDrag] = useState({ dx: 0, dy: 0, active: false });
  const [leaving, setLeaving] = useState<null | "left" | "right">(null);
  const start = useRef({ x: 0, y: 0 });
  const top = cards[0];

  function fling(like: boolean) {
    if (!top || leaving) return;
    setLeaving(like ? "right" : "left");
    window.setTimeout(() => {
      onVote(top.id, like);
      setLeaving(null);
      setDrag({ dx: 0, dy: 0, active: false });
    }, 220);
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (leaving) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, y: e.clientY };
    setDrag({ dx: 0, dy: 0, active: true });
  }
  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!drag.active) return;
    setDrag({ dx: e.clientX - start.current.x, dy: (e.clientY - start.current.y) * 0.3, active: true });
  }
  function onPointerUp() {
    if (!drag.active) return;
    if (Math.abs(drag.dx) > THRESHOLD) fling(drag.dx > 0);
    else setDrag({ dx: 0, dy: 0, active: false });
  }
  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "ArrowRight") { e.preventDefault(); fling(true); }
    if (e.key === "ArrowLeft") { e.preventDefault(); fling(false); }
  }

  if (!top) return null;

  const dx = leaving === "right" ? 600 : leaving === "left" ? -600 : drag.dx;
  const hint = dx > 40 ? "like" : dx < -40 ? "pass" : null;
  const position = total - cards.length + 1;

  return (
    <div className="deck-wrap">
      <p className="muted small deck__count" aria-live="polite">Card {position} of {total}</p>
      <div className="deck" tabIndex={0} onKeyDown={onKeyDown} aria-label="Activity cards. Use the left and right arrow keys, or the buttons below, to pass or like.">
        {cards.slice(0, 3).reverse().map((s) => {
          const depth = cards.indexOf(s);
          const isTop = depth === 0;
          const style = isTop
            ? {
                transform: `translate(${dx}px, ${drag.dy}px) rotate(${dx / 18}deg)`,
                transition: drag.active && !leaving ? "none" : "transform .22s ease",
              }
            : { transform: `translateY(${depth * 10}px) scale(${1 - depth * 0.04})` };
          const by = user(s.suggestedBy);
          return (
            <div
              key={s.id}
              className={`swipe-card${isTop ? " swipe-card--top" : ""}`}
              style={style}
              aria-hidden={!isTop}
              {...(isTop ? { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp } : {})}
            >
              <div className="swipe-card__art" style={{ background: toneFor(s.category) }}>
                <span aria-hidden="true">{emojiFor(s.category)}</span>
                {isTop && hint === "like" && <span className="stamp stamp--like">YES!</span>}
                {isTop && hint === "pass" && <span className="stamp stamp--pass">NAH</span>}
              </div>
              <div className="swipe-card__body">
                <h3 className="swipe-card__title">{s.title}</h3>
                <p className="muted">{s.category} · {priceLabel(s.price)}</p>
                {s.note && <p>{s.note}</p>}
                <p className="muted small">Suggested by {by?.firstName ?? "someone"} · {s.likes.length} 👍 so far</p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="deck__buttons">
        <button type="button" className="round-btn round-btn--pass" onClick={() => fling(false)} aria-label={`Pass on ${top.title}`}>✕</button>
        <button type="button" className="round-btn round-btn--like" onClick={() => fling(true)} aria-label={`Like ${top.title}`}>♥</button>
      </div>
      <p className="muted small center">Swipe right if you&apos;re keen, left to pass.</p>
    </div>
  );
}
