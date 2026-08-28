import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import mkcert from 'vite-plugin-mkcert'

// https://vite.dev/config/
export default defineConfig({
  // The admin SPA is served under a sub-path in production so its assets do
  // not collide with storefront assets on the same origin. The dev server
  // keeps the default root base.
  base: process.env.VITE_BASE_URL ?? '/',
  server: { port: 3001 },
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }), mkcert()
  ],
})
