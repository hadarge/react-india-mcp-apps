// Step 4: the same adapter, hardened for real hosts.
//  1. Handlers before connect().
//  2. Mount is not call: show a skeleton on tool-input, time out from THERE, handle cancel.
//  3. The tool result is a pointer; pull the data through an app-only tool.
//  4. Theme from the host context.
//  5. Report height explicitly (autoResize measures the frame, which some hosts constrain).
import { App, applyDocumentTheme, applyHostFonts, applyHostStyleVariables, type McpUiHostContext } from "@modelcontextprotocol/ext-apps";
import { tableBooker, type TableBookerData } from "../contract/table-booker.widget";
import type { Reservation } from "../component/types";
import "./host-theme.css";

const NO_RESULT_MS = 25_000; // production p99.9 was ~6 s; give generous headroom
const EMPTY_VENUE = { id: "", name: "", area: "", cuisine: "" };

const app = new App({ name: "sunset-shack-view", version: "1.0.0" }, {}, { autoResize: false });
const root = document.getElementById("root")!;
const firstText = (r: { content?: { type: string; text?: string }[] }) => r.content?.find((c) => c.type === "text")?.text ?? "";

let query: { from?: string; partySize?: number } = {};
let noResultTimer: ReturnType<typeof setTimeout> | undefined;

const widget = tableBooker.mount(root, { venue: EMPTY_VENUE, slots: [], loading: true }, {
  onSelect: () => {},
  onConfirm: async ({ slot, partySize, name, note }) => {
    widget.update({ status: "submitting", error: null });
    try {
      const result = await app.callServerTool({
        name: "book_table",
        arguments: { slotId: slot.id, partySize, name, note, idempotencyKey: crypto.randomUUID() },
      });
      if (result.isError) return widget.update({ status: "error", error: firstText(result) || "Booking failed" });
      const reservation = (result.structuredContent as { reservation: Reservation }).reservation;
      widget.update({ status: "idle", reservation });
      void load(); // refresh the grid behind the confirmation (seats changed)
      app.updateModelContext({ content: [{ type: "text", text: `The user booked a table in the picker: ${firstText(result)}` }] }).catch(() => {});
    } catch (err) {
      widget.update({ status: "error", error: (err as Error).message });
    }
  },
  onCancel: async (reservation) => {
    widget.update({ status: "submitting" });
    const result = await app.callServerTool({ name: "cancel_booking", arguments: { ref: reservation.ref } });
    if (result.isError) return widget.update({ status: "error", error: firstText(result), reservation });
    widget.update({ status: "idle", reservation: null });
    // Every result is a snapshot: re-pull availability so the freed seats show up.
    void load();
    app.updateModelContext({ content: [{ type: "text", text: `The user cancelled booking ${reservation.ref}.` }] }).catch(() => {});
  },
});

const load = async () => {
  try {
    const res = await app.callServerTool({ name: "load_slots", arguments: { ...query } });
    if (res.isError) throw new Error(firstText(res));
    widget.update({ ...(res.structuredContent as Partial<TableBookerData>), loading: false, status: "idle", error: null });
  } catch (err) {
    widget.update({ loading: false, status: "error", error: `Could not load tables: ${(err as Error).message}` });
  }
};

const applyHostContext = (ctx?: Partial<McpUiHostContext>) => {
  if (!ctx) return;
  if (ctx.theme) applyDocumentTheme(ctx.theme);
  if (ctx.styles?.variables) {
    applyHostStyleVariables(ctx.styles.variables);
    document.documentElement.setAttribute("data-host-styles", "");
  }
  if (ctx.styles?.css?.fonts) applyHostFonts(ctx.styles.css.fonts);
};

// 1. Handlers first.
app.ontoolinput = ({ arguments: args }) => {
  // The model has started the call. The iframe may have mounted minutes earlier.
  // find_table takes { partySize, date }; load_slots takes { from, partySize }. Map, don't spread:
  // load_slots is .strict(), so passing `date` through would be rejected.
  const a = (args ?? {}) as { partySize?: number; date?: string };
  query = { partySize: a.partySize, ...(a.date ? { from: a.date } : {}) };
  widget.update({ loading: true });
  clearTimeout(noResultTimer);
  noResultTimer = setTimeout(() => widget.update({ loading: false, status: "error", error: "The assistant never finished this request. Ask it again." }), NO_RESULT_MS);
};
app.ontoolresult = (result) => {
  clearTimeout(noResultTimer);
  // Count keys: a reloaded chat may hand you `{}` (truthy!) instead of your data.
  const q = (result.structuredContent as { query?: typeof query } | undefined)?.query;
  if (q && Object.keys(q).length) query = q;
  void load();
};
app.ontoolcancelled = () => {
  clearTimeout(noResultTimer);
  widget.update({ loading: false, status: "error", error: "Cancelled." });
};
app.onhostcontextchanged = (ctx) => applyHostContext(ctx);
app.onteardown = async () => {
  widget.destroy();
  return {};
};
app.onerror = (err) => console.error("[view]", err);

// 5. Height: measure the content, report only real changes (else the frame grows in a loop).
let lastHeight = 0;
new ResizeObserver(() => {
  const h = Math.ceil(root.getBoundingClientRect().height);
  if (h && h !== lastHeight) {
    lastHeight = h;
    app.sendSizeChanged({ height: h }).catch(() => {});
  }
}).observe(root);

// 2. Then connect.
await app.connect();
applyHostContext(app.getHostContext());
