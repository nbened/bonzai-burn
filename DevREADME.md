# Dev Guide

Users install with:     
npm cache clean --force
rm -rf bonzai                                     

npx bonzai-burn@latest   # stable (default)                                                                                                               
npx bonzai-burn@beta     # beta channel                                                                                                                   
npx bonzai-burn@dev      # dev channel                                                                                                                    
                                                                                                                                                        
Typical workflow:                                                                                                                                         
1. Develop features on dev: npm run release:dev                                                                                                           
2. Promote to beta for testing: npm run release:beta                                                                                                      
3. Promote to stable: npm run release    


npx bonzai-burn@latest -b


## Test locally
                       
npx bonzai-burn@latest



## Test in another repo

rm -rf bonzai/                                             
npx bonzai-burn@latest


th


```bash
node src/bburn.js
node src/baccept.js
node src/brevert.js
```

Or link globally:

```bash
npm link
bburn
baccept
brevert
```

## Publish new version

```bash
npm login
npm version patch  # pumps version number automatically
npm publish
```
