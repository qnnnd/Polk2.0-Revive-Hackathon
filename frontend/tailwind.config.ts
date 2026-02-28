import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0b0d12",
        card: "#121625",
        muted: "#9aa4b2",
        line: "#232a3d",
        accent: "#6ee7ff",
        "accent-purple": "#a78bfa",
      },
    },
  },
  plugins: [],
};
export default config;
