// Consumer #2: plain DOM. If this works, the component is no longer "a React component";
// it is a unit with a contract.
import { tableBooker, type TableBookerData } from "../contract/table-booker.widget";
import type { WidgetInstance } from "../contract/widget";
import { VENUE, availability, isoDate } from "../data/sunset-shack";

const el = document.getElementById("widget")!;
const log = (msg: string) => {
  const line = document.createElement("div");
  line.textContent = `${new Date().toLocaleTimeString()}  ${msg}`;
  document.getElementById("log")!.append(line);
};

const initial: TableBookerData = { venue: VENUE, slots: availability(isoDate(new Date())), partySize: 2 };
let widget: WidgetInstance<TableBookerData> | null = null;

const mount = () => {
  widget = tableBooker.mount(el, initial, {
    onSelect: ({ slot, partySize }) => log(`select ${slot?.id ?? "none"} (party ${partySize})`),
    onConfirm: (req) => {
      log(`confirm ${req.slot.id} for ${req.partySize} (${req.name})`);
      widget?.update({ status: "submitting" });
      setTimeout(() => widget?.update({ status: "idle", reservation: { ref: "SS-VAN1", slotId: req.slot.id, partySize: req.partySize, name: req.name, status: "confirmed" } }), 500);
    },
    onCancel: () => { log("cancel"); widget?.update({ reservation: null }); },
  });
  log("mounted");
};

const on = (id: string, fn: () => void) => document.getElementById(id)!.addEventListener("click", fn);
on("party4", () => widget?.update({ partySize: 4 }));
on("confirmed", () => {
  const slot = initial.slots.find((s) => s.seatsLeft >= 2)!;
  widget?.update({ reservation: { ref: "SS-DEMO1", slotId: slot.id, partySize: 2, name: "Demo", status: "confirmed" } });
});
on("loading", () => widget?.update({ loading: true }));
on("destroy", () => { widget?.destroy(); widget = null; log("destroyed: press Esc, nothing should log"); });
on("remount", () => { if (!widget) mount(); });

mount();
