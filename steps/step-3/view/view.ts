// Step 3: events out. The contract's events become bridge calls:
//   onConfirm -> callServerTool("book_table")   (app-only write, goes to YOUR server)
//             -> updateModelContext(...)        (tell the model; a hint, not a guarantee)
import { App } from "@modelcontextprotocol/ext-apps";
import { tableBooker, type TableBookerData } from "../contract/table-booker.widget";
import type { Reservation } from "../component/types";

const EMPTY_VENUE = { id: "", name: "", area: "", cuisine: "" };
const app = new App({ name: "sunset-shack-view", version: "1.0.0" });

const firstText = (r: { content?: { type: string; text?: string }[] }) => r.content?.find((c) => c.type === "text")?.text ?? "";

const widget = tableBooker.mount(
  document.getElementById("root")!,
  { venue: EMPTY_VENUE, slots: [], loading: true },
  {
    onSelect: () => {},
    onConfirm: async ({ slot, partySize, name, note }) => {
      widget.update({ status: "submitting", error: null });
      try {
        const result = await app.callServerTool({
          name: "book_table",
          arguments: { slotId: slot.id, partySize, name, note, idempotencyKey: crypto.randomUUID() },
        });
        if (result.isError) {
          widget.update({ status: "error", error: firstText(result) || "Booking failed" });
          return;
        }
        const reservation = (result.structuredContent as { reservation: Reservation }).reservation;
        widget.update({ status: "idle", reservation });
        // Best effort: hosts MAY defer or drop this. The server stays the source of truth.
        app.updateModelContext({ content: [{ type: "text", text: `The user booked a table in the picker: ${firstText(result)}` }] }).catch(() => {});
      } catch (err) {
        widget.update({ status: "error", error: (err as Error).message });
      }
    },
    onCancel: async (reservation) => {
      widget.update({ status: "submitting" });
      const result = await app.callServerTool({ name: "cancel_booking", arguments: { ref: reservation.ref } });
      widget.update({ status: "idle", reservation: result.isError ? reservation : null });
      if (!result.isError) app.updateModelContext({ content: [{ type: "text", text: `The user cancelled booking ${reservation.ref}.` }] }).catch(() => {});
    },
  },
);

app.ontoolresult = (result) => {
  const data = result.structuredContent as Partial<TableBookerData> | undefined;
  if (!data?.slots) return;
  widget.update({ ...data, loading: false });
};
app.onerror = (err) => console.error("[view]", err);

app.connect();
