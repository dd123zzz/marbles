import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

const background = '#ffe9d6';

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    transparent: {
      sizes: [192, 512],
      favicons: [[48, 'favicon.ico']],
    },
    maskable: {
      sizes: [512],
      padding: 0.3,
      resizeOptions: { background, fit: 'contain' },
    },
    apple: {
      ...minimal2023Preset.apple,
      padding: 0,
      resizeOptions: { background, fit: 'contain' },
    },
    assetName: (type, size) => {
      if (type === 'maskable') return `maskable-${size.width}x${size.height}.png`;
      if (type === 'apple') return `apple-touch-icon-${size.width}x${size.height}.png`;
      return `pwa-${size.width}x${size.height}.png`;
    },
  },
  images: ['public/icon.svg'],
});
