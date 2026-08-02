import js from "@eslint/js";

export default [
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  js.configs.recommended,
  {
    files: ["**/*.js", "**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        document: "readonly",
        window: "readonly",
        IntersectionObserver: "readonly",
        getComputedStyle: "readonly",
        sessionStorage: "readonly",
        requestAnimationFrame: "readonly",
        setTimeout: "readonly",
        console: "readonly",
        process: "readonly",
        URL: "readonly",
      },
    },
  },
];
