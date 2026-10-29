// Step 2: the MCP App view is just another host of the contract.
// Bridge in (tool result) -> widget.update(). That's the whole adapter.
import { App } from "@modelcontextprotocol/ext-apps";
import { tableBooker, type TableBookerData } from "../contract/table-booker.widget";

const EMPTY_VENUE = { id: "", name: "", area: "", cuisine: "" };

const widget = tableBooker.mount(document.getElementById("root")!, { venue: EMPTY_VENUE, slots: [], loading: true });

const app = new App({ name: "sunset-shack-view", version: "1.0.0" });

// Register handlers BEFORE connect(): the result can arrive right after the handshake.
app.ontoolresult = (result) => {
  const data = result.structuredContent as Partial<TableBookerData> | undefined;
  if (!data?.slots) return;
  widget.update({ ...data, loading: false });
};
app.onerror = (err) => console.error("[view]", err);

app.connect();
