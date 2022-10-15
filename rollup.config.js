/*
 Copyright 2022 Google LLC
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

     https://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
*/

import babel from '@rollup/plugin-babel';
import replace from '@rollup/plugin-replace';
import terser from '@rollup/plugin-terser';

function configurePlugins(opts = {}) {
  const plugins = [];
  if (opts.isBrowser) {
    plugins.push(
      replace({
        values: {
          'globalThis.PendingPostBeacon': 'self.PendingPostBeacon',
        },
        preventAssignment: true,
      })
    );
    plugins.push(
      babel({
        babelHelpers: 'bundled',
        presets: [
          [
            '@babel/preset-env',
            {
              targets: {
                browsers: ['ie 11'],
              },
            },
          ],
        ],
      }),
    )
  }
  if (opts.minify) {
    plugins.push(
      terser({
        module: true,
        mangle: true,
        compress: true,
      })
    );
  }
  return plugins;
}

export default [
  {
    input: 'dist/modules/PendingPostBeacon.js',
    plugins: configurePlugins({isBrowser: true, minify: true}),
    output: {
      format: 'esm',
      file: './dist/PendingPostBeacon.js',
    },
  },
  {
    input: 'dist/modules/PendingPostBeacon.js',
    plugins: configurePlugins({isBrowser: false, minify: true}),
    output: {
      format: 'cjs',
      file: './dist/PendingPostBeacon.cjs',
    },
  },
];
