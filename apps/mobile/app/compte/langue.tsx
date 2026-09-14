import { useState } from 'react';
import { View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { currentLocale, setLocaleOverride, LOCALES } from '@/lib/i18n';
import { Screen, Card, Button } from '@/components/ui';

export default function LangueScreen() {
  const [lang, setLang] = useState(currentLocale());

  return (
    <Screen>
      <Card>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {LOCALES.map((l) => (
            <Button
              key={l}
              title={l.toUpperCase()}
              variant={l === lang ? 'primary' : 'ghost'}
              onPress={async () => {
                setLocaleOverride(l);
                setLang(l);
                await AsyncStorage.setItem('bricoloc_locale', l);
              }}
            />
          ))}
        </View>
      </Card>
    </Screen>
  );
}
