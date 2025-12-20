import prettier from 'eslint-config-prettier';
import svelte from 'eslint-plugin-svelte';
import convex from '@convex-dev/eslint-plugin';
import svelteParser from 'svelte-eslint-parser';
import tseslint from 'typescript-eslint';
import js from '@eslint/js';
import globals from 'globals';

export default [
	js.configs.recommended,
	...tseslint.configs.recommended,

	prettier,
	...svelte.configs.prettier,
	...convex.configs.recommended,
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node
			}
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.js', '**/*.svelte.ts'],

		languageOptions: {
			parser: svelteParser,
			parserOptions: {
				parser: tseslint.parser
			}
		}
	},
	{
		ignores: ['dist/**', '.svelte-kit/**', 'src/convex/_generated/**']
	}
];
