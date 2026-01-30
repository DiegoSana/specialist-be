#!/usr/bin/env ts-node
/**
 * Script para testing manual del sistema de WhatsApp follow-up
 * 
 * Uso:
 *   npx ts-node test/scripts/whatsapp/testing/test-whatsapp-followup.ts [command]
 *   docker exec especialistas-api-dev npm run test:whatsapp [command]
 * 
 * Comandos:
 *   scheduler    - Ejecuta el FollowUpSchedulerJob
 *   dispatch     - Ejecuta el WhatsAppDispatchJob
 *   status       - Muestra estado de interactions y requests
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
import { FollowUpSchedulerJob } from '../../../../src/requests/application/jobs/follow-up-scheduler.job';
import { WhatsAppDispatchJob } from '../../../../src/requests/application/jobs/whatsapp-dispatch.job';
import { PrismaService } from '../../../../src/shared/infrastructure/prisma/prisma.service';

async function runScheduler() {
  console.log('🔄 Running FollowUpSchedulerJob...\n');
  const app = await NestFactory.createApplicationContext(AppModule);
  const scheduler = app.get(FollowUpSchedulerJob);
  
  try {
    await scheduler.scheduleFollowUps();
    console.log('✅ Scheduler completed successfully\n');
  } catch (error) {
    console.error('❌ Scheduler failed:', error);
  } finally {
    await app.close();
  }
}

async function runDispatch() {
  console.log('📤 Running WhatsAppDispatchJob...\n');
  const app = await NestFactory.createApplicationContext(AppModule);
  const dispatch = app.get(WhatsAppDispatchJob);
  
  try {
    await dispatch.dispatchPendingMessages();
    console.log('✅ Dispatch completed successfully\n');
  } catch (error) {
    console.error('❌ Dispatch failed:', error);
  } finally {
    await app.close();
  }
}

async function showStatus() {
  console.log('📊 WhatsApp Follow-up System Status\n');
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);
  
  try {
    // Count interactions by status
    const interactionsByStatus = await prisma.requestInteraction.groupBy({
      by: ['status'],
      _count: true,
    });
    
    console.log('📈 Interactions by Status:');
    interactionsByStatus.forEach(({ status, _count }) => {
      console.log(`  ${status}: ${_count}`);
    });
    
    // Count pending interactions
    const pendingCount = await prisma.requestInteraction.count({
      where: {
        status: 'PENDING',
        scheduledFor: { lte: new Date() },
      },
    });
    
    console.log(`\n⏳ Pending interactions ready to send: ${pendingCount}`);
    
    // Count failed interactions
    const failedCount = await prisma.requestInteraction.count({
      where: { status: 'FAILED' },
    });
    
    console.log(`❌ Failed interactions: ${failedCount}`);
    
    // Show recent interactions
    const recentInteractions = await prisma.requestInteraction.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        request: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });
    
    console.log('\n📋 Recent Interactions:');
    recentInteractions.forEach((interaction) => {
      console.log(`  - ${interaction.id.substring(0, 8)}... | ${interaction.status} | ${interaction.interactionType} | Request: ${interaction.request.status}`);
    });
    
    // Show requests that might need follow-ups
    const requestsNeedingFollowUp = await prisma.request.findMany({
      where: {
        status: { in: ['ACCEPTED', 'IN_PROGRESS'] },
        providerId: { not: null },
        updatedAt: {
          lte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3+ days ago
        },
      },
      take: 5,
      orderBy: { updatedAt: 'asc' },
    });
    
    console.log(`\n🔔 Requests that might need follow-ups: ${requestsNeedingFollowUp.length}`);
    requestsNeedingFollowUp.forEach((request) => {
      const daysSinceUpdate = Math.floor(
        (Date.now() - request.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      console.log(`  - ${request.id.substring(0, 8)}... | ${request.status} | ${daysSinceUpdate} days since update`);
    });
    
  } catch (error) {
    console.error('❌ Error getting status:', error);
  } finally {
    await app.close();
  }
}

async function main() {
  const command = process.argv[2] || 'status';
  
  switch (command) {
    case 'scheduler':
      await runScheduler();
      break;
    case 'dispatch':
      await runDispatch();
      break;
    case 'status':
      await showStatus();
      break;
    default:
      console.log(`
Usage: npx ts-node test/scripts/whatsapp/testing/test-whatsapp-followup.ts [command]

Commands:
  scheduler    - Run FollowUpSchedulerJob
  dispatch     - Run WhatsAppDispatchJob
  status       - Show system status (default)
      `);
      process.exit(1);
  }
}

main().catch(console.error);

