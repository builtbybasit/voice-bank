import { createRouter, createWebHashHistory } from "vue-router";
import CharacterGrid from "@/components/CharacterGrid.vue";
import CharacterView from "@/components/CharacterView.vue";

export const router = createRouter({
  history: createWebHashHistory(),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    { path: "/", redirect: "/genshin" },
    { path: "/:wiki", name: "grid", component: CharacterGrid },
    { path: "/:wiki/:name", name: "character", component: CharacterView },
  ],
});
export const go = (wiki: string, name = "", lang = "en") =>
  router.push({
    name: name ? "character" : "grid",
    params: name ? { wiki, name } : { wiki },
    query: lang === "en" ? {} : { lang },
  });
