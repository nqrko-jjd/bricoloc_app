import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { PanResponder, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { C } from '@/lib/theme';

export interface SignaturePadHandle {
  clear: () => void;
  /** Signature en SVG encodée data-URI (`data:image/svg+xml;base64,…`), ou null si vide. */
  getData: () => string | null;
  isEmpty: () => boolean;
}

/**
 * Pad de signature 100 % natif (PanResponder + react-native-svg).
 * Aucune WebView : rapide et lisible sur le terminal Zebra.
 */
export const SignaturePad = forwardRef<SignaturePadHandle, { height?: number }>(
  function SignaturePad({ height = 220 }, ref) {
    const [strokes, setStrokes] = useState<string[]>([]);
    const [cur, setCur] = useState('');
    const curRef = useRef('');
    const size = useRef({ w: 1, h: height });

    const setCurrent = (d: string) => {
      curRef.current = d;
      setCur(d);
    };

    const pan = useRef(
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          const { locationX: x, locationY: y } = e.nativeEvent;
          setCurrent(`M ${x.toFixed(1)} ${y.toFixed(1)}`);
        },
        onPanResponderMove: (e) => {
          const { locationX: x, locationY: y } = e.nativeEvent;
          setCurrent(`${curRef.current} L ${x.toFixed(1)} ${y.toFixed(1)}`);
        },
        onPanResponderRelease: () => {
          const d = curRef.current;
          setCurrent('');
          if (d.includes('L')) setStrokes((s) => [...s, d]);
        },
      }),
    ).current;

    useImperativeHandle(ref, () => ({
      clear: () => {
        setCurrent('');
        setStrokes([]);
      },
      isEmpty: () => strokes.length === 0,
      getData: () => {
        if (strokes.length === 0) return null;
        const w = Math.round(size.current.w);
        const h = Math.round(size.current.h);
        const svg =
          `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
          strokes
            .map(
              (d) =>
                `<path d="${d}" fill="none" stroke="#14123F" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`,
            )
            .join('') +
          `</svg>`;
        return `data:image/svg+xml;base64,${base64(svg)}`;
      },
    }));

    return (
      <View
        style={{ flex: 1, minHeight: height, backgroundColor: C.white }}
        onLayout={(e) => {
          const { width, height: h } = e.nativeEvent.layout;
          size.current = { w: width || 1, h: h || height };
        }}
        {...pan.panHandlers}
      >
        <Svg width="100%" height="100%">
          {strokes.map((d, i) => (
            <Path
              key={i}
              d={d}
              stroke={C.ink}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ))}
          {cur ? (
            <Path
              d={cur}
              stroke={C.ink}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ) : null}
        </Svg>
      </View>
    );
  },
);

/**
 * Encodage base64 sans dépendance. Le SVG produit ici est 100 % ASCII
 * (chiffres, lettres, espaces, `< > / " = # . -`), donc pas besoin
 * d'encoder l'UTF-8 au préalable.
 */
function base64(input: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes = input;
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes.charCodeAt(i) & 0xff;
    const b = i + 1 < bytes.length ? bytes.charCodeAt(i + 1) & 0xff : 0;
    const c = i + 2 < bytes.length ? bytes.charCodeAt(i + 2) & 0xff : 0;
    out += chars[a >> 2];
    out += chars[((a & 3) << 4) | (b >> 4)];
    out += i + 1 < bytes.length ? chars[((b & 15) << 2) | (c >> 6)] : '=';
    out += i + 2 < bytes.length ? chars[c & 63] : '=';
  }
  return out;
}
