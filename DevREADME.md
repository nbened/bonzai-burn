# Dev Guide

## Test locally
- We need this because node runs js, but your files are in ts

```bash
npm run build
node dist/btrim.js
node dist/brevert.js
```

Or link globally:

```bash
npm link
btrim
brevert
```

## Publish new version

```bash
npm login
npm version patch  # pumps version number uatomtically
npm publish
```
