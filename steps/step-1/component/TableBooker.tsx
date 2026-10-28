import { useEffect, useMemo, useState } from "react";
import type { Slot, TableBookerProps, Zone } from "./types";
import "./table-booker.css";

const ZONES: { id: Zone | "all"; label: string }[] = [
  { id: "all", label: "Any table" },
  { id: "beach", label: "On the sand" },
  { id: "deck", label: "Sunset deck" },
  { id: "indoor", label: "Indoor" },
];

const formatDay = (date: string) => {
  const d = new Date(`${date}T12:00:00`);
  return {
    weekday: d.toLocaleDateString("en-IN", { weekday: "short" }),
    day: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
  };
};

const formatMoney = (minor: number, currency: string) => {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(minor / 100);
};

/**
 * A realistic booking widget: props in, internal state, events out, and one
 * global side effect (a keyboard listener) that must be cleaned up.
 */
export const TableBooker = ({
  venue,
  slots,
  currency = "INR",
  partySize: initialPartySize = 2,
  reservation = null,
  status = "idle",
  error = null,
  loading = false,
  onSelect,
  onConfirm,
  onCancel,
}: TableBookerProps) => {
  const days = useMemo(() => [...new Set(slots.map((s) => s.date))].sort(), [slots]);
  const [day, setDay] = useState<string | null>(null);
  const [zone, setZone] = useState<Zone | "all">("all");
  const [partySize, setPartySize] = useState(initialPartySize);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");

  const activeDay = day && days.includes(day) ? day : days[0] ?? null;
  const selected = slots.find((s) => s.id === selectedId) ?? null;

  // Props can change after mount (a host pushes new data). Keep state consistent.
  useEffect(() => setPartySize(initialPartySize), [initialPartySize]);
  useEffect(() => {
    if (selectedId && !slots.some((s) => s.id === selectedId)) setSelectedId(null);
  }, [slots, selectedId]);

  // Global side effect: Escape clears the selection. Must be removed on unmount.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") select(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const select = (slot: Slot | null, size = partySize) => {
    setSelectedId(slot?.id ?? null);
    onSelect?.({ slot, partySize: size });
  };

  const changePartySize = (next: number) => {
    const size = Math.min(12, Math.max(1, next));
    setPartySize(size);
    if (selected && selected.seatsLeft < size) select(null, size);
  };

  if (loading) {
    return (
      <div className="tb tb--loading" aria-busy="true">
        <div className="tb-skel tb-skel--title" />
        <div className="tb-skel tb-skel--row" />
        <div className="tb-skel tb-skel--grid" />
      </div>
    );
  }

  if (reservation && reservation.status === "confirmed") {
    const slot = slots.find((s) => s.id === reservation.slotId);
    const when = slot ? `${formatDay(slot.date).weekday} ${formatDay(slot.date).day}, ${slot.time}` : "";
    return (
      <div className="tb tb--done">
        <div className="tb-done-badge" aria-hidden>✓</div>
        <h2 className="tb-title">Table booked at {venue.name}</h2>
        <p className="tb-muted">
          {when} · {reservation.partySize} {reservation.partySize === 1 ? "guest" : "guests"}
          {slot ? ` · ${ZONES.find((z) => z.id === slot.zone)?.label}` : ""}
        </p>
        <p className="tb-ref">
          Ref <code>{reservation.ref}</code>
        </p>
        {onCancel && (
          <button className="tb-btn tb-btn--ghost" onClick={() => onCancel(reservation)} disabled={status === "submitting"}>
            Cancel booking
          </button>
        )}
      </div>
    );
  }

  const daySlots = slots.filter((s) => s.date === activeDay && (zone === "all" || s.zone === zone));
  const times = [...new Set(daySlots.map((s) => s.time))].sort();
  const canConfirm = !!selected && name.trim().length > 1 && status !== "submitting";

  return (
    <div className="tb">
      <header className="tb-head">
        {venue.imageUrl ? <img className="tb-logo" src={venue.imageUrl} alt="" /> : <div className="tb-logo tb-logo--blank" aria-hidden>🌴</div>}
        <div>
          <h2 className="tb-title">{venue.name}</h2>
          <p className="tb-muted">
            {venue.area} · {venue.cuisine}
          </p>
        </div>
        <label className="tb-party">
          <span className="tb-muted">Guests</span>
          <span className="tb-stepper">
            <button aria-label="Fewer guests" onClick={() => changePartySize(partySize - 1)}>−</button>
            <output>{partySize}</output>
            <button aria-label="More guests" onClick={() => changePartySize(partySize + 1)}>+</button>
          </span>
        </label>
      </header>

      <nav className="tb-days" aria-label="Day">
        {days.map((d) => {
          const f = formatDay(d);
          return (
            <button key={d} className={d === activeDay ? "is-on" : ""} onClick={() => setDay(d)}>
              <span>{f.weekday}</span>
              <strong>{f.day}</strong>
            </button>
          );
        })}
      </nav>

      <div className="tb-zones" role="radiogroup" aria-label="Seating">
        {ZONES.map((z) => (
          <button key={z.id} role="radio" aria-checked={zone === z.id} className={zone === z.id ? "is-on" : ""} onClick={() => setZone(z.id)}>
            {z.label}
          </button>
        ))}
      </div>

      <div className="tb-grid">
        {times.length === 0 && <p className="tb-muted">No tables for this filter. Try another day or seating.</p>}
        {times.map((t) => (
          <div className="tb-time" key={t}>
            <span className="tb-time-label">{t}</span>
            <div className="tb-time-slots">
              {daySlots
                .filter((s) => s.time === t)
                .map((s) => {
                  const full = s.seatsLeft < partySize;
                  return (
                    <button
                      key={s.id}
                      className={`tb-slot tb-slot--${s.zone}${s.id === selectedId ? " is-on" : ""}`}
                      disabled={full}
                      onClick={() => select(s.id === selectedId ? null : s)}
                      title={full ? `Only ${s.seatsLeft} seats left` : undefined}
                    >
                      <span>{ZONES.find((z) => z.id === s.zone)?.label}</span>
                      <small>{full ? "Full for your party" : s.minSpend ? `Min ${formatMoney(s.minSpend, currency)} pp` : `${s.seatsLeft} seats`}</small>
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
      </div>

      <footer className={`tb-foot${selected ? " is-open" : ""}`}>
        {selected ? (
          <>
            <div className="tb-fields">
              <input name="name" autoComplete="name" placeholder="Name for the booking" value={name} onChange={(e) => setName(e.target.value)} />
              <input name="note" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <button
              className="tb-btn"
              disabled={!canConfirm}
              onClick={() => selected && onConfirm?.({ slot: selected, partySize, name: name.trim(), note: note.trim() })}
            >
              {status === "submitting" ? "Booking…" : `Book ${selected.time} for ${partySize}`}
            </button>
          </>
        ) : (
          <p className="tb-muted">Pick a time to continue. Esc clears.</p>
        )}
        {status === "error" && error && <p className="tb-error" role="alert">{error}</p>}
      </footer>
    </div>
  );
};
