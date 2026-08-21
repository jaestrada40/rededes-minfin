import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { FeedsService } from './feeds.service';
import { CreateFeedDto } from './dto/create-feed.dto';
import { UpdateFeedDto } from './dto/update-feed.dto';
import { AddPostDto } from './dto/add-post.dto';
import { ReorderPostsDto } from './dto/reorder-posts.dto';
import { UpdatePostContentDto } from './dto/update-post-content.dto';

type AuthedRequest = Request & { user: { id: string; email: string; role: string } };

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class FeedsController {
  constructor(private readonly feeds: FeedsService) {}

  @Roles('admin', 'editor', 'auditor', 'viewer')
  @Get('feeds')
  findAll() {
    return this.feeds.findAll();
  }

  @Roles('admin', 'editor', 'auditor', 'viewer')
  @Get('feeds/:id')
  findOne(@Param('id') id: string) {
    return this.feeds.findOne(id);
  }

  @Roles('admin', 'editor')
  @Post('feeds')
  create(@Body() dto: CreateFeedDto, @Req() req: AuthedRequest) {
    return this.feeds.create(dto, req.user);
  }

  @Roles('admin', 'editor')
  @Patch('feeds/:id')
  update(@Param('id') id: string, @Body() dto: UpdateFeedDto, @Req() req: AuthedRequest) {
    return this.feeds.update(id, dto, req.user);
  }

  @Roles('admin', 'editor')
  @Delete('feeds/:id')
  remove(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.feeds.remove(id, req.user);
  }

  @Roles('admin', 'editor')
  @Post('feeds/:id/duplicate')
  duplicate(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.feeds.duplicate(id, req.user);
  }

  @Roles('admin', 'editor')
  @Post('feeds/:id/posts')
  addPost(@Param('id') id: string, @Body() dto: AddPostDto, @Req() req: AuthedRequest) {
    return this.feeds.addPost(id, dto, req.user);
  }

  @Roles('admin', 'editor')
  @Delete('feeds/:id/posts/:postId')
  removePost(@Param('id') id: string, @Param('postId') postId: string, @Req() req: AuthedRequest) {
    return this.feeds.removePost(id, postId, req.user);
  }

  @Roles('admin', 'editor')
  @Patch('feeds/:id/posts/reorder')
  reorder(@Param('id') id: string, @Body() dto: ReorderPostsDto, @Req() req: AuthedRequest) {
    return this.feeds.reorderPosts(id, dto.orderedPostIds, req.user);
  }

  @Roles('admin', 'editor')
  @Patch('posts/:id')
  updatePostContent(@Param('id') id: string, @Body() dto: UpdatePostContentDto, @Req() req: AuthedRequest) {
    return this.feeds.updatePostContent(id, dto.content, req.user);
  }

  @Roles('admin')
  @Delete('posts/:id')
  deletePostPermanently(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.feeds.deletePostPermanently(id, req.user);
  }
}
