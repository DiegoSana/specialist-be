import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../shared/presentation/decorators/public.decorator';
import { PrismaService } from '../shared/infrastructure/prisma/prisma.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  async check() {
    const startTime = Date.now();
    
    // Check database connection
    let dbStatus = 'ok';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      dbStatus = 'error';
    }

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      checks: {
        database: dbStatus,
      },
      responseTime: `${Date.now() - startTime}ms`,
    };
  }

  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness check - verifies all dependencies' })
  @ApiResponse({ status: 200, description: 'Service is ready to receive traffic' })
  async ready() {
    // Verify database is connected and ready
    await this.prisma.$queryRaw`SELECT 1`;
    
    return {
      status: 'ready',
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get('live')
  @ApiOperation({ summary: 'Liveness check - verifies the process is running' })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  live() {
    return {
      status: 'alive',
      timestamp: new Date().toISOString(),
    };
  }
}

