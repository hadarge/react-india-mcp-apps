// The contract. Framework-free on purpose: any host that can hand over a DOM
// element can run a widget, whether it is React, Vue, vanilla JS, or an MCP
// App view inside Claude / ChatGPT.
//
//   mount   -> the host gives you an element and initial props
//   update  -> the host pushes new props (partial)
//   events  -> you call the host back; it never reaches into your state
//   destroy -> you remove everything you added (DOM, listeners, timers)

export interface WidgetInstance<Props> {
  update(next: Partial<Props>): void;
  destroy(): void;
}

export interface WidgetDefinition<Props, Events> {
  name: string;
  version: string;
  mount(el: HTMLElement, props: Props, events?: Partial<Events>): WidgetInstance<Props>;
}
