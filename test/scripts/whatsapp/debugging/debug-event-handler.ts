#!/usr/bin/env ts-node
/**
 * Script para debuggear el handler de eventos
 * 
 * Uso:
 *   docker exec especialistas-api-dev npx ts-node test/scripts/whatsapp/debugging/debug-event-handler.ts <interaction-id>
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
import { EVENT_BUS } from '../../../../src/shared/domain/events/event-bus';
import { RequestInteractionRespondedEvent } from '../../../../src/requests/domain/events/request-interaction-responded.event';
import { ResponseIntent } from '@prisma/client';

async function debugEventHandler(interactionId?: string) {
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);
  const eventBus = app.get(EVENT_BUS);

  try {
    console.log('🔍 Debugging Event Handler\n');
    console.log('='.repeat(60));

    // 1. Verificar que el EventBus está disponible
    console.log('\n1️⃣ EventBus Status:');
    console.log(`   Type: ${typeof eventBus}`);
    console.log(`   Has 'publish' method: ${typeof eventBus?.publish === 'function'}`);
    console.log(`   Has 'on' method: ${typeof eventBus?.on === 'function'}`);

    // 2. Verificar listeners registrados
    console.log('\n2️⃣ Event Listeners:');
    if (eventBus && typeof (eventBus as any).emitter !== 'undefined') {
      const emitter = (eventBus as any).emitter;
      const eventNames = emitter.eventNames();
      console.log(`   Registered events: ${eventNames.length}`);
      for (const eventName of eventNames) {
        const count = emitter.listenerCount(eventName as string);
        console.log(`     - ${eventName}: ${count} listener(s)`);
      }
    } else {
      console.log('   ⚠️  Cannot access EventEmitter internals');
    }

    // 3. Si se proporciona interactionId, verificar su estado
    if (interactionId) {
      console.log(`\n3️⃣ Interaction ${interactionId}:`);
      const interaction = await prisma.requestInteraction.findUnique({
        where: { id: interactionId },
        include: {
          request: {
            select: {
              id: true,
              title: true,
              status: true,
            },
          },
        },
      });

      if (interaction) {
        console.log(`   Status: ${interaction.status}`);
        console.log(`   Response Intent: ${interaction.responseIntent || 'N/A'}`);
        console.log(`   Response Content: ${interaction.responseContent || 'N/A'}`);
        console.log(`   Request ID: ${interaction.requestId}`);
        console.log(`   Request Status: ${interaction.request.status}`);
        console.log(`   Request Title: ${interaction.request.title}`);

        // 4. Simular el evento manualmente
        console.log('\n4️⃣ Simulating Event:');
        if (interaction.responseIntent && interaction.responseContent) {
          const event = new RequestInteractionRespondedEvent({
            interactionId: interaction.id,
            requestId: interaction.requestId,
            responseContent: interaction.responseContent,
            responseIntent: interaction.responseIntent as ResponseIntent,
            respondedAt: interaction.respondedAt || new Date(),
          });

          console.log(`   Publishing event: ${event.name}`);
          console.log(`   Payload:`, JSON.stringify(event.payload, null, 2));

          await eventBus.publish(event);
          console.log('   ✅ Event published');

          // Esperar un poco para que el handler procese
          await new Promise((resolve) => setTimeout(resolve, 2000));

          // Verificar si el request cambió
          const updatedRequest = await prisma.request.findUnique({
            where: { id: interaction.requestId },
            select: { status: true },
          });

          console.log(`\n5️⃣ Request Status After Event:`);
          console.log(`   Before: ${interaction.request.status}`);
          console.log(`   After: ${updatedRequest?.status}`);
          if (interaction.request.status !== updatedRequest?.status) {
            console.log('   ✅ Status changed!');
          } else {
            console.log('   ⚠️  Status did not change');
          }
        } else {
          console.log('   ⚠️  Interaction has no response yet');
        }
      } else {
        console.log(`   ❌ Interaction not found`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n💡 Tips:');
    console.log('   - Check logs: docker logs especialistas-api-dev | grep -i "event\|handler"');
    console.log('   - Verify handler is registered on startup');
    console.log('   - Check if event is being published when interaction is marked as responded\n');

  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
    console.error(error.stack);
  } finally {
    await app.close();
  }
}

const interactionId = process.argv[2];
debugEventHandler(interactionId).catch(console.error);


