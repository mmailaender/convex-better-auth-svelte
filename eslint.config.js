import prettier from 'eslint-config-prettier';
import svelte from 'eslint-plugin-svelte';

export default [
	prettier,
	...svelte.configs.prettier,
	{
		files: ['**/*.svelte', '**/*.svelte.js', '**/*.svelte.ts'],

		languageOptions: {
			parserOptions: {
				parser: ts.parser
			}
		}
	}
];
