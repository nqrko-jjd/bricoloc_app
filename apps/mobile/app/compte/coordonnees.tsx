import { useStore } from '@/lib/store';
import { Screen, Card, P } from '@/components/ui';

export default function CoordonneesScreen() {
  const { user } = useStore();
  if (!user) return null;

  return (
    <Screen>
      <Card>
        <P muted>E-mail</P>
        <P>{user.email}</P>
      </Card>
      <Card>
        <P muted>Téléphone</P>
        <P>{user.phone}</P>
      </Card>
      {user.customerType === 'PRO' ? (
        <Card>
          <P muted>Société</P>
          <P>{user.companyName}</P>
        </Card>
      ) : null}
    </Screen>
  );
}
