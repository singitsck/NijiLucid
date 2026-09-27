const path = require('path');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const ExtensionManifestPlugin = require('webpack-extension-manifest-plugin');
const WebExtensionPlugin = require('webpack-target-webextension');

module.exports = (env, argv) => {
  const isDevelopment = argv.mode === 'development';
  const targetBrowser = process.env.TARGET_BROWSER || 'chrome';
  const supportedBrowsers = new Set(['chrome', 'firefox', 'safari']);
  if (!supportedBrowsers.has(targetBrowser)) {
    throw new Error(`Unsupported TARGET_BROWSER: ${targetBrowser}`);
  }

  // Webpack may evaluate this factory more than once in the same process. Clone the
  // base manifest so browser-specific changes never leak into another target.
  const manifest = structuredClone(require('./manifest.json'));

  // 据目标浏览器修改 manifest
  if (targetBrowser === 'firefox') {
    // Firefox 特定的转换
    delete manifest.background.service_worker;
    manifest.background.scripts = ['background.js'];
    manifest.browser_specific_settings = {
      gecko: {
        id: 'anime4k-webextension@chenmozhijin',
        data_collection_permissions: {
          required: ['none']
        }
      },
    };
  } else if (targetBrowser === 'safari') {
    // WebGPU is a hard runtime dependency and ships in Safari 26 and later.
    // Keeping the MV3 service worker matches Safari's recommended nonpersistent
    // background model on both macOS and iOS.
    manifest.browser_specific_settings = {
      safari: {
        strict_min_version: '26.0',
      },
    };
  }


  return {
    entry: {
      popup: './src/ui/popup/popup.ts',
      options: './src/ui/options/options.ts',
      onboarding: './src/ui/onboarding/onboarding.ts',
      content: './src/content.ts',
      background: './src/background.ts'
    },
    output: {
      filename: '[name].js',
      path: path.resolve(__dirname, 'dist-' + targetBrowser),
      clean: true, // 清理输出目录
      // Avoid Webpack's automatic public-path fallback (which emits Function()).
      // Async chunks still resolve to packaged extension URLs via runtime.getURL().
      publicPath: targetBrowser === 'chrome' ? 'auto' : '',
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          loader: 'esbuild-loader',
          options: {
            loader: 'ts',
            target: 'es2022',
          },
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: [
            MiniCssExtractPlugin.loader,
            'css-loader'
          ],
        },
        {
          test: /\.wgsl$/,
          type: 'asset/source',
        },
      ],
    },
    resolve: {
      extensions: ['.ts', '.js', '.wgsl'],
    },
    plugins: [
      new CleanWebpackPlugin(),
      new CopyWebpackPlugin({
        patterns: [
          { from: '*.png', context: 'public/icons', to: 'icons' },
          { from: 'public/_locales', to: '_locales' },
          { from: 'rules.json' },
          { from: 'LICENSE' },
          { from: 'licenses', to: 'licenses' },
          { from: 'THIRD_PARTY_NOTICES.md' },
        ],
      }),
      new HtmlWebpackPlugin({
        filename: 'popup.html',
        template: './src/ui/popup/popup.html',
        chunks: ['popup'],
      }),
      new HtmlWebpackPlugin({
        filename: 'options.html',
        template: './src/ui/options/options.html',
        chunks: ['options'],
      }),
      new HtmlWebpackPlugin({
        filename: 'onboarding.html',
        template: './src/ui/onboarding/onboarding.html',
        chunks: ['onboarding'],
      }),
      new MiniCssExtractPlugin({
        filename: '[name].css',
      }),
      new ExtensionManifestPlugin({
        config: {
          base: manifest,
        },
        pkgJsonProps: [
          'version'
        ]
      }),
      new WebExtensionPlugin({
        background: {
          classicLoader: false,
        },
        weakRuntimeCheck: true,
      }),
    ].filter(Boolean),
    devtool: isDevelopment ? 'inline-source-map' : false,
    watch: isDevelopment,
  };
};
