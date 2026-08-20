import { BadRequestException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RolesService } from '../roles/roles.service';
import { AuditService } from '../audit/audit.service';
import { CreateUserDto } from './dto/create-user.dto';
import { User } from '@prisma/client';

export type SafeUser = Omit<User, 'passwordHash'>;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roles: RolesService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateUserDto): Promise<SafeUser> {
    const role = await this.roles.findByName(dto.role);
    if (!role) throw new BadRequestException(`Rol inválido: ${dto.role}`);

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name,
        department: dto.department,
        roleId: role.id,
      },
      omit: { passwordHash: true },
    });

    await this.audit.log({
      userEmail: user.email,
      userRole: role.name,
      action: 'Creó usuario institucional',
      module: 'Configuración',
      entity: 'User',
      entityId: user.id,
      result: 'Exitoso',
    });

    return user;
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findAll(): Promise<SafeUser[]> {
    return this.prisma.user.findMany({ omit: { passwordHash: true } });
  }

  async updateRole(
    userId: string,
    roleName: string,
    actor: { id: string; email: string; role: string },
  ): Promise<SafeUser> {
    const role = await this.roles.findByName(roleName);
    if (!role) throw new BadRequestException(`Rol inválido: ${roleName}`);

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { roleId: role.id },
      omit: { passwordHash: true },
    });

    await this.audit.log({
      userId: actor.id,
      userEmail: actor.email,
      userRole: actor.role,
      action: 'Cambió el rol de un usuario',
      module: 'Configuración',
      entity: 'User',
      entityId: userId,
      details: { newRole: roleName },
      result: 'Exitoso',
    });

    return user;
  }
}
