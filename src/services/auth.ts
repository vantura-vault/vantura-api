import { prisma } from '../config/database';
import { RegisterDTO, LoginDTO, AuthResponseDTO } from '../types';
import crypto from 'crypto';

// TODO: switch to becrypt instead of crypto, for some reason...

export const authService = {
  // registering new user
  // 
  async register(data: RegisterDTO): Promise<AuthResponseDTO>{
    const existingUser = await prisma.user.findUnique({
      where: {email: data.email}
    });

    if (existingUser){ // throw an error if it already exists
      throw new Error('An account with this email already exists. Please login to your account, or contact support if you do not have an account!')
    }

    const hashedPassword = crypto
      .createHash('sha256')
      .update(data.password)
      .digest('hex');
      
    // create user
    const user = await prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        // TODO: add password
        // password: data.password
      }
    });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + (365 * 24 * 3600 * 1000)); // 7 days  
    // create authentication token
    await prisma.authToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt
      }
    });
    

    return{
      user:{
        id: user.id,
        email: user.email,
        name: user.name,
        companyId: user.companyId
      },
      token,
      expiresAt: expiresAt.toISOString()
    };
  },

  async login(data: LoginDTO): Promise<AuthResponseDTO> {
    const user = await prisma.user.findUnique({
      where: {email: data.email}
    });

    if (!user) {
      throw new Error('Invalid email or password')
    }

    // TODO: add password

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000); // 7 days

    await prisma.authToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt
      }
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        companyId: user.companyId
      },
      token,
      expiresAt: expiresAt.toISOString()
    };
  },

  async verifyToken(token: string){
    const authToken = await prisma.authToken.findUnique({
      where: {token},
      include: {user: true}
    });

    if (!authToken){
      throw new Error('Invalid token');      
    }

    console.log('Token expiration:', authToken.expiresAt);
    console.log('Current time:', new Date());
    console.log('Is expired?', authToken.expiresAt < new Date());

    if (authToken.expiresAt < new Date()) {
      throw new Error('Token expired');
    }

    return authToken.user;
  },

  async logout(token: string): Promise<void>{
    await prisma.authToken.delete({
      where: { token }
    });
  }
};