// Consumer #3: a React app that does NOT import the component. It renders any
// contract-shaped widget through a 20-line adapter. This is how a team on
// React 18 (or Next, or a micro-frontend shell) would host it.
import { StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { WidgetDefinition, WidgetInstance } from "../contract/widget";
import { tableBooker } from "../contract/table-booker.widget";
import { VENUE, availability, isoDate } from "../data/sunset-shack";

const Widget = <P, E,>({ def, props, events }: { def: WidgetDefinition<P, E>; props: P; events?: Partial<E> }) => {
  const el = useRef<HTMLDivElement>(null);
  const inst = useRef<WidgetInstance<P> | null>(null);
  const eventsRef = useRef(events);
  eventsRef.current = events;
  useEffect(() => {
    // Stable forwarders that read the latest handlers from a ref, so a new
    // `events` object on every render never remounts the widget.
    // (Not a Proxy: spreading a Proxy copies no keys, and the handlers vanish.)
    const forward = Object.fromEntries(
      Object.keys(eventsRef.current ?? {}).map((k) => [k, (...a: unknown[]) => (eventsRef.current as any)?.[k]?.(...a)]),
    ) as Partial<E>;
    inst.current = def.mount(el.current!, props, forward);
    return () => { inst.current?.destroy(); inst.current = null; };
  }, [def]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { inst.current?.update(props); }, [props]);
  return <div ref={el} />;
};

const slots = availability(isoDate(new Date()));

const Page = () => {
  const [party, setParty] = useState(2);
  const [log, setLog] = useState<string[]>([]);
  const push = (l: string) => setLog((x) => [l, ...x].slice(0, 30));
  return (
    <div className="page">
      <main>
        <nav className="pages"><a href="./index.html">React app</a><a href="./vanilla.html">Vanilla host</a><a href="./react-host.html">React host via contract</a><a href="./vue.html">Vue host</a></nav>
        <span className="badge">consumer · React, through the contract</span>
        <h1>Hosted, not imported</h1>
        <p className="lede">The page owns <code>partySize</code>; the widget owns everything else.</p>
        <div className="toolbar">
          {[1, 2, 4, 6].map((n) => <button key={n} onClick={() => setParty(n)}>party {n}</button>)}
        </div>
        <Widget
          def={tableBooker}
          props={{ venue: VENUE, slots, partySize: party }}
          events={{ onSelect: ({ slot }) => push(`select ${slot?.id ?? "none"}`), onConfirm: (r) => push(`confirm ${r.slot.id}`) }}
        />
      </main>
      <aside className="log"><h3>Events out</h3>{log.map((l, i) => <div key={i}>{l}</div>)}</aside>
    </div>
  );
};

createRoot(document.getElementById("root")!).render(<StrictMode><Page /></StrictMode>);
