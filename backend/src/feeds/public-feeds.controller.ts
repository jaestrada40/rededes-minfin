import { Controller, Get, Param } from '@nestjs/common';
import { FeedsService } from './feeds.service';

@Controller('public/feeds')
export class PublicFeedsController {
  constructor(private readonly feeds: FeedsService) {}

  @Get(':slug')
  getBySlug(@Param('slug') slug: string) {
    return this.feeds.findPublicBySlug(slug);
  }
}
