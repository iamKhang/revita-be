import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PostStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
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

const postWithRelationsInclude = {
  author: {
    select: {
      id: true,
      adminCode: true,
      auth: {
        select: {
          id: true,
          name: true,
          avatar: true,
        },
      },
    },
  },
  inCategories: {
    include: {
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
        },
      },
    },
  },
  seriesPosts: {
    include: {
      series: {
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
        },
      },
    },
    orderBy: {
      order: 'asc' as const,
    },
  },
  _count: {
    select: {
      likes: true,
      comments: true,
    },
  },
} satisfies Prisma.PostInclude;

const categoryWithRelationsInclude = {
  postsInCategory: {
    include: {
      post: {
        select: {
          id: true,
          title: true,
          slug: true,
          status: true,
          isPinned: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  },
  _count: {
    select: {
      postsInCategory: true,
    },
  },
} satisfies Prisma.PostCategoryInclude;

const seriesWithRelationsInclude = {
  seriesPosts: {
    include: {
      post: {
        select: {
          id: true,
          title: true,
          slug: true,
          status: true,
          isPinned: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
    orderBy: {
      order: 'asc' as const,
    },
  },
  _count: {
    select: {
      seriesPosts: true,
    },
  },
} satisfies Prisma.SeriesInclude;

const commentWithAuthorInclude = {
  author: {
    select: {
      id: true,
      name: true,
      avatar: true,
    },
  },
  _count: {
    select: {
      likes: true,
      replies: true,
    },
  },
} satisfies Prisma.CommentInclude;

type PostWithRelations = Prisma.PostGetPayload<{
  include: typeof postWithRelationsInclude;
}>;

type CategoryWithRelations = Prisma.PostCategoryGetPayload<{
  include: typeof categoryWithRelationsInclude;
}>;

type SeriesWithRelations = Prisma.SeriesGetPayload<{
  include: typeof seriesWithRelationsInclude;
}>;

type CommentWithAuthor = Prisma.CommentGetPayload<{
  include: typeof commentWithAuthorInclude;
}>;

type PrismaTx = Prisma.TransactionClient;

interface CommentNode {
  id: string;
  postId: string;
  parentId: string | null;
  content: string;
  isEdited: boolean;
  createdAt: Date;
  updatedAt: Date;
  likeCount: number;
  replyCount: number;
  likedByViewer: boolean;
  author: {
    id: string;
    name: string;
    avatar: string | null;
  } | null;
  replies: CommentNode[];
}

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}

  async createDraftPost(authId: string, dto: CreateDraftPostDto) {
    const admin = await this.ensureAdminByAuthId(authId);
    const rawTitle = dto.title?.trim();
    const title = rawTitle && rawTitle.length > 0 ? rawTitle : 'New Draft Post';
    const baseSlug = this.slugify(title) || `draft-${Date.now()}`;
    const slug = await this.ensureUniquePostSlug(baseSlug);

    const draft = await this.prisma.post.create({
      data: {
        title,
        slug,
        authorId: admin.id,
        status: PostStatus.DRAFT,
        tags: [],
      },
      include: postWithRelationsInclude,
    });

    return this.toPostResponse(draft);
  }

  async createPost(authId: string, dto: CreatePostDto) {
    const admin = await this.ensureAdminByAuthId(authId);
    const title = dto.title.trim();
    if (!title) {
      throw new BadRequestException('Title must not be empty');
    }

    const baseSlug = this.slugify(title) || `post-${Date.now()}`;
    const slug = await this.ensureUniquePostSlug(baseSlug);
    const tags = this.normalizeTags(dto.tags);
    const status = dto.status ?? PostStatus.DRAFT;
    const categoryIds = dto.categoryIds ? [...new Set(dto.categoryIds)] : undefined;
    const seriesAssignments = dto.seriesAssignments
      ? dto.seriesAssignments.map((item, index) => ({
          seriesId: item.seriesId,
          order: item.order ?? index,
        }))
      : undefined;

    const postId = await this.prisma.$transaction(async (tx) => {
      if (categoryIds && categoryIds.length > 0) {
        await this.assertCategoryIds(categoryIds, tx);
      }

      if (seriesAssignments && seriesAssignments.length > 0) {
        await this.assertSeriesIds(
          seriesAssignments.map((item) => item.seriesId),
          tx,
        );
      }

      const created = await tx.post.create({
        data: {
          title,
          slug,
          summary: dto.summary?.trim() || undefined,
          content: dto.content ?? undefined,
          thumbnail: dto.thumbnail?.trim() || undefined,
          status,
          isPinned: dto.isPinned ?? false,
          authorId: admin.id,
          tags,
        },
      });

      if (categoryIds && categoryIds.length > 0) {
        await tx.postInCategory.createMany({
          data: categoryIds.map((categoryId) => ({
            postId: created.id,
            categoryId,
          })),
          skipDuplicates: true,
        });
      }

      if (seriesAssignments && seriesAssignments.length > 0) {
        await tx.seriesPost.createMany({
          data: seriesAssignments.map((assignment) => ({
            postId: created.id,
            seriesId: assignment.seriesId,
            order: assignment.order,
          })),
          skipDuplicates: true,
        });
      }

      return created.id;
    });

    return this.getPostById(postId);
  }

  async updatePost(authId: string, postId: string, dto: UpdatePostDto) {
    await this.ensureAdminByAuthId(authId);
    const existing = await this.prisma.post.findUnique({
      where: { id: postId },
    });
    if (!existing) {
      throw new NotFoundException('Post not found');
    }

    const tags =
      dto.tags !== undefined ? this.normalizeTags(dto.tags) : undefined;
    const categoryIds =
      dto.categoryIds !== undefined
        ? [...new Set(dto.categoryIds)]
        : undefined;
    const seriesAssignments =
      dto.seriesAssignments !== undefined
        ? dto.seriesAssignments.map((item, index) => ({
            seriesId: item.seriesId,
            order: item.order ?? index,
          }))
        : undefined;

    await this.prisma.$transaction(async (tx) => {
      const data: Prisma.PostUpdateInput = {};

      if (dto.title !== undefined) {
        const trimmed = dto.title.trim();
        if (!trimmed) {
          throw new BadRequestException('Title must not be empty');
        }
        data.title = trimmed;
        const baseSlug = this.slugify(trimmed) || `post-${Date.now()}`;
        data.slug = await this.ensureUniquePostSlug(baseSlug, postId);
      }

      if (dto.summary !== undefined) {
        data.summary = dto.summary?.trim() || null;
      }

      if (dto.content !== undefined) {
        data.content = dto.content ?? null;
      }

      if (dto.thumbnail !== undefined) {
        data.thumbnail = dto.thumbnail?.trim() || null;
      }

      if (dto.status !== undefined) {
        data.status = dto.status;
      }

      if (dto.isPinned !== undefined) {
        data.isPinned = dto.isPinned;
      }

      if (tags !== undefined) {
        data.tags = tags;
      }

      if (Object.keys(data).length > 0) {
        await tx.post.update({
          where: { id: postId },
          data,
        });
      }

      if (categoryIds !== undefined) {
        if (categoryIds.length > 0) {
          await this.assertCategoryIds(categoryIds, tx);
        }

        await tx.postInCategory.deleteMany({
          where: { postId },
        });

        if (categoryIds.length > 0) {
          await tx.postInCategory.createMany({
            data: categoryIds.map((categoryId) => ({
              postId,
              categoryId,
            })),
            skipDuplicates: true,
          });
        }
      }

      if (seriesAssignments !== undefined) {
        if (seriesAssignments.length > 0) {
          await this.assertSeriesIds(
            seriesAssignments.map((item) => item.seriesId),
            tx,
          );
        }

        await tx.seriesPost.deleteMany({
          where: { postId },
        });

        if (seriesAssignments.length > 0) {
          await tx.seriesPost.createMany({
            data: seriesAssignments.map((assignment) => ({
              postId,
              seriesId: assignment.seriesId,
              order: assignment.order,
            })),
            skipDuplicates: true,
          });
        }
      }
    });

    return this.getPostById(postId);
  }

  async deletePost(postId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true },
    });
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    await this.prisma.$transaction(async (tx) => {
      const commentIds = await tx.comment
        .findMany({
          where: { postId },
          select: { id: true },
        })
        .then((rows) => rows.map((row) => row.id));

      if (commentIds.length > 0) {
        await tx.commentLike.deleteMany({
          where: { commentId: { in: commentIds } },
        });
      }

      await tx.comment.deleteMany({
        where: { postId },
      });

      await tx.postLike.deleteMany({
        where: { postId },
      });

      await tx.postInCategory.deleteMany({
        where: { postId },
      });

      await tx.seriesPost.deleteMany({
        where: { postId },
      });

      await tx.post.delete({
        where: { id: postId },
      });
    });

    return { success: true };
  }

  async getPostById(id: string) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: postWithRelationsInclude,
    });
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    return this.toPostResponse(post);
  }

  async getAdminPosts(query: AdminPostsQueryDto) {
    const { take, skip } = this.normalizePagination(
      query.limit,
      query.offset,
      100,
    );

    const where: Prisma.PostWhereInput = {};

    if (query.status !== undefined) {
      where.status = query.status;
    }

    if (query.isPinned !== undefined) {
      where.isPinned = query.isPinned;
    }

    if (query.search) {
      where.OR = [
        {
          title: {
            contains: query.search,
            mode: 'insensitive',
          },
        },
        {
          summary: {
            contains: query.search,
            mode: 'insensitive',
          },
        },
        {
          content: {
            contains: query.search,
            mode: 'insensitive',
          },
        },
      ];
    }

    if (query.categoryId) {
      where.inCategories = {
        some: {
          categoryId: query.categoryId,
        },
      };
    }

    if (query.seriesId) {
      where.seriesPosts = {
        some: {
          seriesId: query.seriesId,
        },
      };
    }

    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        take,
        skip,
        orderBy: [
          {
            createdAt: 'desc',
          },
          {
            title: 'asc',
          },
        ],
        include: postWithRelationsInclude,
      }),
      this.prisma.post.count({ where }),
    ]);

    return {
      items: posts.map((post) => this.toPostResponse(post)),
      pagination: this.buildPagination(total, take, skip),
    };
  }

  async getPublishedPosts(query: PublishedPostsQueryDto) {
    const { take, skip } = this.normalizePagination(
      query.limit,
      query.offset,
      50,
    );

    const where: Prisma.PostWhereInput = {
      status: PostStatus.PUBLISHED,
    };

    if (query.search) {
      where.OR = [
        {
          title: {
            contains: query.search,
            mode: 'insensitive',
          },
        },
        {
          summary: {
            contains: query.search,
            mode: 'insensitive',
          },
        },
        {
          content: {
            contains: query.search,
            mode: 'insensitive',
          },
        },
      ];
    }

    if (query.categoryId) {
      where.inCategories = {
        some: {
          categoryId: query.categoryId,
        },
      };
    }

    if (query.seriesId) {
      where.seriesPosts = {
        some: {
          seriesId: query.seriesId,
        },
      };
    }

    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        take,
        skip,
        orderBy: [
          {
            createdAt: 'desc',
          },
        ],
        include: postWithRelationsInclude,
      }),
      this.prisma.post.count({ where }),
    ]);

    return {
      items: posts.map((post) => this.toPostResponse(post)),
      pagination: this.buildPagination(total, take, skip),
    };
  }

  async getPinnedPosts(query: LimitedPostsQueryDto) {
    const limit = this.clampLimit(query.limit, 20, 5);
    const posts = await this.prisma.post.findMany({
      where: {
        status: PostStatus.PUBLISHED,
        isPinned: true,
      },
      take: limit,
      orderBy: [{ updatedAt: 'desc' }],
      include: postWithRelationsInclude,
    });

    return posts.map((post) => this.toPostResponse(post));
  }

  async getTopPosts(query: LimitedPostsQueryDto) {
    const limit = this.clampLimit(query.limit, 20, 5);
    const posts = await this.prisma.post.findMany({
      where: {
        status: PostStatus.PUBLISHED,
      },
      take: limit,
      orderBy: [{ createdAt: 'desc' }],
      include: postWithRelationsInclude,
    });

    return posts.map((post) => this.toPostResponse(post));
  }

  async createCategory(dto: CreateCategoryDto) {
    const name = dto.name.trim();
    const description = dto.description.trim();

    if (!name) {
      throw new BadRequestException('Category name must not be empty');
    }

    if (!description) {
      throw new BadRequestException('Category description must not be empty');
    }

    const slugInput = dto.slug?.trim() || name;
    const baseSlug = this.slugify(slugInput) || `category-${Date.now()}`;
    const slug = await this.ensureUniqueCategorySlug(baseSlug);
    const postIds = dto.postIds ? [...new Set(dto.postIds)] : undefined;

    const categoryId = await this.prisma.$transaction(async (tx) => {
      if (postIds && postIds.length > 0) {
        await this.assertPostIds(postIds, tx);
      }

      const created = await tx.postCategory.create({
        data: {
          name,
          slug,
          description,
        },
      });

      if (postIds && postIds.length > 0) {
        await tx.postInCategory.createMany({
          data: postIds.map((postId) => ({
            postId,
            categoryId: created.id,
          })),
          skipDuplicates: true,
        });
      }

      return created.id;
    });

    return this.getCategoryById(categoryId);
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    const category = await this.prisma.postCategory.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    const postIds =
      dto.postIds !== undefined ? [...new Set(dto.postIds)] : undefined;

    await this.prisma.$transaction(async (tx) => {
      const data: Prisma.PostCategoryUpdateInput = {};

      if (dto.name !== undefined) {
        const trimmed = dto.name.trim();
        if (!trimmed) {
          throw new BadRequestException('Category name must not be empty');
        }
        data.name = trimmed;
      }

      if (dto.description !== undefined) {
        const trimmed = dto.description.trim();
        if (!trimmed) {
          throw new BadRequestException(
            'Category description must not be empty',
          );
        }
        data.description = trimmed;
      }

      if (dto.slug !== undefined) {
        const baseSlug =
          this.slugify(dto.slug.trim()) || `category-${Date.now()}`;
        data.slug = await this.ensureUniqueCategorySlug(baseSlug, id);
      }

      if (Object.keys(data).length > 0) {
        await tx.postCategory.update({
          where: { id },
          data,
        });
      }

      if (postIds !== undefined) {
        if (postIds.length > 0) {
          await this.assertPostIds(postIds, tx);
        }

        await tx.postInCategory.deleteMany({
          where: { categoryId: id },
        });

        if (postIds.length > 0) {
          await tx.postInCategory.createMany({
            data: postIds.map((postId) => ({
              postId,
              categoryId: id,
            })),
            skipDuplicates: true,
          });
        }
      }
    });

    return this.getCategoryById(id);
  }

  async getAdminCategories() {
    const categories = await this.prisma.postCategory.findMany({
      orderBy: [{ name: 'asc' }],
      include: categoryWithRelationsInclude,
    });

    return categories.map((category) => this.toCategoryResponse(category));
  }

  async deleteCategory(id: string) {
    const category = await this.prisma.postCategory.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.postInCategory.deleteMany({
        where: { categoryId: id },
      });

      await tx.postCategory.delete({
        where: { id },
      });
    });

    return { success: true };
  }

  async createSeries(dto: CreateSeriesDto) {
    const name = dto.name.trim();
    const description = dto.description.trim();

    if (!name) {
      throw new BadRequestException('Series name must not be empty');
    }

    if (!description) {
      throw new BadRequestException('Series description must not be empty');
    }

    const slugInput = dto.slug?.trim() || name;
    const baseSlug = this.slugify(slugInput) || `series-${Date.now()}`;
    const slug = await this.ensureUniqueSeriesSlug(baseSlug);
    const posts = dto.posts
      ? dto.posts.map((item, index) => ({
          postId: item.postId,
          order: item.order ?? index,
        }))
      : undefined;

    const seriesId = await this.prisma.$transaction(async (tx) => {
      if (posts && posts.length > 0) {
        await this.assertPostIds(
          posts.map((item) => item.postId),
          tx,
        );
      }

      const created = await tx.series.create({
        data: {
          name,
          slug,
          description,
        },
      });

      if (posts && posts.length > 0) {
        await this.setSeriesPosts(tx, created.id, posts);
      }

      return created.id;
    });

    return this.getSeriesById(seriesId);
  }

  async updateSeries(id: string, dto: UpdateSeriesDto) {
    const series = await this.prisma.series.findUnique({
      where: { id },
    });

    if (!series) {
      throw new NotFoundException('Series not found');
    }

    const posts =
      dto.posts !== undefined
        ? dto.posts.map((item, index) => ({
            postId: item.postId,
            order: item.order ?? index,
          }))
        : undefined;

    await this.prisma.$transaction(async (tx) => {
      const data: Prisma.SeriesUpdateInput = {};

      if (dto.name !== undefined) {
        const trimmed = dto.name.trim();
        if (!trimmed) {
          throw new BadRequestException('Series name must not be empty');
        }
        data.name = trimmed;
      }

      if (dto.description !== undefined) {
        const trimmed = dto.description.trim();
        if (!trimmed) {
          throw new BadRequestException('Series description must not be empty');
        }
        data.description = trimmed;
      }

      if (dto.slug !== undefined) {
        const baseSlug = this.slugify(dto.slug.trim()) || `series-${Date.now()}`;
        data.slug = await this.ensureUniqueSeriesSlug(baseSlug, id);
      }

      if (Object.keys(data).length > 0) {
        await tx.series.update({
          where: { id },
          data,
        });
      }

      if (posts !== undefined) {
        if (posts.length > 0) {
          await this.assertPostIds(
            posts.map((item) => item.postId),
            tx,
          );
        }

        await this.setSeriesPosts(tx, id, posts);
      }
    });

    return this.getSeriesById(id);
  }

  async getAdminSeries() {
    const seriesList = await this.prisma.series.findMany({
      orderBy: [{ name: 'asc' }],
      include: seriesWithRelationsInclude,
    });

    return seriesList.map((series) => this.toSeriesResponse(series));
  }

  async deleteSeries(id: string) {
    const series = await this.prisma.series.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!series) {
      throw new NotFoundException('Series not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.seriesPost.deleteMany({
        where: { seriesId: id },
      });

      await tx.series.delete({
        where: { id },
      });
    });

    return { success: true };
  }

  async getPostBySlug(slug: string, viewerId?: string) {
    const post = await this.prisma.post.findUnique({
      where: { slug },
      include: postWithRelationsInclude,
    });

    if (!post || post.status !== PostStatus.PUBLISHED) {
      throw new NotFoundException('Post not found');
    }

    const [likedRecord, comments, likedComments] = await Promise.all([
      viewerId
        ? this.prisma.postLike.findUnique({
            where: {
              postId_userId: {
                postId: post.id,
                userId: viewerId,
              },
            },
          })
        : null,
      this.prisma.comment.findMany({
        where: { postId: post.id },
        orderBy: [{ createdAt: 'asc' }],
        include: commentWithAuthorInclude,
      }),
      viewerId
        ? this.prisma.commentLike.findMany({
            where: {
              userId: viewerId,
              comment: {
                postId: post.id,
              },
            },
            select: {
              commentId: true,
            },
          })
        : [],
    ]);

    const likedCommentIds = new Set(
      likedComments.map((item) => item.commentId),
    );

    return {
      post: this.toPostResponse(post),
      likedByViewer: Boolean(likedRecord),
      comments: this.buildCommentTree(comments, likedCommentIds),
    };
  }

  async likePost(postId: string, userId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, status: true },
    });

    if (!post || post.status !== PostStatus.PUBLISHED) {
      throw new NotFoundException('Post not found');
    }

    await this.prisma.postLike.upsert({
      where: {
        postId_userId: {
          postId,
          userId,
        },
      },
      create: {
        postId,
        userId,
      },
      update: {},
    });

    const likesCount = await this.prisma.postLike.count({
      where: { postId },
    });

    return {
      postId,
      liked: true,
      likesCount,
    };
  }

  async unlikePost(postId: string, userId: string) {
    await this.prisma.postLike.deleteMany({
      where: {
        postId,
        userId,
      },
    });

    const likesCount = await this.prisma.postLike.count({
      where: { postId },
    });

    return {
      postId,
      liked: false,
      likesCount,
    };
  }

  async createComment(postId: string, userId: string, dto: CreateCommentDto) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, status: true },
    });

    if (!post || post.status !== PostStatus.PUBLISHED) {
      throw new NotFoundException('Post not found');
    }

    const content = dto.content.trim();
    if (!content) {
      throw new BadRequestException('Comment content must not be empty');
    }

    if (dto.parentId) {
      const parent = await this.prisma.comment.findUnique({
        where: { id: dto.parentId },
        select: { id: true, postId: true },
      });

      if (!parent || parent.postId !== postId) {
        throw new BadRequestException('Parent comment not found');
      }
    }

    const comment = await this.prisma.comment.create({
      data: {
        postId,
        parentId: dto.parentId ?? null,
        authorId: userId,
        content,
      },
      include: commentWithAuthorInclude,
    });

    return this.toCommentNode(comment, false);
  }

  async likeComment(commentId: string, userId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true },
    });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    await this.prisma.commentLike.upsert({
      where: {
        commentId_userId: {
          commentId,
          userId,
        },
      },
      create: {
        commentId,
        userId,
      },
      update: {},
    });

    const likeCount = await this.prisma.commentLike.count({
      where: { commentId },
    });

    return {
      commentId,
      liked: true,
      likeCount,
    };
  }

  async unlikeComment(commentId: string, userId: string) {
    await this.prisma.commentLike.deleteMany({
      where: {
        commentId,
        userId,
      },
    });

    const likeCount = await this.prisma.commentLike.count({
      where: { commentId },
    });

    return {
      commentId,
      liked: false,
      likeCount,
    };
  }

  private async getCategoryById(id: string) {
    const category = await this.prisma.postCategory.findUnique({
      where: { id },
      include: categoryWithRelationsInclude,
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return this.toCategoryResponse(category);
  }

  private async getSeriesById(id: string) {
    const series = await this.prisma.series.findUnique({
      where: { id },
      include: seriesWithRelationsInclude,
    });

    if (!series) {
      throw new NotFoundException('Series not found');
    }

    return this.toSeriesResponse(series);
  }

  private toPostResponse(post: PostWithRelations) {
    const categories = post.inCategories.map((entry) => entry.category);
    const series = post.seriesPosts.map((entry) => ({
      id: entry.series.id,
      name: entry.series.name,
      slug: entry.series.slug,
      description: entry.series.description,
      order: entry.order,
    }));

    return {
      id: post.id,
      title: post.title,
      slug: post.slug,
      summary: post.summary,
      content: post.content,
      thumbnail: post.thumbnail,
      status: post.status,
      isPinned: post.isPinned,
      tags: post.tags,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      likesCount: post._count.likes,
      commentsCount: post._count.comments,
      categories,
      series,
      author: post.author
        ? {
            id: post.author.id,
            adminCode: post.author.adminCode,
            name: post.author.auth?.name ?? null,
            avatar: post.author.auth?.avatar ?? null,
          }
        : null,
    };
  }

  private toCategoryResponse(category: CategoryWithRelations) {
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
      totalPosts: category._count.postsInCategory,
      posts: category.postsInCategory.map((entry) => entry.post),
    };
  }

  private toSeriesResponse(series: SeriesWithRelations) {
    return {
      id: series.id,
      name: series.name,
      slug: series.slug,
      description: series.description,
      createdAt: series.createdAt,
      updatedAt: series.updatedAt,
      totalPosts: series._count.seriesPosts,
      posts: series.seriesPosts.map((entry) => ({
        ...entry.post,
        order: entry.order,
      })),
    };
  }

  private buildCommentTree(
    comments: CommentWithAuthor[],
    likedCommentIds: Set<string>,
  ) {
    const nodes = new Map<string, CommentNode>();
    const roots: CommentNode[] = [];

    comments.forEach((comment) => {
      const node = this.toCommentNode(
        comment,
        likedCommentIds.has(comment.id),
      );
      nodes.set(comment.id, node);
    });

    comments.forEach((comment) => {
      const node = nodes.get(comment.id);
      if (!node) {
        return;
      }
      if (comment.parentId) {
        const parent = nodes.get(comment.parentId);
        if (parent) {
          parent.replies.push(node);
        } else {
          roots.push(node);
        }
      } else {
        roots.push(node);
      }
    });

    return roots;
  }

  private toCommentNode(
    comment: CommentWithAuthor,
    likedByViewer: boolean,
  ): CommentNode {
    return {
      id: comment.id,
      postId: comment.postId,
      parentId: comment.parentId,
      content: comment.content,
      isEdited: comment.isEdited,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      likeCount: comment._count.likes,
      replyCount: comment._count.replies,
      likedByViewer,
      author: comment.author
        ? {
            id: comment.author.id,
            name: comment.author.name,
            avatar: comment.author.avatar,
          }
        : null,
      replies: [],
    };
  }

  private async ensureAdminByAuthId(authId: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { authId },
      select: { id: true },
    });

    if (!admin) {
      throw new BadRequestException('Admin not found for current user');
    }

    return admin;
  }

  private slugify(input: string) {
    return input
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private async ensureUniquePostSlug(baseSlug: string, excludeId?: string) {
    let slug = baseSlug;
    let counter = 1;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const existing = await this.prisma.post.findUnique({
        where: { slug },
        select: { id: true },
      });

      if (!existing || (excludeId && existing.id === excludeId)) {
        return slug;
      }

      slug = `${baseSlug}-${counter}`;
      counter += 1;
    }
  }

  private async ensureUniqueCategorySlug(baseSlug: string, excludeId?: string) {
    let slug = baseSlug;
    let counter = 1;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const existing = await this.prisma.postCategory.findUnique({
        where: { slug },
        select: { id: true },
      });

      if (!existing || (excludeId && existing.id === excludeId)) {
        return slug;
      }

      slug = `${baseSlug}-${counter}`;
      counter += 1;
    }
  }

  private async ensureUniqueSeriesSlug(baseSlug: string, excludeId?: string) {
    let slug = baseSlug;
    let counter = 1;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const existing = await this.prisma.series.findUnique({
        where: { slug },
        select: { id: true },
      });

      if (!existing || (excludeId && existing.id === excludeId)) {
        return slug;
      }

      slug = `${baseSlug}-${counter}`;
      counter += 1;
    }
  }

  private normalizeTags(tags?: string[] | null) {
    if (!tags || tags.length === 0) {
      return [];
    }

    const unique = new Set<string>();

    tags.forEach((tag) => {
      const trimmed = tag.trim();
      if (trimmed) {
        unique.add(trimmed.toLowerCase());
      }
    });

    return Array.from(unique);
  }

  private normalizePagination(limit: number, offset: number, max: number) {
    const safeLimit = Math.min(Math.max(limit ?? 1, 1), max);
    const safeOffset = Math.max(offset ?? 0, 0);
    return { take: safeLimit, skip: safeOffset };
  }

  private clampLimit(value: number | undefined, max: number, fallback: number) {
    if (!value || value < 1) {
      return fallback;
    }
    return Math.min(value, max);
  }

  private buildPagination(total: number, limit: number, offset: number) {
    return {
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    };
  }

  private async assertCategoryIds(ids: string[], tx: PrismaTx | PrismaService) {
    if (ids.length === 0) {
      return;
    }
    const categories = await tx.postCategory.findMany({
      where: {
        id: { in: ids },
      },
      select: { id: true },
    });
    if (categories.length !== ids.length) {
      throw new BadRequestException('One or more categories do not exist');
    }
  }

  private async assertSeriesIds(ids: string[], tx: PrismaTx | PrismaService) {
    if (ids.length === 0) {
      return;
    }

    const series = await tx.series.findMany({
      where: {
        id: { in: ids },
      },
      select: { id: true },
    });
    if (series.length !== ids.length) {
      throw new BadRequestException('One or more series do not exist');
    }
  }

  private async assertPostIds(ids: string[], tx: PrismaTx | PrismaService) {
    if (ids.length === 0) {
      return;
    }

    const posts = await tx.post.findMany({
      where: {
        id: { in: ids },
      },
      select: { id: true },
    });
    if (posts.length !== ids.length) {
      throw new BadRequestException('One or more posts do not exist');
    }
  }

  private async setSeriesPosts(
    tx: PrismaTx,
    seriesId: string,
    posts: Array<{ postId: string; order: number }>,
  ) {
    await tx.seriesPost.deleteMany({
      where: { seriesId },
    });

    if (posts.length === 0) {
      return;
    }

    await tx.seriesPost.createMany({
      data: posts.map((item) => ({
        seriesId,
        postId: item.postId,
        order: item.order,
      })),
      skipDuplicates: true,
    });
  }
}
