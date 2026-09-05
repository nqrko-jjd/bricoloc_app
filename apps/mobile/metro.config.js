// apps/mobile est HORS des npm workspaces du monorepo (voir .npmrc) pour garder
// des versions react/react-dom compatibles Expo, indépendantes de celles utilisées
// par apps/web (Next.js). Sans cette isolation, Metro remonte par défaut dans
// node_modules du monorepo racine et y trouve une AUTRE version de react
// (celle de Next.js) → doublon de dépendance native, l'appli ne démarre plus.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
