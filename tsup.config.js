import { defineConfig } from 'tsup'
import { CHANNELS } from './src/loops.config.js'

const channel = process.env.RELEASE_CHANNEL || 'prod'
const enabledLoops = CHANNELS[channel] || ['visualization', 'backend']

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
  // Copy necessary files based on enabled loops
  onSuccess: async () => {
    const fs = await import('fs')
    const path = await import('path')

    // Copy payload-bonzai (config template)
    fs.cpSync('payload-bonzai', 'dist/payload-bonzai', { recursive: true })

    // Check if any graph-template loops are enabled
    const hasVisualization = enabledLoops.includes('visualization')
    const hasBackend = enabledLoops.includes('backend')

    if (hasVisualization || hasBackend) {
      fs.copyFileSync('src/bconfig.js', 'dist/bconfig.js')

      // Copy graph-templates base files
      fs.mkdirSync('dist/graph-templates', { recursive: true })
      fs.copyFileSync('graph-templates/receiver.js', 'dist/graph-templates/receiver.js')
      fs.copyFileSync('graph-templates/config.js', 'dist/graph-templates/config.js')
      fs.copyFileSync('graph-templates/ignore.txt', 'dist/graph-templates/ignore.txt')
      fs.cpSync('graph-templates/utils', 'dist/graph-templates/utils', { recursive: true })

      fs.mkdirSync('dist/graph-templates/loops', { recursive: true })

      if (hasVisualization) {
        fs.cpSync('graph-templates/loops/visualization', 'dist/graph-templates/loops/visualization', { recursive: true })
      }

      if (hasBackend) {
        fs.cpSync('graph-templates/loops/backend', 'dist/graph-templates/loops/backend', { recursive: true })
      }
    }
  }
})
