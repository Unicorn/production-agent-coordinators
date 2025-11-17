/** @type {import('next').NextConfig} */
const { withTamagui } = require('@tamagui/next-plugin');

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
