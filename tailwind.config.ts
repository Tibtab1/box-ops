import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "#f4ede0",
        "paper-dark": "#e8dcc4",
        ink: "#1a2332",
        "ink-light": "#2d3e55",
        blueprint: "#1e5aa8",
        "blueprint-light": "#4a8bd4",
        "blueprint-pale": "#c5d9f0",
        safety: "#e8602c",
        "safety-dark": "#c44a1c",
        kraft: "#8b6f47",
        "kraft-light": "#b89968",
      },
      fontFamily: {
        display: ["'Fraunces'", "'Georgia'", "serif"],
        mono: ["'JetBrains Mono'", "'Courier New'", "monospace"],
        body: ["'Inter Tight'", "system-ui", "sans-serif"],
      },
      boxShadow: {
        stamp: "2px 2px 0 #1a2332",
        "stamp-lg": "4px 4px 0 #1a2332",
        "stamp-safety": "3px 3px 0 #e8602c",
        "stamp-blueprint": "3px 3px 0 #1e5aa8",
      },
    },
  },
  plugins: [],
};
export default config;
