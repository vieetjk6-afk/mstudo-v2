import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Theme-aware tokens — these follow the CSS variables so they switch
        // automatically between the light (default) and dark themes.
        bg: "var(--bg)",
        bg2: "var(--bg2)",
        surface: "var(--surface)",
        surface2: "var(--surface2)",
        ink: {
          950: "var(--bg)",
          900: "var(--bg2)",
          850: "var(--surface)",
          800: "var(--surface2)",
          700: "var(--surface2)",
          600: "var(--border2)",
        },
        // text tokens
        fg: "var(--text)",
        accent: {
          DEFAULT: "var(--accent)",
          muted: "var(--text2)",
          faint: "var(--text3)",
          ink: "var(--accentInk)",
          gold: "var(--gold)",
        },
        logo: "var(--logo)",
      },
      borderColor: {
        subtle: "var(--border)",
        strong: "var(--border2)",
      },
      fontFamily: {
        sans: ["var(--font-manrope, Manrope)", "var(--font-hanken, 'Hanken Grotesk')", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        serif: ["var(--font-cormorant, 'Cormorant Garamond')", "Georgia", "serif"],
      },
      animation: {
        "vk-fade": "vkFade .6s ease both",
        "vk-pop": "vkPop .45s ease both",
        "vk-overlay": "vkOverlay .3s ease both",
        "vk-toast": "vkToast .35s ease both",
      },
      keyframes: {
        vkFade: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "none" },
        },
        vkPop: {
          from: { opacity: "0", transform: "scale(.985)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        vkOverlay: { from: { opacity: "0" }, to: { opacity: "1" } },
        vkToast: {
          from: { opacity: "0", transform: "translate(-50%,14px)" },
          to: { opacity: "1", transform: "translate(-50%,0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
