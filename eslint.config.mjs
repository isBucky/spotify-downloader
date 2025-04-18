import Prettier from 'eslint-plugin-prettier/recommended';
import EsPromise from 'eslint-plugin-promise';
import TsEslint from 'typescript-eslint';
import pluginJs from '@eslint/js';
import globals from 'globals';

export default TsEslint.config(
    ...TsEslint.configs.recommended,
    pluginJs.configs.recommended,
    Prettier,

    {
        files: ['**/*.ts', '*.ts'],

        plugins: {
            promise: EsPromise.configs.recommended,
        },

        languageOptions: {
            globals: globals.browser,
            parserOptions: {
                project: true,
            },
        },

        rules: {
            'prettier/prettier': 'warn',
            'no-async-promise-executor': 'off',

            '@typescript-eslint/interface-name-prefix': 'off',
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-async-promise-executor': 'off',
            '@typescript-eslint/no-unsafe-declaration-merging': 'off',
            '@typescript-eslint/no-unused-vars': 'off',
            'no-unused-vars': 'off',

            'no-undef': 'off',
        },
    },
);
