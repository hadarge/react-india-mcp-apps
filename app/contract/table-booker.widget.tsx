// The adapter: the React implementation stays exactly as it was; this file
// wraps it in the framework-free contract. React is an implementation detail
// bundled inside; the host never imports React.
import { createRoot } from "react-dom/client";
import { TableBooker } from "../component/TableBooker";
import type { TableBookerProps } from "../component/types";
import type { WidgetDefinition } from "./widget";

type EventKeys = "onSelect" | "onConfirm" | "onCancel";
export type TableBookerData = Omit<TableBookerProps, EventKeys>;
export type TableBookerEvents = Required<Pick<TableBookerProps, EventKeys>>;

export const tableBooker: WidgetDefinition<TableBookerData, TableBookerEvents> = {
  name: "table-booker",
  version: "1.0.0",
  mount(el, props, events = {}) {
    const root = createRoot(el);
    let current = props;
    let alive = true;
    const render = () => root.render(<TableBooker {...current} {...events} />);
    render();
    return {
      update(next) {
        if (!alive) return;
        current = { ...current, ...next };
        render();
      },
      destroy() {
        if (!alive) return;
        alive = false;
        root.unmount(); // runs every effect cleanup, incl. the keydown listener
      },
    };
  },
};
