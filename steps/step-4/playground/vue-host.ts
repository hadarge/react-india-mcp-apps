// Consumer #4: Vue 3. Same contract, a different framework, no fork of the component.
import { createApp, defineComponent, h, onBeforeUnmount, onMounted, ref, watch, type PropType } from "vue";
import type { WidgetDefinition, WidgetInstance } from "../contract/widget";
import { tableBooker } from "../contract/table-booker.widget";
import { VENUE, availability, isoDate } from "../data/sunset-shack";

const ContractWidget = defineComponent({
  props: {
    def: { type: Object as PropType<WidgetDefinition<any, any>>, required: true },
    data: { type: Object, required: true },
  },
  emits: ["select", "confirm", "cancel"],
  setup(props, { emit }) {
    const el = ref<HTMLElement>();
    let inst: WidgetInstance<any> | null = null;
    onMounted(() => {
      inst = props.def.mount(el.value!, { ...props.data }, {
        onSelect: (e: unknown) => emit("select", e),
        onConfirm: (e: unknown) => emit("confirm", e),
        onCancel: (e: unknown) => emit("cancel", e),
      });
    });
    watch(() => props.data, (d) => inst?.update({ ...d }), { deep: true });
    onBeforeUnmount(() => inst?.destroy());
    return () => h("div", { ref: el });
  },
});

const App = defineComponent({
  setup() {
    const party = ref(2);
    const log = ref<string[]>([]);
    const slots = availability(isoDate(new Date()));
    return () =>
      h("div", { class: "page" }, [
        h("main", [
          h("nav", { class: "pages" }, [
            h("a", { href: "./index.html" }, "React app"), h("a", { href: "./vanilla.html" }, "Vanilla host"),
            h("a", { href: "./react-host.html" }, "React host via contract"), h("a", { href: "./vue.html" }, "Vue host"),
          ]),
          h("span", { class: "badge" }, "consumer · Vue 3"),
          h("h1", "Same contract, Vue host"),
          h("p", { class: "lede" }, "Vue owns partySize. The widget is the same bundle the other pages use."),
          h("div", { class: "toolbar" }, [1, 2, 4, 6].map((n) => h("button", { onClick: () => (party.value = n) }, `party ${n}`))),
          h(ContractWidget, {
            def: tableBooker,
            data: { venue: VENUE, slots, partySize: party.value },
            onSelect: (e: any) => log.value.unshift(`select ${e.slot?.id ?? "none"}`),
            onConfirm: (e: any) => log.value.unshift(`confirm ${e.slot.id}`),
          }),
        ]),
        h("aside", { class: "log" }, [h("h3", "Events out"), ...log.value.map((l) => h("div", l))]),
      ]);
  },
});

createApp(App).mount("#app");
