#!/usr/bin/env ts-node
/**
 * Script para reenviar mensajes de WhatsApp
 * 
 * Opciones:
 *   - Resetear interactions específicas por ID
 *   - Resetear todas las interactions fallidas
 *   - Resetear todas las interactions enviadas de un request
 *   - Resetear todas las interactions pendientes (forzar reenvío inmediato)
 * 
 * Uso:
 *   npx ts-node test/scripts/whatsapp/utilities/resend-messages.ts [command]
 *   docker exec especialistas-api-dev npm run whatsapp:resend [command]
 */

// Load environment variables from .env file
// Try to load dotenv if available, otherwise rely on environment variables
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const dotenv = require('dotenv');
  const path = require('path');
  const envPath = path.join(__dirname, '../../../.env');
  dotenv.config({ path: envPath });
} catch (e) {
  // dotenv not available, rely on environment variables (e.g., when running in Docker)
}

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../../../src/app.module';
import { PrismaService } from '../../../../src/shared/infrastructure/prisma/prisma.service';
import { WhatsAppDispatchJob } from '../../../../src/requests/application/jobs/whatsapp-dispatch.job';

async function resetInteractions(prisma: PrismaService, options: {
  interactionIds?: string[];
  requestId?: string;
  resetFailed?: boolean;
  resetSent?: boolean;
  resetAll?: boolean;
}) {
  const where: any = {};

  if (options.interactionIds && options.interactionIds.length > 0) {
    where.id = { in: options.interactionIds };
  } else if (options.requestId) {
    where.requestId = options.requestId;
  } else if (options.resetFailed) {
    where.status = 'FAILED';
  } else if (options.resetSent) {
    where.status = 'SENT';
  } else if (options.resetAll) {
    where.status = { in: ['FAILED', 'SENT'] };
  } else {
    // Por defecto, resetear todas las pendientes para forzar reenvío inmediato
    where.status = 'PENDING';
  }

  const interactions = await prisma.requestInteraction.findMany({
    where,
    select: {
      id: true,
      requestId: true,
      status: true,
      twilioMessageSid: true,
      scheduledFor: true,
    },
  });

  if (interactions.length === 0) {
    console.log('   No se encontraron interactions para resetear.');
    return 0;
  }

  console.log(`   Encontradas ${interactions.length} interactions:`);
  interactions.forEach((i) => {
    console.log(`     - ${i.id.substring(0, 8)}... | ${i.status} | Request: ${i.requestId.substring(0, 8)}...`);
  });

  // Resetear a PENDING y actualizar scheduledFor a ahora
  const now = new Date();
  const updated = await prisma.requestInteraction.updateMany({
    where: { id: { in: interactions.map((i) => i.id) } },
    data: {
      status: 'PENDING',
      scheduledFor: now,
      sentAt: null,
      twilioMessageSid: null,
      twilioStatus: null,
      metadata: {
        resetAt: now.toISOString(),
        previousStatus: interactions[0]?.status,
      },
    },
  });

  console.log(`   ✅ ${updated.count} interactions reseteadas a PENDING`);
  return updated.count;
}

