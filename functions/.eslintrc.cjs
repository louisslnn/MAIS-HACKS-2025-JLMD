module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: "./tsconfig.json",
    tsconfigRootDir: __dirname,
  },
  plugins: ["@typescript-eslint", "import"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:import/recommended",
    "plugin:import/typescript",
    "prettier",
  ],
  env: {
    es2022: true,
    node: true,
  },
  rules: {
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "@typescript-eslint/explicit-function-return-type": "off",
    "import/order": [
      "error",
      {
        "groups": [
          "builtin",
          "external",
          "internal",
          ["parent", "sibling", "index"],
          "object",
          "type"
        ],
        "alphabetize": {
          "order": "asc",
          "caseInsensitive": true
        }
      }
    ]
  }
};
