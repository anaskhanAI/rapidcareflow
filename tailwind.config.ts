// Tailwind v4 uses CSS-first configuration via @theme in globals.css
// This file is kept for backwards compatibility but most config lives in globals.css
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
  ],
};

export default config;
