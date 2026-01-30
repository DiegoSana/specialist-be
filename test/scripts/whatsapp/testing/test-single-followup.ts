#!/usr/bin/env ts-node
/**
 * Script para testear el flujo completo de follow-up para un request específico
 * 
 * Uso:
 *   docker exec especialistas-api-dev npm run whatsapp:test-single <request-id>
 * 
 * O con opciones:
 *   docker exec especialistas-api-dev npm run whatsapp:test-single <request-id> --prepare
 *   docker exec especialistas-api-dev npm run whatsapp:test-single <request-id> --send
 *   docker exec especialistas-api-dev npm run whatsapp:test-single <request-id> --simulate-response
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
import { FollowUpSchedulerJob } from '../../../../src/requests/application/jobs/follow-up-scheduler.job';
import { WhatsAppDispatchJob } from '../../../../src/requests/application/jobs/whatsapp-dispatch.job';
import { RequestInteractionService } from '../../../../src/requests/application/services/request-interaction.service';
import { UserService } from '../../../../src/identity/application/services/user.service';
import { ProfessionalService } from '../../../../src/profiles/application/services/professional.service';
import { CompanyService } from '../../../../src/profiles/application/services/company.service';

async function prepareRequest(
  prisma: PrismaService,
  requestId: string,
  userService: UserService,
  professionalService: ProfessionalService,
  companyService: CompanyService,
) {
  console.log(`\n📝 Preparando Request ${requestId} para follow-up...\n`);

  // 1. Verificar que el request existe
  let request;
  try {
    request = await prisma.request.findUnique({
      where: { id: requestId },
    });
  } catch (error: any) {
    console.log(`❌ Error al buscar request: ${error.message}`);
    console.log(`   Verifica que el ID sea correcto y que la conexión a la BD esté activa`);
    return false;
  }

  if (!request) {
    console.log(`❌ Request ${requestId} no encontrado`);
    console.log(`\n💡 Verificaciones:`);
    console.log(`   1. Verifica que el ID sea correcto (formato UUID)`);
    console.log(`   2. Verifica que el request exista en la base de datos:`);
    console.log(`      docker exec especialistas-api-dev npx prisma studio`);
    console.log(`   3. Intenta buscar requests similares:`);
    console.log(`      docker exec especialistas-api-dev npx prisma db execute --stdin <<< "SELECT id, title FROM requests WHERE title LIKE '%palabra%' LIMIT 5;"`);
    return false;
  }

  console.log(`✅ Request encontrado: "${request.title}"`);
  console.log(`   Estado actual: ${request.status}`);
  console.log(`   Provider ID: ${request.providerId || 'No asignado'}`);
  console.log(`   Client ID: ${request.clientId}`);
  console.log(`   Updated At: ${request.updatedAt.toISOString()}`);

  // 2. Verificar que tiene provider asignado
  if (!request.providerId) {
    console.log(`\n⚠️  Request no tiene provider asignado. Necesitas asignar uno primero.`);
    return false;
  }

  // 3. Verificar provider tiene teléfono verificado (usando servicios como en el scheduler)
  let providerPhone: string | null = null;
  let providerPhoneVerified = false;

  try {
    const professional = await professionalService.findByServiceProviderId(
      request.providerId,
    );
    if (professional) {
      if (professional.whatsapp) {
        providerPhone = professional.whatsapp;
        providerPhoneVerified = true;
      } else {
        const user = await userService.findById(professional.userId);
        if (user?.phone && user.phoneVerified) {
          providerPhone = user.phone;
          providerPhoneVerified = true;
        }
      }
    } else {
      const company = await companyService.findByServiceProviderId(
        request.providerId,
      );
      if (company) {
        if (company.phone) {
          providerPhone = company.phone;
          providerPhoneVerified = true;
        } else {
          const user = await userService.findById(company.userId);
          if (user?.phone && user.phoneVerified) {
            providerPhone = user.phone;
            providerPhoneVerified = true;
          }
        }
      }
    }
  } catch (error: any) {
    console.log(`\n⚠️  Error verificando provider: ${error.message}`);
    return false;
  }

  console.log(`\n📞 Provider Phone: ${providerPhone || 'No configurado'}`);
  console.log(`   Phone Verified: ${providerPhoneVerified ? '✅' : '❌'}`);

  if (!providerPhone || !providerPhoneVerified) {
    console.log(`\n⚠️  Provider no tiene teléfono verificado. Necesitas configurarlo primero.`);
    console.log(`   Puedes verificar/actualizar el teléfono del provider en la base de datos.`);
    return false;
  }

  // 4. Actualizar request a estado ACCEPTED y updated_at hace 4 días
  const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);

  await prisma.request.update({
    where: { id: requestId },
    data: {
      status: 'ACCEPTED',
      updatedAt: fourDaysAgo,
    },
  });

  console.log(`\n✅ Request actualizado:`);
  console.log(`   Estado: ACCEPTED`);
  console.log(`   Updated At: ${fourDaysAgo.toISOString()} (hace 4 días)`);

  // 5. Eliminar interactions existentes para este request (opcional, para empezar limpio)
  const existingInteractions = await prisma.requestInteraction.findMany({
    where: { requestId },
  });

  if (existingInteractions.length > 0) {
    console.log(`\n🗑️  Eliminando ${existingInteractions.length} interaction(s) existente(s)...`);
    await prisma.requestInteraction.deleteMany({
      where: { requestId },
    });
    console.log(`✅ Interactions eliminadas`);
  }

  return true;
}

async function testFollowUpFlow(requestId: string, options: {
  prepare?: boolean;
  send?: boolean;
  simulateResponse?: boolean;
}) {
  console.log('🧪 Testing Follow-up Flow for Single Request\n');
  console.log('='.repeat(60));

  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);
  const schedulerJob = app.get(FollowUpSchedulerJob);
  const dispatchJob = app.get(WhatsAppDispatchJob);
  const interactionService = app.get(RequestInteractionService);
  const userService = app.get(UserService);
  const professionalService = app.get(ProfessionalService);
  const companyService = app.get(CompanyService);

  try {
    // Paso 1: Preparar request
    if (options.prepare !== false) {
      const prepared = await prepareRequest(
        prisma,
        requestId,
        userService,
        professionalService,
        companyService,
      );
      if (!prepared) {
        await app.close();
        return;
      }
    }

    // Paso 2: Ejecutar scheduler
    console.log(`\n🔄 Ejecutando scheduler job para crear follow-up...\n`);
    await schedulerJob.scheduleFollowUps();

    // Verificar que se creó la interaction
    const interactions = await prisma.requestInteraction.findMany({
      where: { requestId },
      orderBy: { createdAt: 'desc' },
    });

    if (interactions.length === 0) {
      console.log(`\n⚠️  No se creó ninguna interaction. Posibles causas:`);
      console.log(`   - Ya existe un follow-up pendiente`);
      console.log(`   - El request no cumple las condiciones (debe estar ACCEPTED y updated_at hace 3+ días)`);
      console.log(`   - El provider no tiene teléfono verificado`);
      await app.close();
      return;
    }

    const followUpInteraction = interactions[0];
    console.log(`\n✅ Follow-up interaction creada:`);
    console.log(`   ID: ${followUpInteraction.id}`);
    console.log(`   Template: ${followUpInteraction.messageTemplate}`);
    console.log(`   Status: ${followUpInteraction.status}`);
    console.log(`   Scheduled For: ${followUpInteraction.scheduledFor.toISOString()}`);
    console.log(`   Message Preview: ${followUpInteraction.messageContent.substring(0, 100)}...`);

    // Paso 3: Enviar mensaje
    if (options.send !== false) {
      console.log(`\n📤 Enviando mensaje...\n`);
      await dispatchJob.dispatchPendingMessages();

      // Esperar un poco para que Twilio procese
      console.log(`   ⏳ Esperando 3 segundos...\n`);
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Verificar estado
      const updatedInteraction = await prisma.requestInteraction.findUnique({
        where: { id: followUpInteraction.id },
      });

      if (updatedInteraction?.status === 'SENT') {
        console.log(`✅ Mensaje enviado exitosamente!`);
        console.log(`   Message SID: ${updatedInteraction.twilioMessageSid}`);
        console.log(`   Status: ${updatedInteraction.status}`);
        console.log(`   Sent At: ${updatedInteraction.sentAt?.toISOString()}`);

        // Verificar estado en Twilio
        if (updatedInteraction.twilioMessageSid) {
          try {
            const twilio = require('twilio');
            const accountSid = process.env.TWILIO_ACCOUNT_SID;
            const authToken = process.env.TWILIO_AUTH_TOKEN;
            if (accountSid && authToken) {
              const client = twilio(accountSid, authToken);
              const message = await client.messages(updatedInteraction.twilioMessageSid).fetch();
              console.log(`\n📊 Estado en Twilio: ${message.status}`);
              if (message.errorCode) {
                console.log(`   ⚠️  Error: ${message.errorCode} - ${message.errorMessage}`);
              }
            }
          } catch (error: any) {
            console.log(`   ⚠️  No se pudo verificar estado en Twilio: ${error.message}`);
          }
        }

        // Paso 4: Simular respuesta (opcional)
        if (options.simulateResponse) {
          console.log(`\n📥 Simulando respuesta del usuario...\n`);

          const metadata = updatedInteraction.metadata as any;
          const recipientPhone = metadata?.recipientPhone;

          if (!recipientPhone) {
            console.log(`⚠️  No se encontró recipientPhone en metadata`);
          } else {
            // Simular mensaje entrante
            await interactionService.processInboundMessage({
              from: `whatsapp:${recipientPhone}`,
              body: 'si confirmo',
              messageId: `SM_simulated_${Date.now()}`,
            });

            console.log(`✅ Respuesta procesada`);

            // Verificar que el Request se actualizó
            const updatedRequest = await prisma.request.findUnique({
              where: { id: requestId },
            });

            console.log(`\n📊 Estado del Request después de la respuesta:`);
            console.log(`   Estado: ${updatedRequest?.status}`);
            console.log(`   Updated At: ${updatedRequest?.updatedAt.toISOString()}`);
          }
        } else {
          console.log(`\n💡 Para simular respuesta del usuario:`);
          console.log(`   docker exec especialistas-api-dev npm run whatsapp:test-single ${requestId} --simulate-response`);
        }
      } else {
        console.log(`\n⚠️  Mensaje no se envió. Estado: ${updatedInteraction?.status}`);
        console.log(`   Verifica los logs para más detalles.`);
      }
    }

    // Resumen final
    console.log(`\n${'='.repeat(60)}`);
    console.log(`\n📋 Resumen:`);
    console.log(`   Request ID: ${requestId}`);
    console.log(`   Interactions creadas: ${interactions.length}`);
    if (interactions.length > 0) {
      const latest = interactions[0];
      console.log(`   Última interaction:`);
      console.log(`     - ID: ${latest.id}`);
      console.log(`     - Status: ${latest.status}`);
      console.log(`     - Message SID: ${latest.twilioMessageSid || 'N/A'}`);
      console.log(`     - Twilio Status: ${latest.twilioStatus || 'N/A'}`);
    }

    console.log(`\n📝 Próximos pasos:`);
    console.log(`   1. Verifica que el mensaje llegó a WhatsApp`);
    console.log(`   2. Espera webhook de Twilio o simula uno:`);
    if (interactions.length > 0 && interactions[0].twilioMessageSid) {
      console.log(`      ./test/scripts/whatsapp/utilities/simulate-webhook.sh status ${interactions[0].twilioMessageSid} delivered`);
    }
    console.log(`   3. Verifica logs: docker logs -f especialistas-api-dev | grep -i webhook`);
    console.log(`   4. Ver estado: docker exec especialistas-api-dev npm run whatsapp:debug\n`);

  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
    console.error(error.stack);
  } finally {
    await app.close();
  }
}

async function main() {
  const requestId = process.argv[2];
  const args = process.argv.slice(3);

  if (!requestId) {
    console.log(`
Uso: docker exec especialistas-api-dev npm run whatsapp:test-single <request-id> [opciones]

Opciones:
  --prepare-only        Solo preparar el request (no enviar)
  --send-only          Solo enviar (asume que ya está preparado)
  --simulate-response   Simular respuesta del usuario después de enviar

Ejemplos:
  # Flujo completo (preparar + enviar)
  docker exec especialistas-api-dev npm run whatsapp:test-single abc-123-def-456

  # Solo preparar
  docker exec especialistas-api-dev npm run whatsapp:test-single abc-123-def-456 --prepare-only

  # Solo enviar (si ya está preparado)
  docker exec especialistas-api-dev npm run whatsapp:test-single abc-123-def-456 --send-only

  # Flujo completo + simular respuesta
  docker exec especialistas-api-dev npm run whatsapp:test-single abc-123-def-456 --simulate-response
    `);
    process.exit(1);
  }

  const options = {
    prepare: !args.includes('--send-only'),
    send: !args.includes('--prepare-only'),
    simulateResponse: args.includes('--simulate-response'),
  };

  await testFollowUpFlow(requestId, options);
}

main().catch(console.error);

