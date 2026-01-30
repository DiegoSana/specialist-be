#!/usr/bin/env ts-node
/**
 * Script para listar requests disponibles
 * 
 * Uso:
 *   docker exec especialistas-api-dev npx ts-node test/scripts/whatsapp/utilities/list-requests.ts
 *   docker exec especialistas-api-dev npx ts-node test/scripts/whatsapp/utilities/list-requests.ts --with-provider
 */

// Load environment variables
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const dotenv = require('dotenv');
  const path = require('path');
  const envPath = path.join(__dirname, '../../../.env');
  dotenv.config({ path: envPath });
} catch (e) {
  // dotenv not available, rely on environment variables
}

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../../../src/app.module';
import { PrismaService } from '../../../../src/shared/infrastructure/prisma/prisma.service';

async function listRequests() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);

  try {
    const args = process.argv.slice(2);
    const withProvider = args.includes('--with-provider');

    console.log('📋 Listando Requests...\n');

    const where = withProvider
      ? {
          providerId: { not: null },
        }
      : {};

    const requests = await prisma.request.findMany({
      where,
      select: {
        id: true,
        title: true,
        status: true,
        providerId: true,
        clientId: true,
        updatedAt: true,
        createdAt: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });

    if (requests.length === 0) {
      console.log('❌ No se encontraron requests');
      if (withProvider) {
        console.log('   (filtrando solo requests con provider asignado)');
      }
    } else {
      console.log(`✅ Encontrados ${requests.length} request(s):\n`);
      console.log('ID'.padEnd(40), 'Title'.padEnd(40), 'Status'.padEnd(15), 'Provider'.padEnd(15), 'Updated');
      console.log('-'.repeat(150));

      for (const req of requests) {
        const daysSinceUpdate = Math.floor(
          (Date.now() - req.updatedAt.getTime()) / (1000 * 60 * 60 * 24),
        );
        const providerStatus = req.providerId ? '✅' : '❌';
        console.log(
          req.id.padEnd(40),
          (req.title || '').substring(0, 38).padEnd(40),
          req.status.padEnd(15),
          providerStatus.padEnd(15),
          `${daysSinceUpdate} días`,
        );
      }

      console.log('\n💡 Para usar un request en el test:');
      console.log(`   docker exec especialistas-api-dev npm run whatsapp:test-single ${requests[0].id}`);
    }

    // Verificar el request específico si se proporciona
    const specificId = process.argv.find((arg) =>
      arg.match(/^[a-f0-9-]{36}$/i),
    );
    if (specificId && specificId !== 'list-requests.ts') {
      console.log(`\n🔍 Verificando request específico: ${specificId}`);
      const specificRequest = await prisma.request.findUnique({
        where: { id: specificId },
      });
      if (specificRequest) {
        console.log(`✅ Request encontrado: "${specificRequest.title}"`);
        console.log(`   Status: ${specificRequest.status}`);
        console.log(`   Provider ID: ${specificRequest.providerId || 'No asignado'}`);
      } else {
        console.log(`❌ Request no encontrado`);
        console.log(`\n💡 Posibles causas:`);
        console.log(`   1. El ID está mal formateado`);
        console.log(`   2. El request fue eliminado`);
        console.log(`   3. Estás conectado a una base de datos diferente`);
        console.log(`\n   Verifica el ID correcto en la lista de arriba`);
      }
    }
  } catch (error: any) {
    console.error(`❌ Error: ${error.message}`);
    console.error(error.stack);
  } finally {
    await app.close();
  }
}

listRequests().catch(console.error);


