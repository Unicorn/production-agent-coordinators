/** @type {import('next').NextConfig} */
const { withTamagui } = require('@tamagui/next-plugin');
const webpack = require('webpack');

const nextConfig = {
  transpilePackages: [
    'react-native',
    'react-native-web',
    'expo-linking',
    'expo-constants',
    'expo-modules-core',
    'tamagui',
    '@tamagui/core',
    '@tamagui/config',
    '@tamagui/dialog',
    '@tamagui/portal',
    '@tamagui/progress',
    '@tamagui/sheet',
  ],
  webpack: (config, { isServer }) => {
    // Alias React Native to React Native Web
    config.resolve.alias = {
      ...config.resolve.alias,
      'react-native': 'react-native-web',
    };
    
    // Add extensions for resolving modules
    config.resolve.extensions = [
      '.web.js',
      '.web.jsx',
      '.web.ts',
      '.web.tsx',
      ...config.resolve.extensions,
    ];
    
    // Exclude .d.ts files and certain problematic packages from being processed
    config.module.rules.push({
      test: /\.d\.ts$/,
      loader: 'ignore-loader',
    });
    
    // Completely ignore esbuild and webpack modules
    config.module.rules.push({
      test: /node_modules\/(esbuild|webpack)\//,
      use: 'null-loader',
    });
    
    // Exclude Temporal and esbuild packages from webpack bundling
    // These are Node.js-only packages that should not be bundled
    if (isServer) {
      const externals = [
        '@temporalio/worker',
        '@temporalio/client',
        '@temporalio/common',
        '@temporalio/proto',
        'esbuild',
        'webpack',
      ];
      
      // Add to externals
      if (typeof config.externals === 'function') {
        const originalExternals = config.externals;
        config.externals = async (context, request, callback) => {
          if (externals.some(ext => request.startsWith(ext))) {
            return callback(null, `commonjs ${request}`);
          }
          return originalExternals(context, request, callback);
        };
      } else {
        config.externals = {
          ...(config.externals || {}),
          ...externals.reduce((acc, ext) => ({ ...acc, [ext]: `commonjs ${ext}` }), {}),
        };
      }
    }
    
    // Add fallbacks for Node.js modules not available in browser
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    
    // Suppress Tamagui warnings
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      { message: /Unexpected text node/i },
    ];
    
    // Completely ignore Temporal worker module and its dependencies
    config.plugins = config.plugins || [];
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /@temporalio\/worker/,
      })
    );
    
    return config;
  },
};

const config = withTamagui(nextConfig, {
  config: './src/lib/tamagui/config.ts',
  components: ['tamagui'],
  disableExtraction: process.env.NODE_ENV === 'development',
});

// Wrap webpack config to ensure our aliases are applied AFTER Tamagui
const originalWebpack = config.webpack;
config.webpack = (webpackConfig, options) => {
  // First, apply Tamagui's webpack config
  if (originalWebpack) {
    webpackConfig = originalWebpack(webpackConfig, options);
  }
  
  // Then apply our custom config
  webpackConfig = nextConfig.webpack(webpackConfig, options);
  
  return webpackConfig;
};

module.exports = config;
