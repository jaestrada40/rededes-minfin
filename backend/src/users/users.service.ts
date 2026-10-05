import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RolesService } from '../roles/roles.service';
import { AuditService } from '../audit/audit.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AdminSetPasswordDto } from './dto/admin-set-password.dto';
import { User } from '@prisma/client';

export type SafeUser = Omit<User, 'passwordHash'>;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roles: RolesService,
    private readonly audit: AuditService,
  ) {}

  // Un admin de Comunicación Social no puede tocar cuentas de super_admin
  // (DTI) — evita que suplante, desactive o le resetee el MFA/contraseña a
  // quien administra el sistema.
  private async assertCanManageTarget(
    userId: string,
    actor: { id: string; email: string; role: string },
  ): Promise<void> {
    if (actor.role === 'super_admin') return;
    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });
    if (target?.role.name === 'super_admin') {
      throw new BadRequestException(
        'No tiene permisos para modificar una cuenta de super administrador.',
      );
    }
  }

  async create(
    dto: CreateUserDto,
    actor: { id: string; email: string; role: string },
  ): Promise<SafeUser> {
    const role = await this.roles.findByName(dto.role);
    if (!role) throw new BadRequestException(`Rol inválido: ${dto.role}`);
    // Solo DTI (super_admin) puede otorgar el rol de mayor privilegio —
    // un admin de Comunicación Social no puede crear otro super_admin.
    if (role.name === 'super_admin' && actor.role !== 'super_admin') {
      throw new BadRequestException(
        'Solo un super administrador puede asignar el rol de super administrador.',
      );
    }

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
      userId: actor.id,
      userEmail: actor.email,
      userRole: actor.role,
      action: 'Creó usuario institucional',
      module: 'Configuración',
      entity: 'User',
      entityId: user.id,
      details: { newUserEmail: user.email, newUserRole: role.name },
      result: 'Exitoso',
    });

    return user;
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findAll(actor: { id: string; email: string; role: string }): Promise<
    (Omit<SafeUser, 'mfaEnabled' | 'lastLoginAt'> & {
      role: string;
      mfaEnabled?: boolean;
      lastLoginAt?: Date | null;
    })[]
  > {
    const users = await this.prisma.user.findMany({
      omit: { passwordHash: true },
      include: { role: { select: { name: true } } },
    });
    // Un editor solo necesita el directorio para identificar quién es quién
    // (nombre, correo, rol, estado) — mfaEnabled y lastLoginAt de otras
    // cuentas (incluida la del super_admin) no son necesarios para su labor
    // de curaduría de contenido y no deben exponerse a ese rol.
    const canSeeSecurityDetails =
      actor.role === 'super_admin' || actor.role === 'admin';
    return users.map(({ role, mfaEnabled, lastLoginAt, ...rest }) => ({
      ...rest,
      role: role.name,
      mfaEnabled: canSeeSecurityDetails ? mfaEnabled : undefined,
      lastLoginAt: canSeeSecurityDetails ? lastLoginAt : undefined,
    }));
  }

  async updateRole(
    userId: string,
    roleName: string,
    actor: { id: string; email: string; role: string },
  ): Promise<SafeUser> {
    await this.assertCanManageTarget(userId, actor);
    const role = await this.roles.findByName(roleName);
    if (!role) throw new BadRequestException(`Rol inválido: ${roleName}`);
    if (role.name === 'super_admin' && actor.role !== 'super_admin') {
      throw new BadRequestException(
        'Solo un super administrador puede asignar el rol de super administrador.',
      );
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { roleId: role.id },
      omit: { passwordHash: true },
    });
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
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
    await this.assertCanManageTarget(userId, actor);
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
    await this.assertCanManageTarget(userId, actor);

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { isActive },
      omit: { passwordHash: true },
    });
    if (!isActive) {
      await this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await this.audit.log({
      userId: actor.id,
      userEmail: actor.email,
      userRole: actor.role,
      action: isActive
        ? 'Reactivó cuenta de usuario'
        : 'Desactivó cuenta de usuario',
      module: 'Configuración',
      entity: 'User',
      entityId: userId,
      result: isActive ? 'Exitoso' : 'Advertencia',
    });

    return user;
  }

  async resetMfa(
    userId: string,
    actor: { id: string; email: string; role: string },
  ): Promise<SafeUser> {
    await this.assertCanManageTarget(userId, actor);
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
      action:
        'Restableció el MFA de un usuario (deberá configurarlo de nuevo en su próximo inicio de sesión)',
      module: 'Seguridad',
      entity: 'User',
      entityId: userId,
      result: 'Advertencia',
    });

    return user;
  }

  async adminSetPassword(
    userId: string,
    dto: AdminSetPasswordDto,
    actor: { id: string; email: string; role: string },
  ): Promise<void> {
    await this.assertCanManageTarget(userId, actor);
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.audit.log({
      userId: actor.id,
      userEmail: actor.email,
      userRole: actor.role,
      action: 'Restableció la contraseña de un usuario',
      module: 'Seguridad',
      entity: 'User',
      entityId: userId,
      result: 'Advertencia',
    });
  }

  async changeOwnPassword(
    userId: string,
    dto: ChangePasswordDto,
    actor: { id: string; email: string; role: string },
  ): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) {
      await this.audit.log({
        userId: actor.id,
        userEmail: actor.email,
        userRole: actor.role,
        action:
          'Intento fallido de cambio de contraseña (contraseña actual incorrecta)',
        module: 'Seguridad',
        entity: 'User',
        entityId: userId,
        result: 'Fallido',
      });
      throw new UnauthorizedException('La contraseña actual es incorrecta.');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

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
