// Which loops are enabled per release channel
// Tree-shaking removes disabled loops from the bundle
export const CHANNELS = {
  dev: ['burn', 'visualization', 'backend'],
  beta: ['burn', 'visualization'],
  stable: ['burn', 'visualization']
}

const channel = process.env.RELEASE_CHANNEL || 'dev'
export const ENABLED_LOOPS = CHANNELS[channel]
