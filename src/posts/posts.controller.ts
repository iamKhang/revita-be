import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { PostsService } from './posts.service';
import {
  AdminPostsQueryDto,
  CreateCategoryDraftDto,
  CreateCommentDto,
  CreateDraftPostDto,
  CreateSeriesDraftDto,
  LimitedPostsQueryDto,
  PublishedPostsQueryDto,
  UpdateCategoryDto,
  UpdatePostDto,
  UpdateSeriesDto,
} from './dto';
import { JwtAuthGuard } from '../login/jwt-auth.guard';
import { RolesGuard } from '../rbac/roles.guard';
import { Roles } from '../rbac/roles.decorator';
import { Role } from '../rbac/roles.enum';
import { Public } from '../rbac/public.decorator';

@Controller('posts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post('admin/draft')
  @Roles(Role.ADMIN)
  createDraftPost(@Body() dto: CreateDraftPostDto, @Request() req: any) {
    return this.postsService.createDraftPost(req.user?.id, dto);
  }

  @Get('admin')
  @Roles(Role.ADMIN)
  getAdminPosts(@Query() query: AdminPostsQueryDto) {
    return this.postsService.getAdminPosts(query);
  }

  @Get('admin/categories')
  @Roles(Role.ADMIN)
  getAdminCategories() {
    return this.postsService.getAdminCategories();
  }

  @Post('admin/categories/draft')
  @Roles(Role.ADMIN)
  createCategoryDraft(
    @Body() dto: CreateCategoryDraftDto,
    @Request() req: any,
  ) {
    return this.postsService.createCategoryDraft(req.user?.id, dto);
  }

  @Put('admin/categories/:categoryId')
  @Roles(Role.ADMIN)
  updateCategory(
    @Param('categoryId') categoryId: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.postsService.updateCategory(categoryId, dto);
  }

  @Delete('admin/categories/:categoryId')
  @Roles(Role.ADMIN)
  removeCategory(@Param('categoryId') categoryId: string) {
    return this.postsService.deleteCategory(categoryId);
  }

  @Get('admin/series')
  @Roles(Role.ADMIN)
  getAdminSeries() {
    return this.postsService.getAdminSeries();
  }

  @Post('admin/series/draft')
  @Roles(Role.ADMIN)
  createSeriesDraft(
    @Body() dto: CreateSeriesDraftDto,
    @Request() req: any,
  ) {
    return this.postsService.createSeriesDraft(req.user?.id, dto);
  }

  @Put('admin/series/:seriesId')
  @Roles(Role.ADMIN)
  updateSeries(
    @Param('seriesId') seriesId: string,
    @Body() dto: UpdateSeriesDto,
  ) {
    return this.postsService.updateSeries(seriesId, dto);
  }

  @Delete('admin/series/:seriesId')
  @Roles(Role.ADMIN)
  removeSeries(@Param('seriesId') seriesId: string) {
    return this.postsService.deleteSeries(seriesId);
  }

  @Put('admin/:postId')
  @Roles(Role.ADMIN)
  updatePost(
    @Param('postId') postId: string,
    @Body() dto: UpdatePostDto,
    @Request() req: any,
  ) {
    return this.postsService.updatePost(req.user?.id, postId, dto);
  }

  @Delete('admin/:postId')
  @Roles(Role.ADMIN)
  removePost(@Param('postId') postId: string) {
    return this.postsService.deletePost(postId);
  }

  @Get('admin/:postId')
  @Roles(Role.ADMIN)
  findPostById(@Param('postId') postId: string) {
    return this.postsService.getPostById(postId);
  }

  @Post(':postId/like')
  likePost(@Param('postId') postId: string, @Request() req: any) {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException('Missing user identifier');
    }
    return this.postsService.likePost(postId, userId);
  }

  @Delete(':postId/like')
  unlikePost(@Param('postId') postId: string, @Request() req: any) {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException('Missing user identifier');
    }
    return this.postsService.unlikePost(postId, userId);
  }

  @Post(':postId/unlike')
  unlikePostViaPost(@Param('postId') postId: string, @Request() req: any) {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException('Missing user identifier');
    }
    return this.postsService.unlikePost(postId, userId);
  }

  @Post(':postId/comments')
  createComment(
    @Param('postId') postId: string,
    @Body() dto: CreateCommentDto,
    @Request() req: any,
  ): Promise<any> {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException('Missing user identifier');
    }
    return this.postsService.createComment(postId, userId, dto);
  }

  @Post('comments/:commentId/like')
  likeComment(@Param('commentId') commentId: string, @Request() req: any) {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException('Missing user identifier');
    }
    return this.postsService.likeComment(commentId, userId);
  }

  @Delete('comments/:commentId/like')
  unlikeComment(@Param('commentId') commentId: string, @Request() req: any) {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException('Missing user identifier');
    }
    return this.postsService.unlikeComment(commentId, userId);
  }

  @Get()
  @Public()
  getPublishedPosts(
    @Query() query: PublishedPostsQueryDto,
    @Request() req: any,
  ) {
    return this.postsService.getPublishedPosts(query, req.user?.id);
  }

  @Get('pinned')
  @Public()
  getPinnedPosts(
    @Query() query: LimitedPostsQueryDto,
    @Request() req: any,
  ) {
    return this.postsService.getPinnedPosts(query, req.user?.id);
  }

  @Get('top')
  @Public()
  getTopPosts(
    @Query() query: LimitedPostsQueryDto,
    @Request() req: any,
  ) {
    return this.postsService.getTopPosts(query, req.user?.id);
  }

  @Get('categories')
  @Public()
  getPublishedCategories() {
    return this.postsService.getPublishedCategories();
  }

  @Get('categories/:slug')
  @Public()
  getCategoryBySlug(@Param('slug') slug: string, @Request() req: any) {
    return this.postsService.getCategoryBySlug(slug, req.user?.id);
  }

  @Get('series')
  @Public()
  getPublishedSeries() {
    return this.postsService.getPublishedSeries();
  }

  @Get('series/:slug')
  @Public()
  getSeriesBySlug(@Param('slug') slug: string, @Request() req: any) {
    return this.postsService.getSeriesBySlug(slug, req.user?.id);
  }

  @Get(':slug')
  @Public()
  getPostBySlug(
    @Param('slug') slug: string,
    @Request() req: any,
  ): Promise<any> {
    return this.postsService.getPostBySlug(slug, req.user?.id);
  }
}
