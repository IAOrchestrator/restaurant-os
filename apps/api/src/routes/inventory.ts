import { FastifyPluginAsync } from 'fastify';
import {
  GetRawMaterialsUseCase,
  CreateRawMaterialUseCase,
  UpdateRawMaterialStockUseCase,
  ManageRecipeUseCase,
} from '@restaurant-os/application';
import {
  PrismaRawMaterialRepository,
  PrismaRecipeRepository,
} from '@restaurant-os/infrastructure';

export const inventoryRoutes: FastifyPluginAsync = async (fastify) => {
  const rawMaterialRepo = new PrismaRawMaterialRepository();
  const recipeRepo = new PrismaRecipeRepository();

  const getRawMaterials = new GetRawMaterialsUseCase(rawMaterialRepo);
  const createRawMaterial = new CreateRawMaterialUseCase(rawMaterialRepo);
  const updateStock = new UpdateRawMaterialStockUseCase(rawMaterialRepo);
  const manageRecipe = new ManageRecipeUseCase(recipeRepo);

  // List Raw Materials
  fastify.get('/raw-materials', async (request, reply) => {
    const { restaurantId } = request.query as { restaurantId?: string };
    if (!restaurantId) {
      return reply.status(400).send({ error: 'restaurantId is required' });
    }
    const list = await getRawMaterials.execute(restaurantId);
    return reply.send(list);
  });

  // Create Raw Material
  fastify.post('/raw-materials', async (request, reply) => {
    const body = request.body as any;
    if (!body?.restaurantId || !body?.name) {
      return reply.status(400).send({ error: 'restaurantId and name are required' });
    }

    try {
      const created = await createRawMaterial.execute({
        restaurantId: body.restaurantId,
        name: body.name,
        unit: body.unit || 'UNIT',
        currentStock: Number(body.currentStock || 0),
        minStockAlert: Number(body.minStockAlert || 0),
        unitCost: Number(body.unitCost || 0),
      });
      return reply.status(201).send(created);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // Update Stock (adjustment: positive = restock, negative = loss/deduction)
  fastify.patch('/raw-materials/:id/stock', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { adjustment } = request.body as { adjustment: number };

    if (adjustment === undefined) {
      return reply.status(400).send({ error: 'adjustment is required' });
    }

    try {
      const updated = await updateStock.execute({ id, adjustment: Number(adjustment) });
      return reply.send(updated);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // Get Recipe for Product
  fastify.get('/recipes/:productId', async (request, reply) => {
    const { productId } = request.params as { productId: string };
    const recipe = await manageRecipe.getRecipe(productId);
    return reply.send(recipe || { productId, ingredients: [] });
  });

  // Set/Update Recipe for Product
  fastify.post('/recipes/:productId', async (request, reply) => {
    const { productId } = request.params as { productId: string };
    const { ingredients } = request.body as { ingredients: any[] };

    if (!ingredients) {
      return reply.status(400).send({ error: 'ingredients array is required' });
    }

    try {
      const saved = await manageRecipe.setRecipe({
        productId,
        ingredients: ingredients.map((i) => ({
          rawMaterialId: i.rawMaterialId,
          quantity: Number(i.quantity),
        })),
      });
      return reply.send(saved);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });
};
