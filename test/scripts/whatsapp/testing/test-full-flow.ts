#!/usr/bin/env ts-node
/**
 * Script para testing completo del flujo de WhatsApp:
 * 1. Envío de mensajes
 * 2. Recepción de webhooks
 * 3. Verificación de estado
 * 
 * Uso:
 *   npx ts-node test/scripts/whatsapp/testing/test-full-flow.ts
 * 
 * O dentro del contenedor:
 *   docker exec especialistas-api-dev npm run whatsapp:test
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
import { RequestInteractionService } from '../../../../src/requests/application/services/request-interaction.service';
import { TwilioClientService } from '../../../../src/shared/infrastructure/messaging/twilio-client.service';

async function testFullFlow() {
  console.log('🧪 Testing Complete WhatsApp Flow\n');
  console.log('='.repeat(60));
  
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);
  const dispatchJob = app.get(WhatsAppDispatchJob);
  const interactionService = app.get(RequestInteractionService);
  const twilioService = app.get(TwilioClientService);

  try {
    // 1. Verificar configuración
    console.log('\n1️⃣ Verificando configuración...\n');
    
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_WHATSAPP_FROM;
    const callbackUrl = process.env.TWILIO_STATUS_CALLBACK_URL;
    
    console.log(`   Twilio Account SID: ${accountSid ? '✅ Configurado' : '❌ No configurado'}`);
    console.log(`   Twilio Auth Token: ${authToken ? '✅ Configurado' : '❌ No configurado'}`);
    console.log(`   WhatsApp From: ${fromNumber || '❌ No configurado'}`);
    console.log(`   Status Callback URL: ${callbackUrl || '⚠️  No configurado (usará configuración global de Twilio)'}`);
    console.log(`   Twilio Client: ${twilioService.isInitialized() ? '✅ Inicializado' : '❌ No inicializado'}`);
    
    if (!twilioService.isInitialized()) {
      console.log('\n❌ Twilio no está configurado. Configura las variables de entorno primero.');
      await app.close();
      return;
    }

    // 2. Verificar interactions pendientes
    console.log('\n2️⃣ Verificando interactions pendientes...\n');
    
    const pendingInteractions = await prisma.requestInteraction.findMany({
      where: {
        status: 'PENDING',
        scheduledFor: { lte: new Date() },
      },
      take: 5,
      orderBy: { scheduledFor: 'asc' },
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

    if (pendingInteractions.length === 0) {
      console.log('   ⚠️  No hay interactions pendientes para enviar.');
      console.log('   💡 Puedes crear una manualmente o esperar al scheduler job.\n');
      
      // Opcional: crear una interaction de prueba
      console.log('   ¿Quieres crear una interaction de prueba? (requiere Request ID válido)');
      console.log('   Ejecuta: npm run whatsapp:resend request <request-id>\n');
    } else {
      console.log(`   ✅ Encontradas ${pendingInteractions.length} interactions pendientes:\n`);
      pendingInteractions.forEach((interaction, index) => {
        const metadata = interaction.metadata as any;
        console.log(`   ${index + 1}. Interaction: ${interaction.id.substring(0, 8)}...`);
        console.log(`      Request: ${interaction.request.title || interaction.request.id.substring(0, 8)}`);
        console.log(`      Template: ${interaction.messageTemplate}`);
        console.log(`      Scheduled: ${interaction.scheduledFor.toISOString()}`);
        console.log(`      Recipient: ${metadata?.recipientPhone || 'N/A'}\n`);
      });
    }

    // 3. Ejecutar dispatch job
    console.log('3️⃣ Ejecutando dispatch job para enviar mensajes...\n');
    
    const beforeCount = await prisma.requestInteraction.count({
      where: { status: 'SENT' },
    });

    await dispatchJob.dispatchPendingMessages();

    // Esperar un poco para que Twilio procese
    console.log('   ⏳ Esperando 3 segundos para que Twilio procese...\n');
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const afterCount = await prisma.requestInteraction.count({
      where: { status: 'SENT' },
    });

    const sentCount = afterCount - beforeCount;
    console.log(`   ✅ ${sentCount} mensaje(s) enviado(s)\n`);

    // 4. Verificar mensajes enviados recientemente
    console.log('4️⃣ Verificando mensajes enviados...\n');
    
    const sentInteractions = await prisma.requestInteraction.findMany({
      where: {
        status: 'SENT',
        sentAt: { gte: new Date(Date.now() - 60000) }, // Último minuto
      },
      take: 5,
      orderBy: { sentAt: 'desc' },
    });

    if (sentInteractions.length === 0) {
      console.log('   ⚠️  No se encontraron mensajes enviados recientemente.\n');
    } else {
      console.log(`   ✅ ${sentInteractions.length} mensaje(s) enviado(s) recientemente:\n`);
      
      for (const interaction of sentInteractions) {
        const metadata = interaction.metadata as any;
        console.log(`   - Message SID: ${interaction.twilioMessageSid}`);
        console.log(`     Status: ${interaction.status}`);
        console.log(`     Twilio Status: ${interaction.twilioStatus || 'N/A'}`);
        console.log(`     Sent At: ${interaction.sentAt?.toISOString()}`);
        console.log(`     Recipient: ${metadata?.recipientPhone || 'N/A'}\n`);

        // Verificar estado en Twilio si tenemos SID
        if (interaction.twilioMessageSid && twilioService.isInitialized()) {
          try {
            const twilioClient = twilioService.getClient();
            const message = await twilioClient.messages(interaction.twilioMessageSid).fetch();
            console.log(`     📊 Estado en Twilio: ${message.status}`);
            if (message.errorCode) {
              console.log(`     ⚠️  Error Code: ${message.errorCode}`);
              console.log(`     ⚠️  Error Message: ${message.errorMessage}`);
            }
            console.log('');
          } catch (error: any) {
            console.log(`     ⚠️  No se pudo verificar estado en Twilio: ${error.message}\n`);
          }
        }
      }
    }

    // 5. Instrucciones para testing de webhooks
    console.log('5️⃣ Testing de Webhooks\n');
    console.log('   Para probar webhooks, puedes:\n');
    console.log('   A) Esperar webhooks reales de Twilio (automático)');
    console.log('      - Los webhooks llegarán cuando cambie el estado del mensaje');
    console.log('      - Verifica logs: docker logs -f especialistas-api-dev | grep -i webhook\n');
    
    console.log('   B) Simular webhook manualmente:');
      console.log('      ./test/scripts/whatsapp/utilities/simulate-webhook.sh status <MessageSid> delivered');
      console.log('      ./test/scripts/whatsapp/utilities/simulate-webhook.sh status <MessageSid> failed\n');
    
    if (sentInteractions.length > 0 && sentInteractions[0].twilioMessageSid) {
      const testSid = sentInteractions[0].twilioMessageSid;
      console.log(`   💡 Ejemplo con mensaje reciente:`);
      console.log(`      ./test/scripts/whatsapp/utilities/simulate-webhook.sh status ${testSid} delivered\n`);
    }

    // 6. Verificar estado final
    console.log('6️⃣ Estado Final del Sistema\n');
    
    const stats = {
      pending: await prisma.requestInteraction.count({ where: { status: 'PENDING' } }),
      sent: await prisma.requestInteraction.count({ where: { status: 'SENT' } }),
      delivered: await prisma.requestInteraction.count({ where: { status: 'DELIVERED' } }),
      responded: await prisma.requestInteraction.count({ where: { status: 'RESPONDED' } }),
      failed: await prisma.requestInteraction.count({ where: { status: 'FAILED' } }),
    };

    console.log('   📊 Estadísticas de Interactions:');
    console.log(`      Pending: ${stats.pending}`);
    console.log(`      Sent: ${stats.sent}`);
    console.log(`      Delivered: ${stats.delivered}`);
    console.log(`      Responded: ${stats.responded}`);
    console.log(`      Failed: ${stats.failed}\n`);

    // 7. Verificar webhooks recibidos recientemente
    console.log('7️⃣ Verificando webhooks recibidos...\n');
    console.log('   💡 Revisa los logs para ver webhooks recibidos:');
    console.log('      docker logs especialistas-api-dev --tail 50 | grep -i "webhook\\|twilio"\n');

    console.log('='.repeat(60));
    console.log('\n✅ Test completado!\n');
    console.log('📝 Próximos pasos:');
    console.log('   1. Verifica que los mensajes llegaron a WhatsApp');
    console.log('   2. Revisa los logs para ver webhooks recibidos');
    console.log('   3. Simula webhooks si es necesario para testing');
    console.log('   4. Verifica que las interactions se actualizaron correctamente\n');

  } catch (error: any) {
    console.error('\n❌ Error durante el test:', error.message);
    console.error(error.stack);
  } finally {
    await app.close();
  }
}

testFullFlow().catch(console.error);

