import { createApp } from "vue";
import App from "@/App.vue";
import { router } from "@/router.ts";
import { init } from "@/store.ts";
import "@/style.css";

void init().then(() => createApp(App).use(router).mount("#app"));
