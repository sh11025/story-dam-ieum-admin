import js from '@eslint/js';
import ts from 'typescript-eslint';
export default ts.config(
  { ignores: ['dist/**', 'node_modules/**'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...ts.configs.recommended],
    rules: { 'no-empty': ['error', { allowEmptyCatch: true }] },
  },
);
