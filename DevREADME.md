# Dev Guide

## Test locally

```bash
node src/btrim.js
node src/brevert.js
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
