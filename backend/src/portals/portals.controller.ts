import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PortalsService } from './portals.service';
import { AssignPortalsDto } from './dto/assign-portals.dto';
import { CreatePortalDto } from './dto/create-portal.dto';
import { UpdatePortalDto } from './dto/update-portal.dto';

type AuthedRequest = Request & {
  user: { id: string; email: string; role: string };
};

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class PortalsController {
  constructor(private readonly portals: PortalsService) {}

  @Roles('super_admin', 'admin', 'editor')
  @Get('portals')
  findAll() {
    return this.portals.findAll();
  }

  // Alta/edición/baja de portales (URL, API keys, webhook) es configuración
  // técnica del sitio WordPress — reservada a DTI (super_admin).
  @Roles('super_admin')
  @Post('portals')
  create(@Body() dto: CreatePortalDto, @Req() req: AuthedRequest) {
    return this.portals.create(dto, req.user);
  }

  @Roles('super_admin')
  @Patch('portals/:id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePortalDto,
    @Req() req: AuthedRequest,
  ) {
    return this.portals.update(id, dto, req.user);
  }

  @Roles('super_admin')
  @Delete('portals/:id')
  remove(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.portals.remove(id, req.user);
  }

  // Asignar un feed a portales ya existentes es trabajo de distribución de
  // contenido, no configuración técnica — lo conserva Comunicación Social.
  @Roles('super_admin', 'admin')
  @Patch('feeds/:id/portals')
  assign(
    @Param('id') id: string,
    @Body() dto: AssignPortalsDto,
    @Req() req: AuthedRequest,
  ) {
    return this.portals.assignFeedToPortals(id, dto.portalIds, req.user);
  }

  @Roles('super_admin', 'admin')
  @Post('feeds/:id/portals/assign-all')
  assignAll(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.portals.batchAssignFeedToAllPortals(id, req.user);
  }

  @Roles('super_admin')
  @Post('portals/sync-all')
  syncAll(@Req() req: AuthedRequest) {
    return this.portals.syncAll(req.user);
  }

  @Roles('super_admin')
  @Post('portals/:id/test-connection')
  testConnection(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.portals.testConnection(id, req.user);
  }
}
