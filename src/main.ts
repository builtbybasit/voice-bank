import { createApp } from "vue";
import App from "./App.vue";
import { init } from "./store.ts";
import "./style.css";

void init().then(() => createApp(App).mount("#app"));
