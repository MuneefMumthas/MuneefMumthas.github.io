import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://muneefmumthas.github.io",
  devToolbar: { enabled: false },
  build: { inlineStylesheets: "always" },
});
