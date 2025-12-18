import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { TradeService } from './trade.service';
import { TRADE_REPOSITORY } from '../../domain/repositories/trade.repository';
import { TradeEntity } from '../../domain/entities/trade.entity';

const createMockTrade = (overrides?: Partial<TradeEntity>): TradeEntity => {
  return new TradeEntity(
    overrides?.id || 'trade-123',
    overrides?.name || 'Electricista',
    overrides?.category || 'Hogar',
    overrides?.description || 'Servicios eléctricos',
    overrides?.createdAt || new Date(),
    overrides?.updatedAt || new Date(),
  );
};

describe('TradeService', () => {
  let service: TradeService;
  let mockTradeRepository: any;

  beforeEach(async () => {
    mockTradeRepository = {
      findAll: jest.fn(),
      findWithActiveProfessionals: jest.fn(),
      findById: jest.fn(),
      findByName: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TradeService,
        { provide: TRADE_REPOSITORY, useValue: mockTradeRepository },
      ],
    }).compile();

    service = module.get<TradeService>(TradeService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all trades', async () => {
      const trades = [
        createMockTrade({ id: 'trade-1', name: 'Electricista' }),
        createMockTrade({ id: 'trade-2', name: 'Plomero' }),
      ];
      mockTradeRepository.findAll.mockResolvedValue(trades);

      const result = await service.findAll();

      expect(result).toHaveLength(2);
      expect(mockTradeRepository.findAll).toHaveBeenCalled();
    });

    it('should return empty array when no trades', async () => {
      mockTradeRepository.findAll.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toHaveLength(0);
    });
  });

  describe('findWithActiveProfessionals', () => {
    it('should return trades with active professionals', async () => {
      const trades = [createMockTrade()];
      mockTradeRepository.findWithActiveProfessionals.mockResolvedValue(trades);

      const result = await service.findWithActiveProfessionals();

      expect(result).toHaveLength(1);
      expect(mockTradeRepository.findWithActiveProfessionals).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should return trade when found', async () => {
      const trade = createMockTrade();
      mockTradeRepository.findById.mockResolvedValue(trade);

      const result = await service.findById('trade-123');

      expect(result).toEqual(trade);
      expect(mockTradeRepository.findById).toHaveBeenCalledWith('trade-123');
    });

    it('should throw NotFoundException when trade not found', async () => {
      mockTradeRepository.findById.mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    const createDto = {
      name: 'Carpintero',
      category: 'Hogar',
      description: 'Trabajos en madera',
    };

    it('should create trade successfully', async () => {
      const newTrade = createMockTrade({ name: 'Carpintero' });

      mockTradeRepository.findByName.mockResolvedValue(null);
      mockTradeRepository.create.mockResolvedValue(newTrade);

      const result = await service.create(createDto);

      expect(result.name).toBe('Carpintero');
      expect(mockTradeRepository.create).toHaveBeenCalledWith({
        name: 'Carpintero',
        category: 'Hogar',
        description: 'Trabajos en madera',
      });
    });

    it('should throw ConflictException if trade name already exists', async () => {
      const existingTrade = createMockTrade({ name: 'Carpintero' });
      mockTradeRepository.findByName.mockResolvedValue(existingTrade);

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
    });

    it('should create trade without optional fields', async () => {
      const minimalDto = { name: 'Pintor' };
      const newTrade = createMockTrade({ name: 'Pintor', category: null as any, description: null as any });

      mockTradeRepository.findByName.mockResolvedValue(null);
      mockTradeRepository.create.mockResolvedValue(newTrade);

      await service.create(minimalDto as any);

      expect(mockTradeRepository.create).toHaveBeenCalledWith({
        name: 'Pintor',
        category: null,
        description: null,
      });
    });
  });

  describe('update', () => {
    const updateDto = {
      name: 'Electricista Industrial',
      description: 'Servicios eléctricos industriales',
    };

    it('should update trade successfully', async () => {
      const trade = createMockTrade();
      const updatedTrade = createMockTrade({ name: 'Electricista Industrial' });

      mockTradeRepository.findById.mockResolvedValue(trade);
      mockTradeRepository.findByName.mockResolvedValue(null);
      mockTradeRepository.update.mockResolvedValue(updatedTrade);

      const result = await service.update('trade-123', updateDto);

      expect(result.name).toBe('Electricista Industrial');
    });

    it('should throw NotFoundException when trade not found', async () => {
      mockTradeRepository.findById.mockResolvedValue(null);

      await expect(service.update('non-existent', updateDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if new name already exists', async () => {
      const trade = createMockTrade({ name: 'Electricista' });
      const existingTrade = createMockTrade({ id: 'other-trade', name: 'Electricista Industrial' });

      mockTradeRepository.findById.mockResolvedValue(trade);
      mockTradeRepository.findByName.mockResolvedValue(existingTrade);

      await expect(service.update('trade-123', updateDto)).rejects.toThrow(ConflictException);
    });

    it('should allow updating without changing name', async () => {
      const trade = createMockTrade();
      const updatedTrade = createMockTrade({ description: 'Updated description' });

      mockTradeRepository.findById.mockResolvedValue(trade);
      mockTradeRepository.update.mockResolvedValue(updatedTrade);

      const result = await service.update('trade-123', { description: 'Updated description' });

      expect(mockTradeRepository.findByName).not.toHaveBeenCalled();
      expect(result).toEqual(updatedTrade);
    });

    it('should allow keeping the same name', async () => {
      const trade = createMockTrade({ name: 'Electricista' });
      mockTradeRepository.findById.mockResolvedValue(trade);
      mockTradeRepository.update.mockResolvedValue(trade);

      await service.update('trade-123', { name: 'Electricista' });

      expect(mockTradeRepository.findByName).not.toHaveBeenCalled();
    });
  });
});

