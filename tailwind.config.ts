import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: { extend: { colors: { ink: "#17221d", leaf: "#16845b", mist: "#f5f7f5" }, boxShadow: { soft: "0 8px 30px rgba(20,35,27,.05)" } } },
  plugins: []
};
export default config;