import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AdminSetPasswordDto } from './dto/admin-set-password.dto';

// Mismo tipo que usan los demás controladores: JwtStrategy deja el usuario
// autenticado en la petición.
type AuthedRequest = Request & {
  user: { id: string; email: string; role: string };
};

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Roles('super_admin', 'admin')
  @Post()
  create(@Body() dto: CreateUserDto, @Req() req: AuthedRequest) {
    return this.users.create(dto, req.user);
  }

  @Roles('super_admin', 'admin', 'editor')
  @Get()
  findAll(@Req() req: AuthedRequest) {
    return this.users.findAll(req.user);
  }

  // Cualquier usuario autenticado puede cambiar su propia contraseña —
  // debe ir antes de ":id" para no ser capturada por ese parámetro.
  @Roles('super_admin', 'admin', 'editor')
  @Patch('me/password')
  changeOwnPassword(@Body() dto: ChangePasswordDto, @Req() req: AuthedRequest) {
    return this.users.changeOwnPassword(req.user.id, dto, req.user);
  }

  @Roles('super_admin', 'admin')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Req() req: AuthedRequest,
  ) {
    return this.users.update(id, dto, req.user);
  }

  @Roles('super_admin', 'admin')
  @Patch(':id/role')
  updateRole(
    @Param('id') id: string,
    @Body('role') role: string,
    @Req() req: AuthedRequest,
  ) {
    return this.users.updateRole(id, role, req.user);
  }

  @Roles('super_admin', 'admin')
  @Patch(':id/status')
  setActive(
    @Param('id') id: string,
    @Body('isActive') isActive: boolean,
    @Req() req: AuthedRequest,
  ) {
    return this.users.setActive(id, isActive, req.user);
  }

  @Roles('super_admin', 'admin')
  @Patch(':id/reset-mfa')
  resetMfa(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.users.resetMfa(id, req.user);
  }

  @Roles('super_admin', 'admin')
  @Patch(':id/password')
  adminSetPassword(
    @Param('id') id: string,
    @Body() dto: AdminSetPasswordDto,
    @Req() req: AuthedRequest,
  ) {
    return this.users.adminSetPassword(id, dto, req.user);
  }
}
