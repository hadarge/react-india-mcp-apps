// Consumer #1: an ordinary React app that imports the component directly.
// This is where most components live today, and where they get stuck.
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { TableBooker } from "../component/TableBooker";
import type { BookingRequest, Reservation } from "../component/types";
import { VENUE, availability, isoDate } from "../data/sunset-shack";

const slots = availability(isoDate(new Date()));

const Page = () => {
  const [log, setLog] = useState<string[]>([]);
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [status, setStatus] = useState<"idle" | "submitting">("idle");
  const push = (line: string) => setLog((l) => [line, ...l].slice(0, 30));

  const confirm = async (req: BookingRequest) => {
    push(`confirm ${JSON.stringify({ slot: req.slot.id, partySize: req.partySize, name: req.name })}`);
    setStatus("submitting");
    await new Promise((r) => setTimeout(r, 600)); // pretend API call
    setReservation({ ref: "SS-" + Math.random().toString(36).slice(2, 7).toUpperCase(), slotId: req.slot.id, partySize: req.partySize, name: req.name, status: "confirmed" });
    setStatus("idle");
  };

  return (
    <div className="page">
      <main>
        <nav className="pages"><a href="./index.html">React app</a><a href="./vanilla.html">Vanilla host</a><a href="./react-host.html">React host via contract</a><a href="./vue.html">Vue host</a></nav>
        <span className="badge">consumer · React app</span>
        <h1>Book a table</h1>
        <p className="lede">The component as it lives today: imported into a React tree.</p>
        <TableBooker
          venue={VENUE}
          slots={slots}
          reservation={reservation}
          status={status}
          onSelect={({ slot, partySize }) => push(`select ${slot?.id ?? "none"} (party ${partySize})`)}
          onConfirm={confirm}
          onCancel={() => { push("cancel"); setReservation(null); }}
        />
      </main>
      <aside className="log">
        <h3>Events out</h3>
        {log.length === 0 ? <div>Click a time slot…</div> : log.map((l, i) => <div key={i}>{l}</div>)}
      </aside>
    </div>
  );
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Page />
  </StrictMode>,
);
