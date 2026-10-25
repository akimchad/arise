/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#F4EFE6",
        paper: "#FBF8F2",
        ink: "#121110",
        muted: "#6E6A62",
        line: "#E2DBCE",
        orange: { DEFAULT: "#FF5A1F", deep: "#E8460C", soft: "#FFE3D6" },
        sage: "#C9D3BC",
        forest: "#1E3328",
        night: "#111111",
      },
      fontFamily: {
        display: ['"Inter Tight"', "Inter", "system-ui", "sans-serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        serif: ['"Instrument Serif"', "Georgia", "serif"],
      },
      letterSpacing: { tightest: "-0.055em", tighter2: "-0.035em" },
      boxShadow: {
        card: "0 1px 2px rgba(18,17,16,.04), 0 12px 32px -12px rgba(18,17,16,.16)",
        lift: "0 2px 4px rgba(18,17,16,.06), 0 30px 60px -20px rgba(18,17,16,.35)",
        glow: "0 10px 30px -8px rgba(255,90,31,.55)",
      },
      keyframes: {
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-10px)" } },
        shimmer: { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
        marquee: { "0%": { transform: "translateX(0)" }, "100%": { transform: "translateX(-50%)" } },
        spinslow: { to: { transform: "rotate(360deg)" } },
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        "float-slow": "float 8s ease-in-out infinite",
        shimmer: "shimmer 1.8s linear infinite",
        marquee: "marquee 40s linear infinite",
        spinslow: "spinslow 18s linear infinite",
      },
    },
  },
  plugins: [],
};
