import vinext from "vinext";
import { defineConfig } from "vite";

export default defineConfig({
  ssr: {
    external: ["mysql2"],
  },
  plugins: [vinext()],
});
