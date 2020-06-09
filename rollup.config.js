import svelte from 'rollup-plugin-svelte';
import resolve from 'rollup-plugin-node-resolve';

const pkg = require('./package.json');

export default {
    input: [
        'src/index.js'
    ],
    output: [
        {file: pkg.module, format: 'iife', name: 'GenericTablePager'},
        {file: pkg.main, format: 'iife', name: 'GenericTablePager'},
    ],
    plugins: [
        svelte({
            customElement: true,
            tag: null,
            css: css => {
                css.write('dist/build/table-pager.css');
            }
        }),
        resolve({
                extensions: ['.svelte', '.mjs', '.js', '.jsx', '.json'],
                mainFields: ['jsnext:main', 'module', 'main']
            }
        )
    ]
};
