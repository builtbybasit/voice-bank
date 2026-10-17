import { createApp } from "vue";
import App from "./App.vue";
import { init, router } from "./store.ts";
import "./style.css";

void init().then(() => createApp(App).use(router).mount("#app"));
