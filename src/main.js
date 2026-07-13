import { createApp } from "vue";
import { VanduoVue } from "@vanduo-oss/vd3";
import App from "./App.vue";

// vd3's full stylesheet (design tokens, component CSS, fonts, regular/fill icons).
import "@vanduo-oss/vd3/css";
// App-owned styles: token bridge, chess board, and the refreshed chrome.
import "./styles/index.css";

const app = createApp(App);

// vd3 is fully standalone (pure Vue, no window.Vanduo* runtime to bootstrap).
// The plugin seeds Aurora Polaris' default theme:
//   light → black primary, dark → amber primary, stone neutral in both,
//   0.375 radius, Ubuntu font, Open Color palette.
app.use(VanduoVue, {
  themeDefaults: {
    PALETTE: "open-color",
    PRIMARY_LIGHT: "black",
    PRIMARY_DARK: "amber",
    NEUTRAL: "stone",
    RADIUS: "0.375",
    FONT: "ubuntu",
  },
});

app.mount("#app");
