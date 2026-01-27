# Dev Guide

### Running (commonality)
npm cache clean --force
rm -rf bonzai    

# Dev
### Pushing
npm version patch
npm publish --tag dev 
### Running
npx bonzai-burn@dev

# Staging
### Pushing
npm version patch
npm publish --tag staging 
### Running
npx bonzai-burn@staging

# Prod 
npm version patch
npm publish 
### Running
npx bonzai-burn@latest
