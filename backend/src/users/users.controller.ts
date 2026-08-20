import { Body, Controller, Get, Param, Patch, Post, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';

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

  @Roles('admin')
  @Patch(':id/role')
  updateRole(@Param('id') id: string, @Body('role') role: string, @Req() req: any) {
    return this.users.updateRole(id, role, req.user);
  }
}
