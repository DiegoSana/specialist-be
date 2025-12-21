import {
  Injectable,
  NotFoundException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import {
  TradeRepository,
  TRADE_REPOSITORY,
} from '../../domain/repositories/trade.repository';
import { TradeEntity } from '../../domain/entities/trade.entity';
import { CreateTradeDto } from '../dto/create-trade.dto';
import { UpdateTradeDto } from '../dto/update-trade.dto';

@Injectable()
export class TradeService {
  constructor(
    @Inject(TRADE_REPOSITORY) private readonly tradeRepository: TradeRepository,
  ) {}

  async findAll(): Promise<TradeEntity[]> {
    return this.tradeRepository.findAll();
  }

  async findWithActiveProfessionals(): Promise<TradeEntity[]> {
    return this.tradeRepository.findWithActiveProfessionals();
  }

  async findById(id: string): Promise<TradeEntity> {
    const trade = await this.tradeRepository.findById(id);
    if (!trade) {
      throw new NotFoundException('Trade not found');
    }
    return trade;
  }

  async create(createDto: CreateTradeDto): Promise<TradeEntity> {
    const existing = await this.tradeRepository.findByName(createDto.name);
    if (existing) {
      throw new ConflictException('Trade with this name already exists');
    }

    return this.tradeRepository.create({
      name: createDto.name,
      category: createDto.category || null,
      description: createDto.description || null,
    });
  }

  async update(id: string, updateDto: UpdateTradeDto): Promise<TradeEntity> {
    const trade = await this.tradeRepository.findById(id);
    if (!trade) {
      throw new NotFoundException('Trade not found');
    }

    if (updateDto.name && updateDto.name !== trade.name) {
      const existing = await this.tradeRepository.findByName(updateDto.name);
      if (existing) {
        throw new ConflictException('Trade with this name already exists');
      }
    }

    return this.tradeRepository.update(id, updateDto);
  }
}
