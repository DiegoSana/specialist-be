import { PrismaClient, UserStatus, ProfessionalStatus, RequestStatus, AuthProvider } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Clear existing data
  console.log('🧹 Clearing existing data...');
  await prisma.review.deleteMany();
  await prisma.request.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.professionalTrade.deleteMany();
  await prisma.professional.deleteMany();
  await prisma.client.deleteMany();
  await prisma.trade.deleteMany();
  await prisma.user.deleteMany();

  // Create trades one by one
  console.log('🔧 Creating trades...');
  const tradeElectricista = await prisma.trade.create({
    data: { name: 'Electricista', category: 'Instalaciones', description: 'Instalaciones eléctricas, reparaciones y mantenimiento' },
  });
  const tradePlomero = await prisma.trade.create({
    data: { name: 'Plomero', category: 'Instalaciones', description: 'Instalaciones sanitarias, destapes y reparaciones' },
  });
  const tradeGasista = await prisma.trade.create({
    data: { name: 'Gasista', category: 'Instalaciones', description: 'Instalaciones de gas, calefacción y mantenimiento' },
  });
  const tradeCarpintero = await prisma.trade.create({
    data: { name: 'Carpintero', category: 'Construcción', description: 'Muebles a medida, reparaciones y trabajos en madera' },
  });
  const tradePintor = await prisma.trade.create({
    data: { name: 'Pintor', category: 'Construcción', description: 'Pintura interior y exterior, empapelado' },
  });
  const tradeAlbañil = await prisma.trade.create({
    data: { name: 'Albañil', category: 'Construcción', description: 'Construcción, remodelaciones y reparaciones' },
  });
  const tradeCerrajero = await prisma.trade.create({
    data: { name: 'Cerrajero', category: 'Servicios', description: 'Apertura de puertas, cambio de cerraduras, copias de llaves' },
  });
  const tradeAire = await prisma.trade.create({
    data: { name: 'Técnico en Aires Acondicionados', category: 'Instalaciones', description: 'Instalación, reparación y mantenimiento de aires' },
  });
  const tradeJardinero = await prisma.trade.create({
    data: { name: 'Jardinero', category: 'Exteriores', description: 'Mantenimiento de jardines, poda, diseño de espacios verdes' },
  });
  const tradeVidriero = await prisma.trade.create({
    data: { name: 'Vidriero', category: 'Construcción', description: 'Instalación y reparación de vidrios, espejos y mamparas' },
  });

  const hashedPassword = await bcrypt.hash('123456', 10);

  // Create Admin User
  console.log('👑 Creating admin user...');
  await prisma.user.create({
    data: {
      email: 'admin@specialist.com',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'Specialist',
      phone: '+5492944000000',
      status: UserStatus.ACTIVE,
      isAdmin: true,
      authProvider: AuthProvider.LOCAL,
    },
  });

  // Create Client Users
  console.log('👤 Creating client users...');
  const cliente1 = await prisma.user.create({
    data: {
      email: 'cliente1@test.com',
      password: hashedPassword,
      firstName: 'María',
      lastName: 'García',
      phone: '+5492944111111',
      status: UserStatus.ACTIVE,
      authProvider: AuthProvider.LOCAL,
      client: { create: {} },
    },
  });
  const cliente2 = await prisma.user.create({
    data: {
      email: 'cliente2@test.com',
      password: hashedPassword,
      firstName: 'Juan',
      lastName: 'Pérez',
      phone: '+5492944222222',
      status: UserStatus.ACTIVE,
      authProvider: AuthProvider.LOCAL,
      client: { create: {} },
    },
  });
  const cliente3 = await prisma.user.create({
    data: {
      email: 'cliente3@test.com',
      password: hashedPassword,
      firstName: 'Ana',
      lastName: 'Martínez',
      phone: '+5492944333333',
      status: UserStatus.ACTIVE,
      authProvider: AuthProvider.LOCAL,
      client: { create: {} },
    },
  });
  const cliente4 = await prisma.user.create({
    data: {
      email: 'cliente4@test.com',
      password: hashedPassword,
      firstName: 'Carlos',
      lastName: 'López',
      phone: '+5492944444444',
      status: UserStatus.ACTIVE,
      authProvider: AuthProvider.LOCAL,
      client: { create: {} },
    },
  });

  // Create Professional Users
  console.log('🔨 Creating professional users...');
  const electricista = await prisma.user.create({
    data: {
      email: 'electricista@test.com',
      password: hashedPassword,
      firstName: 'Roberto',
      lastName: 'Sánchez',
      phone: '+5492944500001',
      status: UserStatus.ACTIVE,
      authProvider: AuthProvider.LOCAL,
      professional: {
        create: {
          description: 'Electricista matriculado con 15 años de experiencia.',
          experienceYears: 15,
          status: ProfessionalStatus.VERIFIED,
          zone: 'Centro',
          city: 'Bariloche',
          address: 'Av. San Martín 500',
          whatsapp: '+5492944500001',
          averageRating: 4.8,
          totalReviews: 25,
        },
      },
    },
    include: { professional: true },
  });

  const plomero = await prisma.user.create({
    data: {
      email: 'plomero@test.com',
      password: hashedPassword,
      firstName: 'Miguel',
      lastName: 'Torres',
      phone: '+5492944500002',
      status: UserStatus.ACTIVE,
      authProvider: AuthProvider.LOCAL,
      professional: {
        create: {
          description: 'Plomero con experiencia en instalaciones sanitarias.',
          experienceYears: 10,
          status: ProfessionalStatus.VERIFIED,
          zone: 'Melipal',
          city: 'Bariloche',
          address: 'Rolando 123',
          whatsapp: '+5492944500002',
          averageRating: 4.5,
          totalReviews: 18,
        },
      },
    },
    include: { professional: true },
  });

  const gasista = await prisma.user.create({
    data: {
      email: 'gasista@test.com',
      password: hashedPassword,
      firstName: 'Pedro',
      lastName: 'Fernández',
      phone: '+5492944500003',
      status: UserStatus.ACTIVE,
      authProvider: AuthProvider.LOCAL,
      professional: {
        create: {
          description: 'Gasista matriculado. Emergencias 24hs.',
          experienceYears: 12,
          status: ProfessionalStatus.VERIFIED,
          zone: 'Las Victorias',
          city: 'Bariloche',
          address: 'Gallardo 456',
          whatsapp: '+5492944500003',
          averageRating: 4.9,
          totalReviews: 32,
        },
      },
    },
    include: { professional: true },
  });

  const carpintero = await prisma.user.create({
    data: {
      email: 'carpintero@test.com',
      password: hashedPassword,
      firstName: 'Diego',
      lastName: 'Ruiz',
      phone: '+5492944500004',
      status: UserStatus.ACTIVE,
      authProvider: AuthProvider.LOCAL,
      professional: {
        create: {
          description: 'Carpintero especializado en muebles a medida.',
          experienceYears: 20,
          status: ProfessionalStatus.VERIFIED,
          zone: 'Km 5',
          city: 'Bariloche',
          address: 'Km 5.5 Av. Bustillo',
          whatsapp: '+5492944500004',
          averageRating: 5.0,
          totalReviews: 12,
        },
      },
    },
    include: { professional: true },
  });

  const pintor = await prisma.user.create({
    data: {
      email: 'pintor@test.com',
      password: hashedPassword,
      firstName: 'Lucas',
      lastName: 'Moreno',
      phone: '+5492944500005',
      status: UserStatus.ACTIVE,
      authProvider: AuthProvider.LOCAL,
      professional: {
        create: {
          description: 'Pintor profesional. Interiores y exteriores.',
          experienceYears: 8,
          status: ProfessionalStatus.PENDING_VERIFICATION,
          zone: 'Centro',
          city: 'Bariloche',
          address: 'Onelli 789',
          whatsapp: '+5492944500005',
          averageRating: 0,
          totalReviews: 0,
        },
      },
    },
    include: { professional: true },
  });

  const multioficio = await prisma.user.create({
    data: {
      email: 'multioficio@test.com',
      password: hashedPassword,
      firstName: 'Fernando',
      lastName: 'Gómez',
      phone: '+5492944500006',
      status: UserStatus.ACTIVE,
      authProvider: AuthProvider.LOCAL,
      professional: {
        create: {
          description: 'Electricista y plomero con amplia experiencia.',
          experienceYears: 18,
          status: ProfessionalStatus.VERIFIED,
          zone: 'Alto',
          city: 'Bariloche',
          address: 'Brown 321',
          whatsapp: '+5492944500006',
          averageRating: 4.7,
          totalReviews: 45,
        },
      },
    },
    include: { professional: true },
  });

  // Create professional trades
  console.log('🔗 Linking trades to professionals...');
  await prisma.professionalTrade.create({ data: { professionalId: electricista.professional!.id, tradeId: tradeElectricista.id, isPrimary: true } });
  await prisma.professionalTrade.create({ data: { professionalId: plomero.professional!.id, tradeId: tradePlomero.id, isPrimary: true } });
  await prisma.professionalTrade.create({ data: { professionalId: gasista.professional!.id, tradeId: tradeGasista.id, isPrimary: true } });
  await prisma.professionalTrade.create({ data: { professionalId: carpintero.professional!.id, tradeId: tradeCarpintero.id, isPrimary: true } });
  await prisma.professionalTrade.create({ data: { professionalId: pintor.professional!.id, tradeId: tradePintor.id, isPrimary: true } });
  await prisma.professionalTrade.create({ data: { professionalId: multioficio.professional!.id, tradeId: tradeElectricista.id, isPrimary: true } });
  await prisma.professionalTrade.create({ data: { professionalId: multioficio.professional!.id, tradeId: tradePlomero.id, isPrimary: false } });

  // Create Direct Requests
  console.log('📋 Creating direct requests...');
  await prisma.request.create({
    data: {
      clientId: cliente1.id,
      professionalId: electricista.professional!.id,
      isPublic: false,
      description: 'Necesito instalar un aire acondicionado en el living.',
      address: 'Av. Bustillo Km 3.5, Bariloche',
      availability: 'Lunes a viernes de 9 a 18hs',
      status: RequestStatus.PENDING,
    },
  });

  await prisma.request.create({
    data: {
      clientId: cliente2.id,
      professionalId: plomero.professional!.id,
      isPublic: false,
      description: 'Pérdida de agua en el baño principal.',
      address: 'Onelli 456, Bariloche',
      availability: 'Urgente',
      status: RequestStatus.PENDING,
      quoteAmount: 15000,
      quoteNotes: 'Incluye cambio de flotante.',
    },
  });

  await prisma.request.create({
    data: {
      clientId: cliente3.id,
      professionalId: gasista.professional!.id,
      isPublic: false,
      description: 'Revisar conexión del calefactor Eskabe.',
      address: 'Palacios 789, Bariloche',
      availability: 'Por la mañana',
      status: RequestStatus.ACCEPTED,
      quoteAmount: 8000,
      quoteNotes: 'Revisión completa.',
    },
  });

  await prisma.request.create({
    data: {
      clientId: cliente1.id,
      professionalId: carpintero.professional!.id,
      isPublic: false,
      description: 'Mueble bajo mesada a medida.',
      address: 'Av. San Martín 1200, Bariloche',
      availability: 'Fines de semana',
      status: RequestStatus.IN_PROGRESS,
      quoteAmount: 180000,
      quoteNotes: 'Mueble en melamina blanca.',
    },
  });

  const requestDone = await prisma.request.create({
    data: {
      clientId: cliente4.id,
      professionalId: electricista.professional!.id,
      isPublic: false,
      description: 'Cambiar tablero eléctrico.',
      address: 'Moreno 567, Bariloche',
      availability: 'Lunes y martes',
      status: RequestStatus.DONE,
      quoteAmount: 45000,
      quoteNotes: 'Tablero nuevo con termomagnéticas.',
    },
  });

  await prisma.request.create({
    data: {
      clientId: cliente2.id,
      professionalId: carpintero.professional!.id,
      isPublic: false,
      description: 'Biblioteca empotrada (cancelado).',
      address: 'Elflein 234, Bariloche',
      availability: 'Cualquier día',
      status: RequestStatus.CANCELLED,
    },
  });

  // Create Public Requests (Bolsa de Trabajo)
  console.log('📢 Creating public requests...');
  await prisma.request.create({
    data: {
      clientId: cliente1.id,
      tradeId: tradeElectricista.id,
      isPublic: true,
      description: 'Busco electricista para revisar instalación de casa antigua.',
      address: 'Beschtedt 890, Bariloche',
      availability: 'Lunes a viernes',
      status: RequestStatus.PENDING,
    },
  });

  await prisma.request.create({
    data: {
      clientId: cliente2.id,
      tradeId: tradePlomero.id,
      isPublic: true,
      description: 'Instalación de tanque de agua de 1000 litros.',
      address: 'Km 8 Av. Bustillo, Bariloche',
      availability: 'Urgente',
      status: RequestStatus.PENDING,
    },
  });

  await prisma.request.create({
    data: {
      clientId: cliente3.id,
      tradeId: tradePintor.id,
      isPublic: true,
      description: 'Pintar interior de departamento de 3 ambientes.',
      address: 'Mitre 456, Bariloche',
      availability: 'Marzo 2025',
      status: RequestStatus.PENDING,
    },
  });

  await prisma.request.create({
    data: {
      clientId: cliente4.id,
      tradeId: tradeAlbañil.id,
      isPublic: true,
      description: 'Construcción de parrilla en jardín.',
      address: 'Los Coihues 234, Bariloche',
      availability: 'Flexible',
      status: RequestStatus.PENDING,
    },
  });

  await prisma.request.create({
    data: {
      clientId: cliente1.id,
      tradeId: tradeJardinero.id,
      isPublic: true,
      description: 'Mantenimiento mensual de jardín de 500m2.',
      address: 'Circuito Chico Km 18, Bariloche',
      availability: 'Contrato anual',
      status: RequestStatus.PENDING,
    },
  });

  // Create Reviews
  console.log('⭐ Creating reviews...');
  await prisma.review.create({
    data: {
      reviewerId: cliente4.id,
      professionalId: electricista.professional!.id,
      requestId: requestDone.id,
      rating: 5,
      comment: 'Excelente trabajo. Muy profesional.',
    },
  });

  await prisma.review.create({
    data: {
      reviewerId: cliente1.id,
      professionalId: electricista.professional!.id,
      rating: 5,
      comment: 'Resolvió el problema rápidamente.',
    },
  });

  await prisma.review.create({
    data: {
      reviewerId: cliente2.id,
      professionalId: plomero.professional!.id,
      rating: 4,
      comment: 'Buen trabajo.',
    },
  });

  await prisma.review.create({
    data: {
      reviewerId: cliente3.id,
      professionalId: gasista.professional!.id,
      rating: 5,
      comment: 'Excelente gasista. Muy detallista.',
    },
  });

  console.log('✅ Seed completed!');
  console.log('');
  console.log('📧 Cuentas de prueba (contraseña: 123456):');
  console.log('   Admin:        admin@specialist.com');
  console.log('   Clientes:     cliente1@test.com, cliente2@test.com');
  console.log('   Electricista: electricista@test.com (verificado)');
  console.log('   Plomero:      plomero@test.com (verificado)');
  console.log('   Gasista:      gasista@test.com (verificado)');
  console.log('   Carpintero:   carpintero@test.com (verificado)');
  console.log('   Pintor:       pintor@test.com (pendiente)');
  console.log('   Multi-oficio: multioficio@test.com (verificado)');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
