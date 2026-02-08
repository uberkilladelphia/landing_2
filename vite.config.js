import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const repositoryName = env.GITHUB_REPOSITORY?.split('/')[1]
  const pagesBase =
    env.PAGES_BASE || (env.GITHUB_ACTIONS === 'true' && repositoryName ? `/${repositoryName}/` : '/')

  return {
    base: pagesBase,
    plugins: [react()],
  }
})
