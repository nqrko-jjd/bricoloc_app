import Constants from 'expo-constants';

/**
 * « Mode équipe » forcé : l'appli démarre directement sur l'espace équipe
 * (terminal dépôt) et masque le parcours client.
 *
 * À activer pour le build installé sur le terminal Zebra :
 *  - soit via la variable d'env  EXPO_PUBLIC_TEAM_MODE=1  au build,
 *  - soit en passant  expo.extra.teamMode = true  dans app.json.
 *
 * Sur l'appli grand public : laisser désactivé. Un membre de l'équipe qui
 * se connecte une fois reste malgré tout sur l'espace équipe au redémarrage
 * (voir BootRedirect), jusqu'à « Quitter ».
 */
export const TEAM_MODE =
  process.env.EXPO_PUBLIC_TEAM_MODE === '1' ||
  (Constants.expoConfig?.extra as { teamMode?: boolean } | undefined)?.teamMode === true;
