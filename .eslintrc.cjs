module.exports = {
  env: { node: true, es2022: true },
  extends: ["eslint:recommended", "plugin:import/recommended", "prettier"],
  parserOptions: { ecmaVersion: "latest", sourceType: "script" },
  rules: {
    "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
    "import/no-unresolved": "off" // commonjs requires
  }
};