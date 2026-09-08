// eslint.config.js
const { defineConfig } = require("eslint/config");
const jsdocPlugin = require("eslint-plugin-jsdoc");
const listenersPlugin = require("eslint-plugin-listeners");
const promisePlugin = require("eslint-plugin-promise");
const securityPlugin = require("eslint-plugin-security");
const tsParser = require("@typescript-eslint/parser");
const tsPlugin = require("@typescript-eslint/eslint-plugin");
const reactPlugin = require("eslint-plugin-react");

module.exports = defineConfig([
    {
        ignores: ["node_modules/**", "dist/**", ".cache/**", "public/**", "eslint.config.js"],
        files: ["src/**/*.ts", "src/**/*.tsx", "vite.config.ts"],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                project: "./tsconfig.json",
                tsconfigRootDir: __dirname,
                ecmaFeatures: {
                    jsx: true,
                },
            },
        },
        plugins: {
            jsdoc: jsdocPlugin,
            listeners: listenersPlugin,
            promise: promisePlugin,
            security: securityPlugin,
            "@typescript-eslint": tsPlugin,
            react: reactPlugin,
        },
        settings: {
            react: {
                version: "detect",
            },
        },
        extends: [
            // securityPlugin.configs.recommended
        ],
        rules: {
            ////////////////////////////
            /** Clean Code Directives */
            ////////////////////////////

            // Enforce function complexity limit to keep functions maintainable
            complexity: ["off", { max: 20 }],
            // Enforce maximum number of parameters to keep functions simple
            "max-params": ["warn", 8],
            // Limit nesting depth to improve readability
            "max-depth": ["warn", 10],
            // Enforce consistent return statements (all or none)
            "consistent-return": "warn",
            // Require default case in switch statements for completeness
            "default-case": "warn",
            // Require default parameters to be last for consistency
            "default-param-last": "warn",
            // Disallow empty functions (except arrow functions and constructors)
            "no-empty-function": ["warn", { allow: ["constructors", "overrideMethods"] }],
            // Disallow empty catch blocks to prevent silent failures
            "no-empty": ["warn", { allowEmptyCatch: false }],
            // Disallow magic numbers (use named constants instead)
            "no-magic-numbers": [
                "off",
                {
                    ignore: [-1, 0, 1],
                    ignoreArrayIndexes: true,
                    ignoreDefaultValues: true,
                    enforceConst: true,
                    detectObjects: true,
                },
            ],

            ////////////////////////////////
            /** Advanced Clean Code Rules */
            ////////////////////////////////

            // Prefer early returns to reduce nesting
            // "no-else-return": ["warn", { allowElseIf: true }], // Disabled because it warns against exhaustive checks - jvalles 20251227
            // Disallow unreachable code after return statements
            "no-unreachable": "warn",

            // Enforce that there be a removeEventListener for all events that have an addEventListener attached
            "listeners/no-missing-remove-event-listener": "off",
            // Enforces that the handler for a removeEventListener is the same handler that was passed in to the associated addEventListener
            "listeners/matching-remove-event-listener": "off",
            // Enforces that the handlers for addEventListener are not inline functions
            "listeners/no-inline-function-event-listener": "warn",

            // Prefer async/await to the callback pattern.
            "promise/prefer-await-to-callbacks": "warn",
            // Prefer async/await to the then pattern.
            "promise/prefer-await-to-then": "warn",

            ////////////////////
            /** Documentation */
            ////////////////////

            // Require JSDoc comments for public functions, classes, interfaces and types
            "jsdoc/require-jsdoc": [
                "off",
                {
                    require: {
                        ClassDeclaration: true,
                        MethodDefinition: false,
                        FunctionExpression: false,
                        FunctionDeclaration: false,
                        ArrowFunctionExpression: false,
                    },
                    contexts: [
                        {
                            context: "MethodDefinition[accessibility='public']:not([kind='constructor'])",
                            inlineCommentBlock: true,
                        },
                        {
                            context: "TSInterfaceDeclaration",
                        },
                        {
                            context: "TSPropertySignature",
                            inlineCommentBlock: true,
                        },
                        {
                            context: "TSTypeAliasDeclaration",
                            inlineCommentBlock: true,
                        },
                        {
                            context: "TSModuleDeclaration",
                        },
                    ],
                    fixerMessage: " TODO: Add JSDoc comment.",
                    exemptEmptyConstructors: true,
                },
            ],
            // Require parameters JSDoc comments for public functions
            "jsdoc/require-param": [
                "off",
                {
                    contexts: ["MethodDefinition[accessibility='public']:not([kind='constructor'])"],
                },
            ],
            // Require return JSDoc comments for public functions
            "jsdoc/require-returns": [
                "off",
                {
                    contexts: ["MethodDefinition[accessibility='public']:not([kind='constructor'])"],
                },
            ],

            /////////////////
            /** JavaScript */
            /////////////////

            // Always use === and !==
            eqeqeq: ["warn", "always"],
            // Disallow unused expressions (e.g., x && doSomething())
            "no-unused-expressions": "warn",
            // Disallow console.log in production code
            "no-console": ["warn", { allow: ["error", "warn", "info", "table"] }],
            // Enforce consistent spacing before and after keywords
            "padding-line-between-statements": [
                "warn",
                { blankLine: "always", prev: "block-like", next: "*" },
                // Functions
                { blankLine: "always", prev: "*", next: "function" },
                { blankLine: "always", prev: "block-like", next: "return" },
                // Classes
                { blankLine: "always", prev: "*", next: "class" },
                // Imports
                { blankLine: "always", prev: ["cjs-import", "import"], next: "*" },
                { blankLine: "any", prev: ["cjs-import", "import"], next: ["cjs-import", "import"] },
                // Exports
                { blankLine: "any", prev: ["cjs-export", "export"], next: ["cjs-export", "export"] },
                { blankLine: "always", prev: ["cjs-export", "export"], next: "*" },
                { blankLine: "any", prev: "*", next: ["cjs-export", "export"] },
            ],
            // Disallow ternary operators when simpler alternatives exist
            "no-unneeded-ternary": "warn",
            // Disallow returning values from Promise executor functions
            "no-promise-executor-return": "warn",
            // Disallow using an async function as a Promise executor
            "no-async-promise-executor": "warn",

            /////////////////
            /** TypeScript */
            /////////////////

            // Require explicit return types on public functions
            "@typescript-eslint/explicit-function-return-type": [
                "warn",
                {
                    allowExpressions: true,
                    allowTypedFunctionExpressions: true,
                    allowHigherOrderFunctions: true,
                    allowedNames: ["mapStateToProps"],
                },
            ],
            // Enforce explicit types on module boundaries
            "@typescript-eslint/explicit-module-boundary-types": ["warn"],
            // Disallow unused variables in general (but allow unused vars prefixed with _)
            "@typescript-eslint/no-unused-vars": [
                "warn",
                {
                    args: "none", // Disable warnings for unused function arguments, a problem for named properties - jvalles 20251227
                    argsIgnorePattern: "^_",
                    caughtErrors: "all",
                    caughtErrorsIgnorePattern: "^_",
                    destructuredArrayIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                    ignoreRestSiblings: true,
                },
            ],
            // Use T[] for array types
            "@typescript-eslint/array-type": ["warn", { default: "array" }],
            // Prefer namespace keyword
            "@typescript-eslint/prefer-namespace-keyword": "warn",
            // Disallow floating (un‑awaited) promises
            "@typescript-eslint/no-floating-promises": "warn",
            // Require consistent use of type assertions
            "@typescript-eslint/consistent-type-imports": [
                "warn",
                {
                    prefer: "type-imports",
                    disallowTypeAnnotations: false,
                },
            ],
            // Prefer nullish coalescing over logical OR for null/undefined checks
            "@typescript-eslint/prefer-nullish-coalescing": "warn",
            // Prefer optional chaining over complex conditional checks
            "@typescript-eslint/prefer-optional-chain": "warn",
            // Prefer readonly arrays when mutation is not needed
            "@typescript-eslint/prefer-readonly": "warn",
            // Prefer string includes() method over indexOf comparisons
            "@typescript-eslint/prefer-string-starts-ends-with": "warn",
            // Warn against non-null assertions for safer code
            "@typescript-eslint/no-non-null-assertion": "warn",
            // Warn against the use of the any type
            "@typescript-eslint/no-explicit-any": "warn",

            ////////////
            /** React */
            ////////////

            // Enforce consistent JSX quote style
            "jsx-quotes": ["warn", "prefer-double"],
            // Prevent duplicate props in JSX
            "react/jsx-no-duplicate-props": ["warn", { ignoreCase: true }],
            // Prevent usage of dangerous JSX props
            "react/no-danger": "warn",
            // Prevent direct mutation of this.state
            "react/no-direct-mutation-state": "warn",
            // Prevent usage of setState in componentDidMount
            "react/no-did-mount-set-state": "warn",
            // Prevent usage of setState in componentDidUpdate
            "react/no-did-update-set-state": "warn",
            // Prevent usage of isMounted (anti-pattern)
            "react/no-is-mounted": "warn",
            // Prevent usage of unknown DOM property
            "react/no-unknown-property": "warn",
            // Prevent missing React when using JSX
            "react/react-in-jsx-scope": "off", // Off for React 17+ with new JSX transform
            // Require render methods to have a definite return
            "react/require-render-return": "off", // Removed, this causes no real problems - jvalles 20251223
            // Prevent extra closing tags for components without children
            "react/self-closing-comp": [
                "warn",
                {
                    component: true,
                    html: true,
                },
            ],
            // Enforce JSX props and children spacing
            "react/jsx-props-no-multi-spaces": "warn",
            // Enforce consistent JSX indentation
            "react/jsx-indent": ["warn", 4],
            // Enforce consistent JSX prop indentation
            "react/jsx-indent-props": ["warn", 4],
            // Enforce PascalCase for component names
            "react/jsx-pascal-case": [
                "warn",
                {
                    allowAllCaps: true,
                    allowNamespace: true
                },
            ],
            // Prevent usage of the return value of React.render
            "react/no-render-return-value": "warn",
            // Allow normal content authoring in JSX without wrapping every literal
            "react/jsx-no-literals": "off",
            // Enforce consistent function component definition style
            "react/function-component-definition": [
                "warn",
                {
                    namedComponents: "arrow-function",
                    unnamedComponents: "arrow-function",
                },
            ],
            // Enforce consistent JSX closing bracket location
            "react/jsx-closing-bracket-location": ["warn", "line-aligned"],
            // Enforce consistent JSX closing tag location
            "react/jsx-closing-tag-location": "warn",
            // Enforce consistent JSX tag spacing
            "react/jsx-tag-spacing": [
                "warn",
                {
                    closingSlash: "never",
                    beforeSelfClosing: "always",
                    afterOpening: "never",
                    beforeClosing: "never",
                },
            ],
            // Enforce boolean attributes notation in JSX
            "react/jsx-boolean-value": ["warn", "never"],
            // Enforce or disallow spaces inside of curly braces in JSX attributes
            "react/jsx-curly-spacing": ["warn", "never", { allowMultiline: true }],
            // Enforce consistent JSX curly brace presence
            "react/jsx-curly-brace-presence": [
                "warn",
                {
                    props: "always",
                    children: "always",
                },
            ],
            // Prevent missing key prop in iterators/collection literals
            "react/jsx-key": [
                "warn",
                {
                    checkFragmentShorthand: true,
                    checkKeyMustBeforeSpread: true,
                },
            ],
            // Prevent usage of Array index in keys
            "react/no-array-index-key": "warn",
            // Prevent usage of deprecated methods
            "react/no-deprecated": "warn",
            // Enforce stateless components to be written as a pure function
            "react/prefer-stateless-function": ["warn", { ignorePureComponents: true }],
            // Enforce consistent usage of destructuring assignment of props and context
            "react/jsx-props-no-spreading": [
                "warn",
                {
                    html: "enforce",
                    custom: "enforce",
                    explicitSpread: "ignore",
                    exceptions: [],
                },
            ],
            // Disallow usage of stopPropagation in React components - jvalles 20251225
            "no-restricted-syntax": [
                "warn",
                {
                    selector: "CallExpression[callee.property.name='stopPropagation']",
                    message: "Using stopPropagation is generally not allowed in React components as it can interfere with event handling."
                }
            ],

            //////////////////////////////
            /** React Performance Rules */
            //////////////////////////////

            // Prevent usage of setState in componentWillUpdate
            "react/no-will-update-set-state": "warn",
            // Prevent usage of inline event handlers for performance
            "react/jsx-no-bind": [
                "warn",
                {
                    ignoreRefs: true,
                    allowArrowFunctions: true,
                    allowFunctions: false,
                    allowBind: false,
                },
            ],

            ////////////////
            /** Stylistic */
            ////////////////

            // Enforce consistent indentation (4 spaces)
            indent: ["warn", 4, { SwitchCase: 1 }],
            // Enforce double quotes (allow template literals)
            quotes: ["warn", "double", { avoidEscape: true }],
            // Require semicolons
            semi: ["warn", "always"],
            // Max line length (250 chars)
            "max-len": ["off", { code: 250, ignoreComments: true }],
            // Require braces in all control statements
            curly: ["warn", "multi-line", "consistent"],
            // Disallow extraneous parentheses
            "no-extra-parens": [
                "warn",
                "all",
                { ignoreJSX: "multi-line" }
            ],
            "react/jsx-curly-brace-presence": "off",
            /**
             * It's organized from most specific to least specific selectors.
             *
             * Key principles:
             * - Private members have distinct patterns for easy identification
             * - Constants are clearly marked with UPPER_CASE
             * - Classes and types use PascalCase
             * - Interfaces, types and enums are prefixed with I, T and E respectively
             * - Methods and variables use camelCase
             * - Clear distinction between public and private APIs
             */
            "@typescript-eslint/naming-convention": [
                "warn",

                // CLASSES - Standard conventions for class names
                {
                    selector: "class",
                    format: ["PascalCase"],
                    leadingUnderscore: "forbid",
                    trailingUnderscore: "forbid",
                },

                // PRIVATE MEMBERS - Special rules for private class members and properties
                {
                    selector: "classProperty",
                    modifiers: ["private"],
                    format: ["camelCase"],
                    trailingUnderscore: "require", // Private fields must end with _
                    leadingUnderscore: "forbid",
                },
                {
                    selector: "classMethod",
                    modifiers: ["private"],
                    format: ["camelCase"],
                    trailingUnderscore: "require", // Private fields must end with _
                    leadingUnderscore: "forbid",
                },

                // PUBLIC MEMBERS - Standard conventions for public APIs
                {
                    selector: "method",
                    modifiers: ["public"],
                    format: ["camelCase"],
                    leadingUnderscore: "forbid",
                    trailingUnderscore: "forbid",
                },

                // CONSTANTS - Clear visual distinction for constants
                {
                    selector: "variable",
                    modifiers: ["const", "exported", "global"],
                    types: ["boolean", "number", "string", "array"],
                    format: ["UPPER_CASE"],
                    leadingUnderscore: "forbid",
                    trailingUnderscore: "forbid",
                },

                // FUNCTIONS - Standard function naming
                {
                    selector: "function",
                    format: ["camelCase"],
                    leadingUnderscore: "forbid",
                    trailingUnderscore: "forbid",
                },

                // VARIABLES - General variable naming
                {
                    selector: "variable",
                    modifiers: ["const", "global"],
                    format: ["PascalCase", "camelCase", "UPPER_CASE"],
                    leadingUnderscore: "forbid",
                    trailingUnderscore: "forbid",
                },
                {
                    selector: "variable",
                    format: ["camelCase"],
                    leadingUnderscore: "allow", // We need this for unsued vars prefixed with _ (e.g. _exhaustiveCheck) - jvalles 20251223
                    trailingUnderscore: "forbid",
                },

                // TYPES AND INTERFACES
                {
                    selector: "interface",
                    format: null, // disables default formatting enforcement
                    custom: {
                        regex: "^(I[A-Z][a-zA-Z0-9_]*|[A-Z][a-zA-Z0-9_]*)$", // I followed by PascalCase (allow underscore) - jvalles 20251223
                        match: true,
                    },
                },
                {
                    selector: "typeAlias",
                    format: null, // disables default formatting enforcement
                    custom: {
                        // T or I followed by PascalCase (allow underscore) - jvalles 20251223
                        regex: "^(T[A-Z][a-zA-Z0-9_]*|I[A-Z][a-zA-Z0-9_]*|[A-Z][a-zA-Z0-9_]*)$",
                        match: true,
                    },
                },
                {
                    selector: "enum",
                    format: ["PascalCase"],
                    prefix: ["E"],
                },
                {
                    selector: "enumMember",
                    format: ["UPPER_CASE"], // Enum values should be UPPER_CASE
                },

                // GENERICS - Single letter or PascalCase with T prefix
                {
                    selector: "typeParameter",
                    format: null, // disables default formatting enforcement
                    custom: {
                        regex: "^T(?:$|_?[A-Za-z0-9]+)$", // T followed by PascalCase
                        match: true,
                    },
                },

                // IMPORTS - Standard import naming
                {
                    selector: "import",
                    format: ["camelCase", "PascalCase"],
                    leadingUnderscore: "forbid",
                    trailingUnderscore: "forbid",
                },

                // EXCEPTIONS - Allow quoted properties and destructured vars
                {
                    selector: ["classProperty", "objectLiteralProperty", "typeProperty"],
                    format: null, // No format checking for quoted properties
                    modifiers: ["requiresQuotes"],
                },
                {
                    selector: "variable",
                    modifiers: ["destructured"],
                    format: null, // Allow destructured variables to keep original name
                },
            ],
        },
    },
]);