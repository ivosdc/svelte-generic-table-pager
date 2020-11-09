import svelte from 'rollup-plugin-svelte';
import resolve from 'rollup-plugin-node-resolve';

const pkg = require('./package.json');

export default {
    input: [
        'src/GenericTablePager.svelte'
    ],
    output: [
        {file: pkg.module, format: 'es', name: 'GenericTablePager'},
        {file: pkg.main, format: 'umd', name: 'GenericTablePager'},
    ],
    plugins: [
        svelte({
            customElement: true,
            tag: 'table-pager'
        }),
        resolve({
                extensions: ['.svelte', '.mjs', '.js', '.jsx', '.json'],
                mainFields: ['jsnext:main', 'module', 'main']
            }
        )
    ]
};
