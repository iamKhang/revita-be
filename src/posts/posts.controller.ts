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
  CreateCategoryDto,
  CreateCommentDto,
  CreateDraftPostDto,
  CreatePostDto,
  CreateSeriesDto,
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

  @Post('admin')
  @Roles(Role.ADMIN)
  createPost(@Body() dto: CreatePostDto, @Request() req: any) {
    return this.postsService.createPost(req.user?.id, dto);
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

  @Get('admin')
  @Roles(Role.ADMIN)
  getAdminPosts(@Query() query: AdminPostsQueryDto) {
    return this.postsService.getAdminPosts(query);
  }

  @Post('admin/categories')
  @Roles(Role.ADMIN)
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.postsService.createCategory(dto);
  }

  @Put('admin/categories/:categoryId')
  @Roles(Role.ADMIN)
  updateCategory(
    @Param('categoryId') categoryId: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.postsService.updateCategory(categoryId, dto);
  }

  @Post('admin/series')
  @Roles(Role.ADMIN)
  createSeries(@Body() dto: CreateSeriesDto) {
    return this.postsService.createSeries(dto);
  }

  @Put('admin/series/:seriesId')
  @Roles(Role.ADMIN)
  updateSeries(
    @Param('seriesId') seriesId: string,
    @Body() dto: UpdateSeriesDto,
  ) {
    return this.postsService.updateSeries(seriesId, dto);
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
  getPublishedPosts(@Query() query: PublishedPostsQueryDto) {
    return this.postsService.getPublishedPosts(query);
  }

  @Get('pinned')
  @Public()
  getPinnedPosts(@Query() query: LimitedPostsQueryDto) {
    return this.postsService.getPinnedPosts(query);
  }

  @Get('top')
  @Public()
  getTopPosts(@Query() query: LimitedPostsQueryDto) {
    return this.postsService.getTopPosts(query);
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
