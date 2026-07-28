const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Required for react-native-skia web (canvaskit.wasm)
config.resolver.assetExts.push('wasm');
if (!config.resolver.assetExts.includes('svg')) {
  config.resolver.assetExts.push('svg');
}

module.exports = config;
