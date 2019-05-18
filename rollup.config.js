import typescript from 'rollup-plugin-typescript';
import { uglify } from "rollup-plugin-uglify";


export default [{
  input: './src/index.ts',
  output: {
    sourcemap: true,
      file: 'dist/intl-messageformat.js',
      format: 'umd',
      name: 'IntlMessageFormat'
  },
  plugins: [
    typescript(),
  ]
},
{
    input: './src/locales.ts',
    output: {
      sourcemap: true,
        file: 'dist/intl-messageformat-with-locales.js',
        format: 'umd',
        name: 'IntlMessageFormat'
    },
    plugins: [
      typescript(),
    ]
  },
  {
    input: './src/index.ts',
    output: {
      sourcemap: true,
        file: 'dist/intl-messageformat.min.js',
        format: 'umd',
        name: 'IntlMessageFormat'
    },
    plugins: [
      typescript(),
      uglify()
    ]
  },
  {
    input: './src/locales.ts',
    output: {
      sourcemap: true,
        file: 'dist/intl-messageformat-with-locales.min.js',
        format: 'umd',
        name: 'IntlMessageFormat'
    },
    plugins: [
      typescript(),
      uglify()
    ]
  }]