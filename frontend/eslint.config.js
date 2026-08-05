// SEC-SAST — ESLint flat config (ESLint 9). Two jobs in one:
//   1. ordinary correctness linting for a React/TS SPA, and
//   2. the security-focused rules devsecops.md §3.2 calls for
//      (eslint-plugin-security), which is why this is wired into the SAST
//      workflow rather than only being a local developer convenience.
//
// The dashboard renders attacker-controlled content -- an email's subject,
// sender, and body-derived fields all originate from whoever sent the mail --
// so DOM-XSS sinks are the class of bug most worth failing a PR over here.
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import security from 'eslint-plugin-security';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  security.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // react-hooks v7 correctness rules. The 9 pre-existing violations these
      // surfaced are fixed, so they gate at error to keep the class of bug out.
      'react-hooks/set-state-in-effect': 'error',
      'react-hooks/purity': 'error',
      'react-hooks/refs': 'error',

      // detect-object-injection fires on ANY obj[key] with a non-literal key
      // -- 17 hits here, all ordinary array indexing and Record lookups on
      // internally-derived keys, none attacker-controlled. It's the rule this
      // plugin is most known for false-positiving on. Kept at warn so a
      // genuinely suspicious case is still visible in the log, rather than
      // demanding 17 inline suppressions of non-issues (which would train
      // everyone to add suppressions reflexively).
      'security/detect-object-injection': 'warn',

      // The real gate. `dangerouslySetInnerHTML` is the one API that can turn
      // a phishing email's subject line into executing script in an analyst's
      // browser, so it's an error, not a warning.
      'react/no-danger': 'off', // eslint-plugin-react isn't installed; covered by no-restricted-syntax below
      'no-restricted-syntax': [
        'error',
        {
          selector: 'JSXAttribute[name.name="dangerouslySetInnerHTML"]',
          message:
            'dangerouslySetInnerHTML renders unescaped HTML. Detection fields (subject, sender, body excerpts) are attacker-controlled — render them as text, or sanitize explicitly and justify it here.',
        },
      ],

      // Unused vars are noise-level, not correctness — warn, and allow the
      // conventional _-prefix escape hatch.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Test files: object-injection warnings on fixture indexing are pure
    // noise, and `any` in a mock is not a security finding.
    files: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
    rules: {
      'security/detect-object-injection': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
