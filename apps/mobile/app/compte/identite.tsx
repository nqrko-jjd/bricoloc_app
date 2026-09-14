import { useState } from 'react';
import { useStore } from '@/lib/store';
import { Screen, Card, Badge } from '@/components/ui';
import { IdStep } from '@/components/IdStep';

export default function IdentiteScreen() {
  const { user, reloadUser } = useStore();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (!user) return null;

  return (
    <Screen>
      <Card>
        {err ? <Badge text={err} tone="err" /> : null}
        <IdStep user={user} busy={busy} setBusy={setBusy} setErr={setErr} onDone={() => reloadUser()} />
      </Card>
    </Screen>
  );
}