async function main() {
  const command = process.argv[2];
  const args = process.argv.slice(3);

  console.log('📤 WhatsApp Message Resend Tool\n');

  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);
  const dispatchJob = app.get(WhatsAppDispatchJob);

  try {
    let resetCount = 0;

    switch (command) {
      case 'reset':
        // Resetear por IDs específicos
        if (args.length === 0) {
          console.log('❌ Debes proporcionar al menos un ID de interaction');
          console.log('   Uso: npx ts-node test/scripts/whatsapp/utilities/resend-messages.ts reset <id1> [id2] ...');
          process.exit(1);
        }
        console.log('🔄 Reseteando interactions específicas...\n');
        resetCount = await resetInteractions(prisma, {
          interactionIds: args,
        });
        break;

      case 'request':
        // Resetear por Request ID
        if (args.length === 0) {
          console.log('❌ Debes proporcionar un Request ID');
          console.log('   Uso: npx ts-node test/scripts/whatsapp/utilities/resend-messages.ts request <requestId>');
          process.exit(1);
        }
        console.log(`🔄 Reseteando interactions del request ${args[0]}...\n`);
        resetCount = await resetInteractions(prisma, {
          requestId: args[0],
        });
        break;

      case 'failed':
        // Resetear todas las fallidas
        console.log('🔄 Reseteando todas las interactions fallidas...\n');
        resetCount = await resetInteractions(prisma, {
          resetFailed: true,
        });
        break;

      case 'sent':
        // Resetear todas las enviadas
        console.log('🔄 Reseteando todas las interactions enviadas...\n');
        resetCount = await resetInteractions(prisma, {
          resetSent: true,
        });
        break;

      case 'all':
        // Resetear todas (fallidas y enviadas)
        console.log('🔄 Reseteando todas las interactions (fallidas y enviadas)...\n');
        resetCount = await resetInteractions(prisma, {
          resetAll: true,
        });
        break;

      case 'pending':
        // Solo ejecutar dispatch sin resetear (forzar reenvío de pendientes)
        console.log('📤 Ejecutando dispatch job para enviar pendientes...\n');
        await dispatchJob.dispatchPendingMessages();
        console.log('✅ Dispatch job ejecutado\n');
        await app.close();
        return;

      case 'list':
        // Listar interactions
        const status = args[0] || 'PENDING';
        console.log(`📋 Listando interactions con status: ${status}\n`);
        const interactions = await prisma.requestInteraction.findMany({
          where: { status: status as any },
          take: 20,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            requestId: true,
            status: true,
            interactionType: true,
            scheduledFor: true,
            sentAt: true,
            twilioMessageSid: true,
          },
        });

        if (interactions.length === 0) {
          console.log('   No se encontraron interactions.');
        } else {
          interactions.forEach((i) => {
            console.log(`   - ${i.id.substring(0, 8)}... | ${i.status} | ${i.interactionType} | Scheduled: ${i.scheduledFor.toISOString()}`);
          });
        }
        await app.close();
        return;

      default:
        console.log(`
Uso: npx ts-node test/scripts/whatsapp/utilities/resend-messages.ts <command> [args...]

Comandos:
  reset <id1> [id2] ...  - Resetear interactions específicas por ID
  request <requestId>     - Resetear todas las interactions de un request
  failed                  - Resetear todas las interactions fallidas
  sent                    - Resetear todas las interactions enviadas
  all                     - Resetear todas (fallidas y enviadas)
  pending                 - Ejecutar dispatch sin resetear (solo enviar pendientes)
  list [status]           - Listar interactions (default: PENDING)

Ejemplos:
  # Resetear interaction específica
  npx ts-node test/scripts/whatsapp/utilities/resend-messages.ts reset abc-123-def-456

  # Resetear todas las fallidas y enviarlas
  npx ts-node test/scripts/whatsapp/utilities/resend-messages.ts failed && npx ts-node test/scripts/whatsapp/utilities/resend-messages.ts pending

  # Listar todas las pendientes
  npx ts-node test/scripts/whatsapp/utilities/resend-messages.ts list PENDING

  # Resetear y enviar todas las fallidas
  npx ts-node test/scripts/whatsapp/utilities/resend-messages.ts failed
  npx ts-node test/scripts/whatsapp/utilities/resend-messages.ts pending
        `);
        await app.close();
        process.exit(1);
    }

    if (resetCount > 0) {
      console.log('\n📤 Ejecutando dispatch job para enviar mensajes...\n');
      await dispatchJob.dispatchPendingMessages();
      console.log('\n✅ Proceso completado!');
    } else {
      console.log('\n⚠️  No se resetearon interactions. No hay nada que enviar.');
    }
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await app.close();
  }
}

main().catch(console.error);

