import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PortalsService } from './portals.service';
import { AssignPortalsDto } from './dto/assign-portals.dto';

type AuthedRequest = Request & { user: { email: string } };

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class PortalsController {
  constructor(private readonly portals: PortalsService) {}

  @Roles('admin', 'editor', 'auditor', 'viewer')
  @Get('portals')
  findAll() {
    return this.portals.findAll();
  }

  @Roles('admin')
  @Patch('feeds/:id/portals')
  assign(@Param('id') id: string, @Body() dto: AssignPortalsDto, @Req() req: AuthedRequest) {
    return this.portals.assignFeedToPortals(id, dto.portalIds, req.user);
  }

  @Roles('admin')
  @Post('feeds/:id/portals/assign-all')
  assignAll(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.portals.batchAssignFeedToAllPortals(id, req.user);
  }

  @Roles('admin')
  @Post('portals/sync-all')
  syncAll(@Req() req: AuthedRequest) {
    return this.portals.syncAll(req.user);
  }

  @Roles('admin')
  @Post('portals/:id/test-connection')
  testConnection(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.portals.testConnection(id, req.user);
  }
}
