// ESLint v9+ flat config
import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        // Browser
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        fetch: 'readonly',
        location: 'readonly',
        localStorage: 'readonly',
        performance: 'readonly',
        alert: 'readonly',
        atob: 'readonly',
        ReadableStream: 'readonly',
        DecompressionStream: 'readonly',
        
        // Three.js
        THREE: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
    },
  },
  // Node.js environment for bitpacking.js (dual-mode module)
  {
    files: ['src/bitpacking.js'],
    languageOptions: {
      globals: {
        require: 'readonly',
        module: 'readonly',
        Buffer: 'readonly',
      },
    },
  },
];
