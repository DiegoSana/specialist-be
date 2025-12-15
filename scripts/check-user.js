const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUser() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: 'diego.plomero@gmail.com' },
      include: { client: true, professional: true },
    });
    
    if (!user) {
      console.log('User not found');
      return;
    }
    
    console.log('User found:');
    console.log(JSON.stringify({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      isAdmin: user.isAdmin,
      hasClient: !!user.client,
      hasProfessional: !!user.professional,
    }, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUser();

