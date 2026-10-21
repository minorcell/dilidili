import globals from 'globals';
import tseslint from 'typescript-eslint';
import pluginReactConfig from 'eslint-plugin-react/configs/recommended.js';
import hooksPlugin from 'eslint-plugin-react-hooks';
import refreshPlugin from 'eslint-plugin-react-refresh';
import eslintConfigPrettier from 'eslint-config-prettier';
import js from '@eslint/js';

export default [
    {
        ignores: ['dist', 'src-tauri', 'node_modules', 'eslint.config.js', 'pnpm-lock.yaml', 'vite.config.ts', '.prettierrc.cjs', '.prettierignore', 'LICENSE', 'README.md'],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        ...pluginReactConfig,
        files: ['src/**/*.{ts,tsx}'],
        languageOptions: {
            ...pluginReactConfig.languageOptions,
            globals: {
                ...globals.browser,
                ...globals.es2020,
            },
        },
        settings: {
            react: {
                version: 'detect',
            },
        },
    },
    {
        files: ['src/**/*.{ts,tsx}'],
        plugins: {
            'react-hooks': hooksPlugin,
            'react-refresh': refreshPlugin,
        },
        rules: {
            ...hooksPlugin.configs.recommended.rules,
            'react-refresh/only-export-components': 'warn',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/ban-ts-comment': 'off',
            'react/react-in-jsx-scope': 'off',
            // 组件属性已由 TypeScript 校验，无需运行时 prop-types
            'react/prop-types': 'off',
        },
    },
    eslintConfigPrettier,
]; 