import { PrismaClient, UserStatus, ProfessionalStatus, CompanyStatus, RequestStatus, AuthProvider, ReviewStatus } from '@prisma/client';
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

  // Helper function to create a company with their ServiceProvider
  async function createCompanyWithProvider(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone: string;
    company: {
      companyName: string;
      legalName?: string;
      taxId?: string;
      description: string;
      foundedYear?: number;
      employeeCount?: string;
      website?: string;
      address?: string;
      city: string;
      zone?: string;
      status: CompanyStatus;
    };
    averageRating?: number;
    totalReviews?: number;
  }) {
    const serviceProvider = await prisma.serviceProvider.create({
      data: {
        type: 'COMPANY',
        averageRating: data.averageRating ?? 0,
        totalReviews: data.totalReviews ?? 0,
      },
    });

    return prisma.user.create({
      data: {
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        status: UserStatus.ACTIVE,
        authProvider: AuthProvider.LOCAL,
        company: {
          create: {
            serviceProviderId: serviceProvider.id,
            companyName: data.company.companyName,
            legalName: data.company.legalName,
            taxId: data.company.taxId,
            description: data.company.description,
            foundedYear: data.company.foundedYear,
            employeeCount: data.company.employeeCount,
            website: data.company.website,
            address: data.company.address,
            city: data.company.city,
            zone: data.company.zone,
            status: data.company.status,
          },
        },
      },
      include: {
        company: {
          include: { serviceProvider: true }
        }
      },
    });
  }

  // Create Company Users
  console.log('🏢 Creating company users...');
  const constructora = await createCompanyWithProvider({
    email: 'constructora@test.com',
    password: hashedPassword,
    firstName: 'Martín',
    lastName: 'Constructora',
    phone: '+5492944600001',
    company: {
      companyName: 'Constructora del Sur SRL',
      legalName: 'Constructora del Sur SRL',
      taxId: '30-71234567-8',
      description: 'Empresa constructora con 15 años de experiencia en Bariloche. Obras civiles, remodelaciones y ampliaciones.',
      foundedYear: 2009,
      employeeCount: '6-20',
      website: 'https://constructoradelsur.com.ar',
      address: 'Av. Exequiel Bustillo Km 8',
      city: 'Bariloche',
      zone: 'Km 8',
      status: CompanyStatus.VERIFIED,
    },
    averageRating: 4.9,
    totalReviews: 38,
  });

  const serviciostecnicos = await createCompanyWithProvider({
    email: 'serviciostech@test.com',
    password: hashedPassword,
    firstName: 'Laura',
    lastName: 'Servicios',
    phone: '+5492944600002',
    company: {
      companyName: 'Servicios Técnicos Patagonia',
      legalName: 'Servicios Técnicos Patagonia SA',
      taxId: '30-71345678-9',
      description: 'Instalaciones eléctricas, climatización y automatización para hogares y empresas.',
      foundedYear: 2015,
      employeeCount: '6-20',
      website: 'https://stpatagonia.com.ar',
      address: 'Onelli 450',
      city: 'Bariloche',
      zone: 'Centro',
      status: CompanyStatus.ACTIVE,
    },
    averageRating: 4.6,
    totalReviews: 22,
  });

  const pinturasnorte = await createCompanyWithProvider({
    email: 'pinturasnorte@test.com',
    password: hashedPassword,
    firstName: 'Jorge',
    lastName: 'Pinturas',
    phone: '+5492944600003',
    company: {
      companyName: 'Pinturas del Norte',
      legalName: 'Pinturas del Norte SAS',
      taxId: '30-71456789-0',
      description: 'Pintura industrial y residencial. Trabajos en altura. Impermeabilización.',
      foundedYear: 2018,
      employeeCount: '1-5',
      address: 'Moreno 890',
      city: 'Bariloche',
      zone: 'Centro',
      status: CompanyStatus.ACTIVE,
    },
    averageRating: 4.4,
    totalReviews: 15,
  });

  const empresapendiente = await createCompanyWithProvider({
    email: 'empresapendiente@test.com',
    password: hashedPassword,
    firstName: 'Ricardo',
    lastName: 'Empresa',
    phone: '+5492944600004',
    company: {
      companyName: 'Remodelaciones Express',
      description: 'Remodelaciones rápidas y de calidad. Presupuestos sin cargo.',
      employeeCount: '1-5',
      city: 'Bariloche',
      zone: 'Alto',
      status: CompanyStatus.PENDING_VERIFICATION,
    },
  });

  // Create company trades
  console.log('🔗 Linking trades to companies...');
  await prisma.companyTrade.create({ data: { companyId: constructora.company!.id, tradeId: tradeAlbañil.id, isPrimary: true } });
  await prisma.companyTrade.create({ data: { companyId: constructora.company!.id, tradeId: tradeCarpintero.id, isPrimary: false } });
  await prisma.companyTrade.create({ data: { companyId: constructora.company!.id, tradeId: tradePintor.id, isPrimary: false } });
  await prisma.companyTrade.create({ data: { companyId: serviciostecnicos.company!.id, tradeId: tradeElectricista.id, isPrimary: true } });
  await prisma.companyTrade.create({ data: { companyId: serviciostecnicos.company!.id, tradeId: tradeAire.id, isPrimary: false } });
  await prisma.companyTrade.create({ data: { companyId: pinturasnorte.company!.id, tradeId: tradePintor.id, isPrimary: true } });
  await prisma.companyTrade.create({ data: { companyId: empresapendiente.company!.id, tradeId: tradeAlbañil.id, isPrimary: true } });
  await prisma.companyTrade.create({ data: { companyId: empresapendiente.company!.id, tradeId: tradePintor.id, isPrimary: false } });

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
  const publicRequest1 = await prisma.request.create({
    data: {
      clientId: cliente1.id,
      tradeId: tradePintor.id,
      isPublic: true,
      title: 'Pintar departamento completo',
      description: 'Necesito pintar un departamento de 3 ambientes. Paredes y techos en color blanco.',
      address: 'Av. Bustillo Km 3.5, Bariloche',
      availability: 'A partir del próximo mes',
      status: RequestStatus.PENDING,
    },
  });

  const publicRequest2 = await prisma.request.create({
    data: {
      clientId: cliente3.id,
      tradeId: tradeAlbañil.id,
      isPublic: true,
      title: 'Reparación de pared húmeda',
      description: 'Tengo humedad en una pared que necesita reparación urgente. Se está cayendo el revoque.',
      address: 'Los Ñires 123, Melipal, Bariloche',
      availability: 'Lo antes posible',
      status: RequestStatus.PENDING,
    },
  });

  const publicRequest3 = await prisma.request.create({
    data: {
      clientId: cliente4.id,
      tradeId: tradeJardinero.id,
      isPublic: true,
      title: 'Mantenimiento de jardín',
      description: 'Busco jardinero para mantenimiento mensual de jardín de 500m2.',
      address: 'Palacios 789, Alto, Bariloche',
      availability: 'Fines de semana preferentemente',
      status: RequestStatus.PENDING,
    },
  });

  const publicRequest4 = await prisma.request.create({
    data: {
      clientId: cliente2.id,
      tradeId: tradeElectricista.id,
      isPublic: true,
      title: 'Instalación eléctrica completa',
      description: 'Necesito hacer la instalación eléctrica de una casa en construcción. Incluye tablero y toda la distribución.',
      address: 'Barrio Privado Las Cartas, Bariloche',
      availability: 'A coordinar',
      status: RequestStatus.PENDING,
    },
  });

  const publicRequest5 = await prisma.request.create({
    data: {
      clientId: cliente1.id,
      tradeId: tradeGasista.id,
      isPublic: true,
      title: 'Instalación de calefacción central',
      description: 'Presupuesto para sistema de calefacción central a gas para casa de 150m2.',
      address: 'Av. Bustillo Km 3.5, Bariloche',
      availability: 'Antes del invierno',
      status: RequestStatus.PENDING,
    },
  });

  // Request assigned to a Company
  const requestToCompany = await prisma.request.create({
    data: {
      clientId: cliente3.id,
      providerId: constructora.company!.serviceProviderId,
      isPublic: false,
      title: 'Ampliación de casa',
      description: 'Necesito agregar un cuarto de 4x4m a mi casa. Con baño incluido.',
      address: 'Los Ñires 123, Melipal, Bariloche',
      availability: 'Enero-Febrero',
      status: RequestStatus.IN_PROGRESS,
    },
  });

  // Create Request Interests (providers interested in public requests)
  console.log('🙋 Creating request interests...');
  await prisma.requestInterest.createMany({
    data: [
      // Multiple providers interested in painting request
      { requestId: publicRequest1.id, serviceProviderId: pintor.professional!.serviceProviderId, message: 'Hola, tengo disponibilidad inmediata. Trabajo prolijo y limpio.' },
      { requestId: publicRequest1.id, serviceProviderId: pinturasnorte.company!.serviceProviderId, message: 'Buenos días, podemos encargarnos. Tenemos equipo de 3 personas.' },
      // Providers interested in wall repair
      { requestId: publicRequest2.id, serviceProviderId: constructora.company!.serviceProviderId, message: 'Nos especializamos en reparación de humedad. Garantía de 2 años.' },
      // Providers interested in electrical work
      { requestId: publicRequest4.id, serviceProviderId: electricista.professional!.serviceProviderId, message: 'Electricista matriculado. Hago presupuesto sin cargo.' },
      { requestId: publicRequest4.id, serviceProviderId: serviciostecnicos.company!.serviceProviderId, message: 'Realizamos instalaciones completas. Certificamos ante EPEN.' },
      { requestId: publicRequest4.id, serviceProviderId: multioficio.professional!.serviceProviderId, message: 'Puedo hacer el trabajo completo.' },
      // Provider interested in gas installation
      { requestId: publicRequest5.id, serviceProviderId: gasista.professional!.serviceProviderId, message: 'Gasista matriculado. Experiencia en calefacción central.' },
    ],
  });

  // Create Reviews (using serviceProviderId)
  console.log('⭐ Creating reviews...');
  await prisma.review.create({
    data: {
      reviewerId: cliente4.id,
      serviceProviderId: electricista.professional!.serviceProviderId,
      requestId: request5.id,
      rating: 5,
      comment: 'Excelente trabajo, muy profesional y puntual. Resolvió el problema de inmediato.',
      status: ReviewStatus.APPROVED,
    },
  });

  await prisma.review.create({
    data: {
      reviewerId: cliente3.id,
      serviceProviderId: carpintero.professional!.serviceProviderId,
      requestId: request4.id,
      rating: 5,
      comment: 'El mueble quedó perfecto, tal como lo pedí. Gran calidad de trabajo.',
      status: ReviewStatus.APPROVED,
    },
  });

  // Create a completed request for company to have a review
  const requestCompanyDone = await prisma.request.create({
    data: {
      clientId: cliente2.id,
      providerId: serviciostecnicos.company!.serviceProviderId,
      isPublic: false,
      title: 'Instalación de aire acondicionado split',
      description: 'Instalación de equipo split 3000 frigorías en dormitorio principal.',
      address: 'Moreno 456, Centro, Bariloche',
      availability: 'Completado',
      status: RequestStatus.DONE,
    },
  });

  await prisma.review.create({
    data: {
      reviewerId: cliente2.id,
      serviceProviderId: serviciostecnicos.company!.serviceProviderId,
      requestId: requestCompanyDone.id,
      rating: 5,
      comment: 'Muy buen trabajo. El equipo llegó puntual y dejaron todo limpio. El aire funciona perfecto.',
      status: ReviewStatus.APPROVED,
    },
  });

  // Review for constructora
  await prisma.review.create({
    data: {
      reviewerId: cliente3.id,
      serviceProviderId: constructora.company!.serviceProviderId,
      requestId: requestToCompany.id,
      rating: 4,
      comment: 'Buen avance de obra. Cumplen con los plazos. La ampliación va quedando muy bien.',
      status: ReviewStatus.PENDING, // Pending because request is still in progress
    },
  });

  // Review for multioficio
  const requestMultioficioDone = await prisma.request.create({
    data: {
      clientId: cliente1.id,
      providerId: multioficio.professional!.serviceProviderId,
      isPublic: false,
      title: 'Reparación eléctrica y sanitaria',
      description: 'Arreglo de corto circuito y cambio de canilla.',
      address: 'Av. Bustillo Km 3.5, Bariloche',
      availability: 'Completado',
      status: RequestStatus.DONE,
    },
  });

  await prisma.review.create({
    data: {
      reviewerId: cliente1.id,
      serviceProviderId: multioficio.professional!.serviceProviderId,
      requestId: requestMultioficioDone.id,
      rating: 5,
      comment: 'Excelente que pueda hacer ambos trabajos. Muy práctico y buen precio.',
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
  console.log(`   - 10 trades created`);
  console.log(`   - 1 admin user`);
  console.log(`   - 4 client users`);
  console.log(`   - 6 professional users (with ServiceProvider)`);
  console.log(`   - 4 company users (with ServiceProvider)`);
  console.log(`   - 14 requests (8 direct, 6 public)`);
  console.log(`   - 7 request interests`);
  console.log(`   - 6 reviews`);
  console.log(`   - 3 contacts`);
  console.log('');
  console.log('🔑 Test credentials:');
  console.log('   Admin:        admin@specialist.com / Test1234!');
  console.log('   Client:       cliente1@test.com / Test1234!');
  console.log('   Professional: electricista@test.com / Test1234!');
  console.log('   Company:      constructora@test.com / Test1234!');
  console.log('');
  console.log('🏢 Companies:');
  console.log('   - Constructora del Sur SRL (VERIFIED) - constructora@test.com');
  console.log('   - Servicios Técnicos Patagonia (ACTIVE) - serviciostech@test.com');
  console.log('   - Pinturas del Norte (ACTIVE) - pinturasnorte@test.com');
  console.log('   - Remodelaciones Express (PENDING) - empresapendiente@test.com');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
