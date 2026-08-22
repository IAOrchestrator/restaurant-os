import { FastifyInstance } from 'fastify';
import {
  requirePermission,
  validateRestaurantAccess,
  requireResourceAccess,
} from '@restaurant-os/infrastructure';
import { Permission } from '@restaurant-os/domain';
import { randomUUID } from 'crypto';
import {
  CreateCategorySchema,
  UpdateCategorySchema,
  CategoryResponseSchema,
  CreateProductSchema,
  UpdateProductSchema,
  ChangeAvailabilitySchema,
  ProductResponseSchema,
} from '@restaurant-os/contracts';
import {
  CreateCategoryUseCase,
  UpdateCategoryUseCase,
  CreateProductUseCase,
  UpdateProductUseCase,
  ChangeProductAvailabilityUseCase,
  type CategoryRepository,
  type ProductRepository,
  type EventPublisher,
} from '@restaurant-os/application';

export interface CatalogRoutesOptions {
  categoryRepo: CategoryRepository;
  productRepo: ProductRepository;
  eventPublisher: EventPublisher;
}

export async function catalogRoutes(app: FastifyInstance, opts: CatalogRoutesOptions) {
  const createCategoryUseCase = new CreateCategoryUseCase(opts.categoryRepo, opts.eventPublisher);
  const updateCategoryUseCase = new UpdateCategoryUseCase(opts.categoryRepo, opts.eventPublisher);
  const createProductUseCase = new CreateProductUseCase(
    opts.productRepo,
    opts.categoryRepo,
    opts.eventPublisher,
  );
  const updateProductUseCase = new UpdateProductUseCase(opts.productRepo, opts.eventPublisher);
  const changeAvailabilityUseCase = new ChangeProductAvailabilityUseCase(
    opts.productRepo,
    opts.eventPublisher,
  );

  // === CATEGORIES ===

  // POST /api/catalog/categories
  app.post(
    '/categories',
    {
      preHandler: [
        requirePermission(Permission.CATALOG_MANAGE),
        validateRestaurantAccess(),
      ],
    },
    async (request, reply) => {
      const parsed = CreateCategorySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.format() });
      }

      const result = await createCategoryUseCase.execute({
        id: parsed.data.id ?? randomUUID(),
        restaurantId: parsed.data.restaurantId,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        sortOrder: parsed.data.sortOrder,
      });

      if (!result.success) {
        return reply.status(400).send({ error: result.error.message });
      }

      return reply.status(201).send(
        CategoryResponseSchema.parse({
          id: result.value.id,
          restaurantId: result.value.restaurantId,
          name: result.value.name,
          description: result.value.description,
          sortOrder: result.value.sortOrder,
          isActive: result.value.isActive,
          createdAt: result.value.createdAt.toISOString(),
          updatedAt: result.value.updatedAt.toISOString(),
        }),
      );
    },
  );

  // GET /api/catalog/categories?restaurantId=...
  app.get(
    '/categories',
    {
      preHandler: [
        requirePermission(Permission.CATALOG_READ),
        validateRestaurantAccess(),
      ],
    },
    async (request, reply) => {
      const { restaurantId } = request.query as { restaurantId?: string };
      if (!restaurantId) {
        return reply.status(400).send({ error: 'restaurantId query param is required' });
      }

      const categories = await opts.categoryRepo.findByRestaurantId(restaurantId);
      return categories.map((c) =>
        CategoryResponseSchema.parse({
          id: c.id,
          restaurantId: c.restaurantId,
          name: c.name,
          description: c.description,
          sortOrder: c.sortOrder,
          isActive: c.isActive,
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
        }),
      );
    },
  );

  // GET /api/catalog/categories/:id
  app.get(
    '/categories/:id',
    {
      preHandler: [
        requirePermission(Permission.CATALOG_READ),
        requireResourceAccess('catalog'),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const category = await opts.categoryRepo.findById(id);
      if (!category) {
        return reply.status(404).send({ error: 'Category not found' });
      }
      return CategoryResponseSchema.parse({
        id: category.id,
        restaurantId: category.restaurantId,
        name: category.name,
        description: category.description,
        sortOrder: category.sortOrder,
        isActive: category.isActive,
        createdAt: category.createdAt.toISOString(),
        updatedAt: category.updatedAt.toISOString(),
      });
    },
  );

  // PATCH /api/catalog/categories/:id
  app.patch(
    '/categories/:id',
    {
      preHandler: [
        requirePermission(Permission.CATALOG_MANAGE),
        requireResourceAccess('catalog'),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = UpdateCategorySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.format() });
      }

      const result = await updateCategoryUseCase.execute({
        categoryId: id,
        name: parsed.data.name,
        description: parsed.data.description,
        sortOrder: parsed.data.sortOrder,
      });

      if (!result.success) {
        return reply.status(400).send({ error: result.error.message });
      }

      return CategoryResponseSchema.parse({
        id: result.value.id,
        restaurantId: result.value.restaurantId,
        name: result.value.name,
        description: result.value.description,
        sortOrder: result.value.sortOrder,
        isActive: result.value.isActive,
        createdAt: result.value.createdAt.toISOString(),
        updatedAt: result.value.updatedAt.toISOString(),
      });
    },
  );

  // === PRODUCTS ===

  // POST /api/catalog/products
  app.post(
    '/products',
    {
      preHandler: [
        requirePermission(Permission.CATALOG_MANAGE),
        validateRestaurantAccess(),
      ],
    },
    async (request, reply) => {
      const parsed = CreateProductSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.format() });
      }

      const result = await createProductUseCase.execute({
        id: parsed.data.id ?? randomUUID(),
        restaurantId: parsed.data.restaurantId,
        categoryId: parsed.data.categoryId,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        price: parsed.data.price,
        imageUrl: parsed.data.imageUrl ?? null,
      });

      if (!result.success) {
        return reply.status(400).send({ error: result.error.message });
      }

      return reply.status(201).send(
        ProductResponseSchema.parse({
          id: result.value.id,
          restaurantId: result.value.restaurantId,
          categoryId: result.value.categoryId,
          name: result.value.name,
          description: result.value.description,
          price: result.value.price,
          imageUrl: result.value.imageUrl,
          isAvailable: result.value.isAvailable,
          createdAt: result.value.createdAt.toISOString(),
          updatedAt: result.value.updatedAt.toISOString(),
        }),
      );
    },
  );

  // GET /api/catalog/products?restaurantId=...&categoryId=...&available=...
  app.get(
    '/products',
    {
      preHandler: [
        requirePermission(Permission.CATALOG_READ),
        validateRestaurantAccess(),
      ],
    },
    async (request, reply) => {
      const { restaurantId, categoryId, available } = request.query as {
        restaurantId?: string;
        categoryId?: string;
        available?: string;
      };

      if (!restaurantId) {
        return reply.status(400).send({ error: 'restaurantId query param is required' });
      }

      let products;
      if (available === 'true') {
        products = await opts.productRepo.findAvailableByRestaurantId(restaurantId);
      } else {
        products = await opts.productRepo.findByRestaurantId(restaurantId);
      }

      if (categoryId) {
        products = products.filter((p) => p.categoryId === categoryId);
      }

      return products.map((p) =>
        ProductResponseSchema.parse({
          id: p.id,
          restaurantId: p.restaurantId,
          categoryId: p.categoryId,
          name: p.name,
          description: p.description,
          price: p.price,
          imageUrl: p.imageUrl,
          isAvailable: p.isAvailable,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
        }),
      );
    },
  );

  // GET /api/catalog/products/:id
  app.get(
    '/products/:id',
    {
      preHandler: [
        requirePermission(Permission.CATALOG_READ),
        requireResourceAccess('catalog'),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const product = await opts.productRepo.findById(id);
      if (!product) {
        return reply.status(404).send({ error: 'Product not found' });
      }
      return ProductResponseSchema.parse({
        id: product.id,
        restaurantId: product.restaurantId,
        categoryId: product.categoryId,
        name: product.name,
        description: product.description,
        price: product.price,
        imageUrl: product.imageUrl,
        isAvailable: product.isAvailable,
        createdAt: product.createdAt.toISOString(),
        updatedAt: product.updatedAt.toISOString(),
      });
    },
  );

  // PATCH /api/catalog/products/:id
  app.patch(
    '/products/:id',
    {
      preHandler: [
        requirePermission(Permission.CATALOG_MANAGE),
        requireResourceAccess('catalog'),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = UpdateProductSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.format() });
      }

      const result = await updateProductUseCase.execute({
        productId: id,
        name: parsed.data.name,
        description: parsed.data.description,
        price: parsed.data.price,
        imageUrl: parsed.data.imageUrl,
        categoryId: parsed.data.categoryId,
      });

      if (!result.success) {
        return reply.status(400).send({ error: result.error.message });
      }

      return ProductResponseSchema.parse({
        id: result.value.id,
        restaurantId: result.value.restaurantId,
        categoryId: result.value.categoryId,
        name: result.value.name,
        description: result.value.description,
        price: result.value.price,
        imageUrl: result.value.imageUrl,
        isAvailable: result.value.isAvailable,
        createdAt: result.value.createdAt.toISOString(),
        updatedAt: result.value.updatedAt.toISOString(),
      });
    },
  );

  // PATCH /api/catalog/products/:id/availability
  app.patch(
    '/products/:id/availability',
    {
      preHandler: [
        requirePermission(Permission.CATALOG_MANAGE),
        requireResourceAccess('catalog'),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = ChangeAvailabilitySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.format() });
      }

      const result = await changeAvailabilityUseCase.execute({
        productId: id,
        available: parsed.data.available,
      });

      if (!result.success) {
        return reply.status(400).send({ error: result.error.message });
      }

      return ProductResponseSchema.parse({
        id: result.value.id,
        restaurantId: result.value.restaurantId,
        categoryId: result.value.categoryId,
        name: result.value.name,
        description: result.value.description,
        price: result.value.price,
        imageUrl: result.value.imageUrl,
        isAvailable: result.value.isAvailable,
        createdAt: result.value.createdAt.toISOString(),
        updatedAt: result.value.updatedAt.toISOString(),
      });
    },
  );
}
