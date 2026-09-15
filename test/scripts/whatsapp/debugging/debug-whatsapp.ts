#!/usr/bin/env ts-node
/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * Script de debugging para WhatsApp
 * Verifica configuración y estado de mensajes
 *
 * Uso:
 *   npx ts-node test/scripts/whatsapp/debugging/debug-whatsapp.ts
 *   docker exec especialistas-api-dev npm run whatsapp:debug
 */

// Load environment variables from .env file
// Try to load dotenv if available, otherwise rely on environment variables
try {
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
import { TwilioClientService } from '../../../../src/shared/infrastructure/messaging/twilio-client.service';
import { ConfigService } from '@nestjs/config';

async function debugWhatsApp() {
  console.log('🔍 WhatsApp Debugging Tool\n');

  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);
  const twilioService = app.get(TwilioClientService);
  const config = app.get(ConfigService);

  try {
    // 1. Verificar configuración de Twilio
    console.log('1️⃣ Twilio Configuration:');
    const accountSid = config.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = config.get<string>('TWILIO_AUTH_TOKEN');
    const fromNumber = config.get<string>('TWILIO_WHATSAPP_FROM');

    console.log(
      `   Account SID: ${accountSid ? '✅ Configurado' : '❌ No configurado'}`,
    );
    console.log(
      `   Auth Token: ${authToken ? '✅ Configurado' : '❌ No configurado'}`,
    );
    console.log(`   From Number: ${fromNumber || '❌ No configurado'}`);
    console.log(
      `   Client Initialized: ${twilioService.isInitialized() ? '✅ Sí' : '❌ No'}`,
    );

    if (!twilioService.isInitialized()) {
      console.log(
        '\n⚠️  Twilio client no está inicializado. Verifica las variables de entorno.',
      );
      await app.close();
      return;
    }

    // 2. Verificar mensajes enviados recientemente
    console.log('\n2️⃣ Recent Messages Sent:');
    const recentInteractions = await prisma.requestInteraction.findMany({
      where: {
        twilioMessageSid: { not: null },
      },
      take: 5,
      orderBy: { sentAt: 'desc' },
      include: {
        request: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (recentInteractions.length === 0) {
      console.log('   No hay mensajes enviados aún.');
    } else {
      recentInteractions.forEach((interaction) => {
        const metadata = interaction.metadata as any;
        const recipientPhone = metadata?.recipientPhone || 'unknown';
        console.log(`   - Message SID: ${interaction.twilioMessageSid}`);
        console.log(`     Status: ${interaction.status}`);
        console.log(`     Twilio Status: ${interaction.twilioStatus || 'N/A'}`);
        console.log(`     Recipient: ${recipientPhone}`);
        console.log(
          `     Sent At: ${interaction.sentAt?.toISOString() || 'N/A'}`,
        );
        console.log(`     Request: ${interaction.request.status}`);
        console.log('');
      });
    }

    // 3. Verificar estado en Twilio (si hay mensajes recientes)
    if (recentInteractions.length > 0 && twilioService.isInitialized()) {
      console.log('3️⃣ Checking Message Status in Twilio:');
      const twilioClient = twilioService.getClient();

      for (const interaction of recentInteractions.slice(0, 3)) {
        if (interaction.twilioMessageSid) {
          try {
            const message = await twilioClient
              .messages(interaction.twilioMessageSid)
              .fetch();
            console.log(`   Message ${interaction.twilioMessageSid}:`);
            console.log(`     Status: ${message.status}`);
            console.log(`     Error Code: ${message.errorCode || 'N/A'}`);
            console.log(`     Error Message: ${message.errorMessage || 'N/A'}`);
            console.log(`     To: ${message.to}`);
            console.log(`     From: ${message.from}`);
            console.log('');
          } catch (error: any) {
            console.log(
              `   ❌ Error fetching message ${interaction.twilioMessageSid}: ${error.message}`,
            );
          }
        }
      }
    }

    // 4. Verificar números de teléfono en la base de datos
    console.log('4️⃣ Phone Numbers in Database:');
    const usersWithPhone = await prisma.user.findMany({
      where: {
        phone: { not: null },
        phoneVerified: true,
      },
      select: {
        id: true,
        phone: true,
        phoneVerified: true,
        firstName: true,
        lastName: true,
      },
      take: 10,
    });

    if (usersWithPhone.length === 0) {
      console.log('   ⚠️  No hay usuarios con teléfono verificado.');
    } else {
      console.log(
        `   Found ${usersWithPhone.length} users with verified phone:`,
      );
      usersWithPhone.forEach((user) => {
        console.log(`     - ${user.firstName} ${user.lastName}: ${user.phone}`);
      });
    }

    // 5. Información importante sobre Twilio Sandbox
    console.log('\n5️⃣ ⚠️  IMPORTANT: Twilio Sandbox Requirements:');
    console.log('   Para que los mensajes lleguen en modo Sandbox:');
    console.log('   1. El número debe estar registrado en Twilio Sandbox');
    console.log(
      '   2. El usuario debe enviar primero: "join <codigo>" al número de Sandbox',
    );
    console.log(
      '   3. El código de unión está en Twilio Console → WhatsApp → Sandbox',
    );
    console.log(
      `   4. Número de Sandbox: ${fromNumber || 'Configurar TWILIO_WHATSAPP_FROM'}`,
    );
    console.log('\n   Para verificar en Twilio Console:');
    console.log(
      '   - Ve a: https://console.twilio.com/us1/develop/sms/sandbox',
    );
    console.log(
      '   - Verifica que el número esté en la lista de "Sandbox participants"',
    );
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await app.close();
  }
}

debugWhatsApp().catch(console.error);
