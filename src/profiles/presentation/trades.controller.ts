import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TradeService } from '../application/services/trade.service';
import { Public } from '../../shared/presentation/decorators/public.decorator';

@ApiTags('Trades')
@Controller('trades')
export class TradesController {
  constructor(private readonly tradeService: TradeService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get all trades' })
  @ApiResponse({ status: 200, description: 'List of trades' })
  async findAll() {
    return this.tradeService.findAll();
  }

  @Public()
  @Get('with-professionals')
  @ApiOperation({ summary: 'Get trades that have active professionals' })
  @ApiResponse({
    status: 200,
    description: 'List of trades with active professionals',
  })
  async findWithActiveProfessionals() {
    return this.tradeService.findWithActiveProfessionals();
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get trade by ID' })
  @ApiResponse({ status: 200, description: 'Trade details' })
  @ApiResponse({ status: 404, description: 'Trade not found' })
  async findById(@Param('id') id: string) {
    return this.tradeService.findById(id);
  }
}
