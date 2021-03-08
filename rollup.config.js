import svelte from 'rollup-plugin-svelte';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import livereload from 'rollup-plugin-livereload';
import { terser } from 'rollup-plugin-terser';
import postcss from 'rollup-plugin-postcss';
import purgecss from '@fullhuman/postcss-purgecss';
import nodePolyfills from 'rollup-plugin-node-polyfills';
import html from '@rollup/plugin-html';

const production = !process.env.ROLLUP_WATCH;
const version = String(require('child_process').execSync('git rev-parse --short HEAD')).trim(); // append short git commit to bundles

export default [
  {
    input: 'src/main.js',
    output: {
      sourcemap: !production,
      format: 'iife',
      name: 'app',
      file: 'public/bundle-v' + version + '.js',
    },
    plugins: [
      svelte({
        compilerOptions: {
          dev: !production,
        },
        onwarn: (warning, handler) => {
          // e.g. don't warn on a11y-autofocus
          if (warning.code === 'a11y-missing-attribute') return;

          // let Rollup handle all other warnings normally
          handler(warning);
        },
      }),

      postcss({ extract: true, minimize: production }),

      resolve({
        browser: true,
        dedupe: ['svelte'],
        preferBuiltins: true,
      }),
      commonjs(),
      nodePolyfills(),

      html({
        template: async ({ attributes, files, meta, publicPath, title }) => {
          const script = (files.js || [])
            .map(({ fileName }) => {
              return `<script defer src='${fileName}'></script>`;
            })
            .join('\n');

          const css = (files.css || [])
            .map(({ fileName }) => {
              return `<link rel='stylesheet' href='${fileName}'>`;
            })
            .join('\n');
          return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset='utf-8'>
	<meta name='viewport' content='width=device-width,initial-scale=1'>
	<meta http-equiv='origin-trial' content='ArcEc1taNHMu4hv4uJ0EqaaarH4y4amJM0PAuYQbWz8jQ7PKsDlfqI60XiQEtUGC6rPyIX0a/w9bErcnW28RDgsAAABReyJvcmlnaW4iOiJodHRwczovL29icy13ZWIubmllay50djo0NDMiLCJmZWF0dXJlIjoiV2FrZUxvY2siLCJleHBpcnkiOjE1OTQxNjYzOTl9'>
	<meta name='apple-mobile-web-app-capable' content='yes'>

	<title>OBS-web</title>

	<link rel='icon' type='image/png' href='favicon.png'>
	${css}
  <link rel='manifest' href='manifest.json'>
  <script>production = ${production}</script>
	${script}
</head>

<body>
</body>
</html>`;
        },
      }),
      !production && serve(),
      !production && livereload('public'),
      production && terser(),
    ],
    watch: {
      clearScreen: false,
    },
  },
  {
    input: 'src/overlay.js',
    output: {
      sourcemap: !production,
      format: 'iife',
      name: 'overlay',
      file: 'public/overlay-v' + version + '.js',
    },
    plugins: [
      resolve({
        browser: true,
        dedupe: ['svelte'],
        preferBuiltins: true,
      }),
      postcss({ extract: true, plugins: production ? [purgecss({ content: ['./src/overlay.css', './rollup.config.js'] })] : [], minimize: production }),
      commonjs(),
      nodePolyfills(),
      html({ attributes: { html: { lang: 'it' } }, fileName: 'overlay.html', title: 'Overlay' }),
      //!production && serve(),
      !production && livereload('public'),
      production && terser(),
    ],
  },
];

function serve() {
  let started = false;

  return {
    writeBundle() {
      if (!started) {
        started = true;

        require('child_process').spawn('npm', ['run', 'start', '--', '--dev'], {
          stdio: ['ignore', 'inherit', 'inherit'],
          shell: true,
        });
      }
    },
  };
}
