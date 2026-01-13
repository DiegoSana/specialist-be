import { PrismaClient, UserStatus, ProfessionalStatus, RequestStatus, AuthProvider, ReviewStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Clear existing data in correct order
  console.log('🧹 Clearing existing data...');
  await prisma.notificationDelivery.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.notificationPreferences.deleteMany();
  await prisma.inAppNotification.deleteMany();
  await prisma.review.deleteMany();
  await prisma.requestInterest.deleteMany();
  await prisma.request.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.professionalTrade.deleteMany();
  await prisma.companyTrade.deleteMany();
  await prisma.professional.deleteMany();
  await prisma.company.deleteMany();
  await prisma.serviceProvider.deleteMany();
  await prisma.client.deleteMany();
  await prisma.trade.deleteMany();
  await prisma.user.deleteMany();

  // Create trades
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

  // Hash password
  const hashedPassword = await bcrypt.hash('Test1234!', 10);

  // Create Admin User
  console.log('👤 Creating admin user...');
  await prisma.user.create({
    data: {
      email: 'admin@specialist.com',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      phone: '+5492944000000',
      status: UserStatus.ACTIVE,
      authProvider: AuthProvider.LOCAL,
      isAdmin: true,
    },
  });

  // Create Client Users
  console.log('👥 Creating client users...');
  const cliente1 = await prisma.user.create({
    data: {
      email: 'cliente1@test.com',
      password: hashedPassword,
      firstName: 'Juan',
      lastName: 'Pérez',
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
      firstName: 'María',
      lastName: 'García',
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

  // Helper function to create a professional with their ServiceProvider
  async function createProfessionalWithProvider(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone: string;
    professional: {
      description: string;
      experienceYears: number;
      status: ProfessionalStatus;
      zone: string;
      city: string;
      address: string;
      whatsapp: string;
    };
    averageRating?: number;
    totalReviews?: number;
  }) {
    // First create the ServiceProvider
    const serviceProvider = await prisma.serviceProvider.create({
      data: {
        type: 'PROFESSIONAL',
        averageRating: data.averageRating ?? 0,
        totalReviews: data.totalReviews ?? 0,
      },
    });

    // Then create the user with professional linked to the ServiceProvider
    return prisma.user.create({
      data: {
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        status: UserStatus.ACTIVE,
        authProvider: AuthProvider.LOCAL,
        professional: {
          create: {
            serviceProviderId: serviceProvider.id,
            description: data.professional.description,
            experienceYears: data.professional.experienceYears,
            status: data.professional.status,
            zone: data.professional.zone,
            city: data.professional.city,
            address: data.professional.address,
            whatsapp: data.professional.whatsapp,
          },
        },
      },
      include: { 
        professional: {
          include: { serviceProvider: true }
        }
      },
    });
  }

  // Create Professional Users
  console.log('🔨 Creating professional users...');
  const electricista = await createProfessionalWithProvider({
    email: 'electricista@test.com',
    password: hashedPassword,
    firstName: 'Roberto',
    lastName: 'Sánchez',
    phone: '+5492944500001',
    professional: {
      description: 'Electricista matriculado con 15 años de experiencia.',
      experienceYears: 15,
      status: ProfessionalStatus.VERIFIED,
      zone: 'Centro',
      city: 'Bariloche',
      address: 'Av. San Martín 500',
      whatsapp: '+5492944500001',
    },
    averageRating: 4.8,
    totalReviews: 25,
  });

  const plomero = await createProfessionalWithProvider({
    email: 'plomero@test.com',
    password: hashedPassword,
    firstName: 'Miguel',
    lastName: 'Torres',
    phone: '+5492944500002',
    professional: {
      description: 'Plomero con experiencia en instalaciones sanitarias.',
      experienceYears: 10,
      status: ProfessionalStatus.VERIFIED,
      zone: 'Melipal',
      city: 'Bariloche',
      address: 'Rolando 123',
      whatsapp: '+5492944500002',
    },
    averageRating: 4.5,
    totalReviews: 18,
  });

  const gasista = await createProfessionalWithProvider({
    email: 'gasista@test.com',
    password: hashedPassword,
    firstName: 'Pedro',
    lastName: 'Fernández',
    phone: '+5492944500003',
    professional: {
      description: 'Gasista matriculado. Emergencias 24hs.',
      experienceYears: 12,
      status: ProfessionalStatus.VERIFIED,
      zone: 'Las Victorias',
      city: 'Bariloche',
      address: 'Gallardo 456',
      whatsapp: '+5492944500003',
    },
    averageRating: 4.9,
    totalReviews: 32,
  });

  const carpintero = await createProfessionalWithProvider({
    email: 'carpintero@test.com',
    password: hashedPassword,
    firstName: 'Diego',
    lastName: 'Ruiz',
    phone: '+5492944500004',
    professional: {
      description: 'Carpintero especializado en muebles a medida.',
      experienceYears: 20,
      status: ProfessionalStatus.VERIFIED,
      zone: 'Km 5',
      city: 'Bariloche',
      address: 'Km 5.5 Av. Bustillo',
      whatsapp: '+5492944500004',
    },
    averageRating: 5.0,
    totalReviews: 12,
  });

  const pintor = await createProfessionalWithProvider({
    email: 'pintor@test.com',
    password: hashedPassword,
    firstName: 'Lucas',
    lastName: 'Moreno',
    phone: '+5492944500005',
    professional: {
      description: 'Pintor profesional. Interiores y exteriores.',
      experienceYears: 8,
      status: ProfessionalStatus.PENDING_VERIFICATION,
      zone: 'Centro',
      city: 'Bariloche',
      address: 'Onelli 789',
      whatsapp: '+5492944500005',
    },
  });

  const multioficio = await createProfessionalWithProvider({
    email: 'multioficio@test.com',
    password: hashedPassword,
    firstName: 'Fernando',
    lastName: 'Gómez',
    phone: '+5492944500006',
    professional: {
      description: 'Electricista y plomero con amplia experiencia.',
      experienceYears: 18,
      status: ProfessionalStatus.VERIFIED,
      zone: 'Alto',
      city: 'Bariloche',
      address: 'Brown 321',
      whatsapp: '+5492944500006',
    },
    averageRating: 4.7,
    totalReviews: 45,
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

  // Create Direct Requests (using providerId from ServiceProvider)
  console.log('📋 Creating direct requests...');
  const request1 = await prisma.request.create({
    data: {
      clientId: cliente1.id,
      providerId: electricista.professional!.serviceProviderId,
      isPublic: false,
      title: 'Instalación de aire acondicionado',
      description: 'Necesito instalar un aire acondicionado en el living.',
      address: 'Av. Bustillo Km 3.5, Bariloche',
      availability: 'Lunes a viernes de 9 a 18hs',
      status: RequestStatus.PENDING,
    },
  });

  const request2 = await prisma.request.create({
    data: {
      clientId: cliente2.id,
      providerId: plomero.professional!.serviceProviderId,
      isPublic: false,
      title: 'Pérdida de agua en baño',
      description: 'Hay una pérdida de agua debajo del lavatorio del baño.',
      address: 'Moreno 456, Centro, Bariloche',
      availability: 'Cualquier día por la mañana',
      status: RequestStatus.ACCEPTED,
    },
  });

  const request3 = await prisma.request.create({
    data: {
      clientId: cliente1.id,
      providerId: gasista.professional!.serviceProviderId,
      isPublic: false,
      title: 'Revisión de calefactor',
      description: 'Necesito revisión anual de calefactor a gas.',
      address: 'Av. Bustillo Km 3.5, Bariloche',
      availability: 'Fines de semana',
      status: RequestStatus.IN_PROGRESS,
    },
  });

  const request4 = await prisma.request.create({
    data: {
      clientId: cliente3.id,
      providerId: carpintero.professional!.serviceProviderId,
      isPublic: false,
      title: 'Mueble a medida para cocina',
      description: 'Quisiera cotizar un mueble bajo mesada a medida.',
      address: 'Los Ñires 123, Melipal, Bariloche',
      availability: 'Cualquier día',
      status: RequestStatus.DONE,
    },
  });

  const request5 = await prisma.request.create({
    data: {
      clientId: cliente4.id,
      providerId: electricista.professional!.serviceProviderId,
      isPublic: false,
      title: 'Revisión de conexiones eléctricas',
      description: 'Se corta la luz cuando enciendo varios electrodomésticos.',
      address: 'Palacios 789, Alto, Bariloche',
      availability: 'Urgente - cualquier momento',
      status: RequestStatus.DONE,
    },
  });

  const request6 = await prisma.request.create({
    data: {
      clientId: cliente2.id,
      providerId: multioficio.professional!.serviceProviderId,
      isPublic: false,
      title: 'Trabajo eléctrico y plomería',
      description: 'Necesito arreglar la luz del baño y una pérdida en la ducha.',
      address: 'Moreno 456, Centro, Bariloche',
      availability: 'Esta semana',
      status: RequestStatus.CANCELLED,
    },
  });

  // Create Public Requests (no provider assigned)
  console.log('📢 Creating public requests...');
  await prisma.request.create({
    data: {
      clientId: cliente1.id,
      tradeId: tradePintor.id,
      isPublic: true,
      title: 'Pintar departamento completo',
      description: 'Necesito pintar un departamento de 3 ambientes.',
      address: 'Av. Bustillo Km 3.5, Bariloche',
      availability: 'A partir del próximo mes',
      status: RequestStatus.PENDING,
    },
  });

  await prisma.request.create({
    data: {
      clientId: cliente3.id,
      tradeId: tradeAlbañil.id,
      isPublic: true,
      title: 'Reparación de pared húmeda',
      description: 'Tengo humedad en una pared que necesita reparación.',
      address: 'Los Ñires 123, Melipal, Bariloche',
      availability: 'Lo antes posible',
      status: RequestStatus.PENDING,
    },
  });

  await prisma.request.create({
    data: {
      clientId: cliente4.id,
      tradeId: tradeJardinero.id,
      isPublic: true,
      title: 'Mantenimiento de jardín',
      description: 'Busco jardinero para mantenimiento mensual.',
      address: 'Palacios 789, Alto, Bariloche',
      availability: 'Fines de semana preferentemente',
      status: RequestStatus.PENDING,
    },
  });

  // Create Reviews (using serviceProviderId)
  console.log('⭐ Creating reviews...');
  await prisma.review.create({
    data: {
      reviewerId: cliente4.id,
      serviceProviderId: electricista.professional!.serviceProviderId,
      requestId: request5.id,
      rating: 5,
      comment: 'Excelente trabajo, muy profesional y puntual.',
      status: ReviewStatus.APPROVED,
    },
  });

  await prisma.review.create({
    data: {
      reviewerId: cliente3.id,
      serviceProviderId: carpintero.professional!.serviceProviderId,
      requestId: request4.id,
      rating: 5,
      comment: 'El mueble quedó perfecto, tal como lo pedí.',
      status: ReviewStatus.APPROVED,
    },
  });

  // Create some contacts
  console.log('📞 Creating contacts...');
  await prisma.contact.createMany({
    data: [
      { fromUserId: cliente1.id, toUserId: electricista.id, contactType: 'whatsapp', message: 'Hola, me gustaría consultar disponibilidad' },
      { fromUserId: cliente2.id, toUserId: plomero.id, contactType: 'whatsapp' },
      { fromUserId: cliente3.id, toUserId: carpintero.id, contactType: 'phone', message: 'Llamé para pedir presupuesto' },
    ],
  });

  console.log('✅ Seed completed successfully!');
  console.log('');
  console.log('📋 Summary:');
  console.log(`   - ${10} trades created`);
  console.log(`   - 1 admin user`);
  console.log(`   - 4 client users`);
  console.log(`   - 6 professional users (with ServiceProvider)`);
  console.log(`   - 9 requests (6 direct, 3 public)`);
  console.log(`   - 2 reviews`);
  console.log(`   - 3 contacts`);
  console.log('');
  console.log('🔑 Test credentials:');
  console.log('   Admin: admin@specialist.com / Test1234!');
  console.log('   Client: cliente1@test.com / Test1234!');
  console.log('   Professional: electricista@test.com / Test1234!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
