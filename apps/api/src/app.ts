import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { env } from './env.js';
import { errorHandler, notFound } from './lib/http.js';
import { relativizeMedia } from './lib/media-url.js';
import { uploadsRouter } from './routes/uploads.js';
import { reviewsRouter } from './routes/reviews.js';
import { authRouter } from './routes/auth.js';
import { catalogRouter } from './routes/catalog.js';
import { availabilityRouter } from './routes/availability.js';
import { cartRouter } from './routes/cart.js';
import { checkoutRouter } from './routes/checkout.js';
import { reservationsRouter } from './routes/reservations.js';
import { accountRouter } from './routes/account.js';
import { publicRouter } from './routes/public.js';
import { geoRouter } from './routes/geo.js';
import { adminRouter } from './routes/admin.js';
import { opsRouter } from './routes/ops.js';

export function createApp() {
  const app = express();
  app.use(
    cors({
      origin: env.corsOrigins.includes('*') ? true : env.corsOrigins,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '8mb' }));
  // Webhooks (Mollie) : corps application/x-www-form-urlencoded.
  app.use(express.urlencoded({ extended: false }));
  app.use(morgan('dev'));

  // Réécrit les URLs média absolues (http://host/uploads/…) en chemins relatifs
  // portables, pour que les images chargent depuis un téléphone / iPad / la borne.
  app.use((_req, res, next) => {
    const send = res.json.bind(res);
    res.json = (body: unknown) => send(relativizeMedia(body));
    next();
  });

  // Médias téléversés (images produits / contenus) servis en statique.
  app.use(
    '/uploads',
    express.static(env.uploadsDir, {
      maxAge: '30d',
      immutable: true,
      fallthrough: false,
      index: false,
      dotfiles: 'ignore',
    }),
  );

  app.get('/health', (_req, res) => res.json({ ok: true, service: 'bricoloc-api', ts: Date.now() }));

  app.use('/api/auth', authRouter);
  app.use('/api/catalog', catalogRouter);
  app.use('/api', reviewsRouter);
  app.use('/api/availability', availabilityRouter);
  app.use('/api/cart', cartRouter);
  app.use('/api/checkout', checkoutRouter);
  app.use('/api/reservations', reservationsRouter);
  app.use('/api/account', accountRouter);
  app.use('/api/public', publicRouter);
  app.use('/api/geo', geoRouter);
  app.use('/api/admin/uploads', uploadsRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/ops', opsRouter);

  app.use((_req, _res, next) => next(notFound('Route inconnue')));
  app.use(errorHandler);
  return app;
}
