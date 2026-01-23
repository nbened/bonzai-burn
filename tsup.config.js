import { defineConfig } from 'tsup'

const channel = process.env.RELEASE_CHANNEL || 'stable'

export default defineConfig({
  entry: ['src/index.js'],
  format: ['esm'],
  treeshake: true,
  splitting: false,
  clean: true,
  outDir: 'dist',
  define: {
    'process.env.RELEASE_CHANNEL': JSON.stringify(channel)
  },
  // Copy necessary files based on channel
  onSuccess: async () => {
    const fs = await import('fs')
    const path = await import('path')

    // Always copy burn loop files
    const burnFiles = ['src/bburn.js', 'src/bhook.js', 'src/analyzer.js']
    for (const file of burnFiles) {
      if (fs.existsSync(file)) {
        fs.copyFileSync(file, path.join('dist', path.basename(file)))
      }
    }

    // Copy payload-bonzai (config template)
    fs.cpSync('payload-bonzai', 'dist/payload-bonzai', { recursive: true })

    // Only copy visualization/backend files for dev/beta
    if (channel !== 'stable') {
      fs.copyFileSync('src/bconfig.js', 'dist/bconfig.js')
      fs.cpSync('graph-templates', 'dist/graph-templates', { recursive: true })
    }
  }
})
