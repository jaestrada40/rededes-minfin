import { Body, Controller, Get, Param, Patch, Post, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AdminSetPasswordDto } from './dto/admin-set-password.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Roles('admin')
  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Roles('admin', 'editor', 'auditor', 'viewer')
  @Get()
  findAll() {
    return this.users.findAll();
  }

  // Cualquier usuario autenticado puede cambiar su propia contraseña —
  // debe ir antes de ":id" para no ser capturada por ese parámetro.
  @Roles('admin', 'editor', 'auditor', 'viewer')
  @Patch('me/password')
  changeOwnPassword(@Body() dto: ChangePasswordDto, @Req() req: any) {
    return this.users.changeOwnPassword(req.user.id, dto, req.user);
  }

  @Roles('admin')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @Req() req: any) {
    return this.users.update(id, dto, req.user);
  }

  @Roles('admin')
  @Patch(':id/role')
  updateRole(@Param('id') id: string, @Body('role') role: string, @Req() req: any) {
    return this.users.updateRole(id, role, req.user);
  }

  @Roles('admin')
  @Patch(':id/status')
  setActive(@Param('id') id: string, @Body('isActive') isActive: boolean, @Req() req: any) {
    return this.users.setActive(id, isActive, req.user);
  }

  @Roles('admin')
  @Patch(':id/reset-mfa')
  resetMfa(@Param('id') id: string, @Req() req: any) {
    return this.users.resetMfa(id, req.user);
  }

  @Roles('admin')
  @Patch(':id/password')
  adminSetPassword(@Param('id') id: string, @Body() dto: AdminSetPasswordDto, @Req() req: any) {
    return this.users.adminSetPassword(id, dto, req.user);
  }
}
