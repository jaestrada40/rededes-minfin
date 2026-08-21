import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RolesService } from '../roles/roles.service';
import { AuditService } from '../audit/audit.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
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

  async findAll(): Promise<(SafeUser & { role: string })[]> {
    const users = await this.prisma.user.findMany({
      omit: { passwordHash: true },
      include: { role: { select: { name: true } } },
    });
    return users.map(({ role, ...rest }) => ({ ...rest, role: role.name }));
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

  async update(
    userId: string,
    dto: UpdateUserDto,
    actor: { id: string; email: string; role: string },
  ): Promise<SafeUser> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: dto,
      omit: { passwordHash: true },
    });

    await this.audit.log({
      userId: actor.id,
      userEmail: actor.email,
      userRole: actor.role,
      action: 'Actualizó datos de un usuario',
      module: 'Configuración',
      entity: 'User',
      entityId: userId,
      details: { ...dto },
      result: 'Exitoso',
    });

    return user;
  }

  async setActive(
    userId: string,
    isActive: boolean,
    actor: { id: string; email: string; role: string },
  ): Promise<SafeUser> {
    if (userId === actor.id && !isActive) {
      throw new BadRequestException('No puede desactivar su propia cuenta.');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { isActive },
      omit: { passwordHash: true },
    });

    await this.audit.log({
      userId: actor.id,
      userEmail: actor.email,
      userRole: actor.role,
      action: isActive ? 'Reactivó cuenta de usuario' : 'Desactivó cuenta de usuario',
      module: 'Configuración',
      entity: 'User',
      entityId: userId,
      result: isActive ? 'Exitoso' : 'Advertencia',
    });

    return user;
  }

  async resetMfa(userId: string, actor: { id: string; email: string; role: string }): Promise<SafeUser> {
    await this.prisma.mfaSettings.deleteMany({ where: { userId } });
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: false },
      omit: { passwordHash: true },
    });

    await this.audit.log({
      userId: actor.id,
      userEmail: actor.email,
      userRole: actor.role,
      action: 'Restableció el MFA de un usuario (deberá configurarlo de nuevo en su próximo inicio de sesión)',
      module: 'Seguridad',
      entity: 'User',
      entityId: userId,
      result: 'Advertencia',
    });

    return user;
  }

  async changeOwnPassword(
    userId: string,
    dto: ChangePasswordDto,
    actor: { id: string; email: string; role: string },
  ): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) {
      await this.audit.log({
        userId: actor.id,
        userEmail: actor.email,
        userRole: actor.role,
        action: 'Intento fallido de cambio de contraseña (contraseña actual incorrecta)',
        module: 'Seguridad',
        entity: 'User',
        entityId: userId,
        result: 'Fallido',
      });
      throw new UnauthorizedException('La contraseña actual es incorrecta.');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });

    await this.audit.log({
      userId: actor.id,
      userEmail: actor.email,
      userRole: actor.role,
      action: 'Cambió su propia contraseña',
      module: 'Seguridad',
      entity: 'User',
      entityId: userId,
      result: 'Exitoso',
    });
  }
}
