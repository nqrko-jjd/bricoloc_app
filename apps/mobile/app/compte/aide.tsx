import { Screen, Card, P } from '@/components/ui';

export default function AideScreen() {
  return (
    <Screen>
      <Card>
        <P muted>
          Un problème sur une machine ? Ouvrez la réservation concernée puis « Signaler un problème » :
          l’équipe vous répond dans « Mes demandes » (Compte), avec une notification à chaque réponse.
        </P>
      </Card>
    </Screen>
  );
}
