import { RequestInterestEntity } from '../../domain/entities/request-interest.entity';
import { InterestedProfessionalResponseDto } from './interested-professional-response.dto';

describe('InterestedProfessionalResponseDto', () => {
  it('never exposes the interested provider phone/whatsapp before they are chosen', () => {
    const entity = new RequestInterestEntity(
      'interest-1',
      'request-1',
      'provider-1',
      'Hola, puedo hacer el trabajo',
      new Date(),
      undefined,
      {
        id: 'provider-1',
        type: 'PROFESSIONAL',
        displayName: 'Juan Pérez',
        profileImage: null,
        averageRating: 4.5,
        totalReviews: 10,
        whatsapp: '+5491111111111',
        phone: '+5491111111111',
      },
    );

    const dto = InterestedProfessionalResponseDto.fromEntity(entity);

    expect(dto.provider).toBeDefined();
    expect(dto.provider).not.toHaveProperty('phone');
    expect(dto.provider).not.toHaveProperty('whatsapp');
    expect(JSON.stringify(dto)).not.toContain('+5491111111111');
  });

  it('fromEntities never exposes contact fields across a full list', () => {
    const entities = [
      new RequestInterestEntity(
        'interest-1',
        'request-1',
        'provider-1',
        null,
        new Date(),
        undefined,
        {
          id: 'provider-1',
          type: 'COMPANY',
          displayName: 'Constructora del Sur',
          profileImage: null,
          averageRating: 0,
          totalReviews: 0,
          whatsapp: null,
          phone: '+5492222222222',
        },
      ),
    ];

    const dtos = InterestedProfessionalResponseDto.fromEntities(entities);

    expect(dtos[0].provider).not.toHaveProperty('phone');
    expect(dtos[0].provider).not.toHaveProperty('whatsapp');
  });
});
