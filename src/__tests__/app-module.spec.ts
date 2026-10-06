/**
 * Application wiring smoke test
 *
 * Compiles the full AppModule (no HTTP server, no DB connection) so that
 * DI resolution errors and circular-import problems are caught by `npm test`
 * instead of only when the backend is booted for real.
 *
 * Unit specs mock module wiring, so they cannot detect a missing forwardRef
 * or an unresolved provider on their own.
 */

import { Test } from '@nestjs/testing';
import { AppModule } from '../app.module';

describe('AppModule', () => {
  it('should compile the full module graph', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    await moduleRef.close();
  });
});
