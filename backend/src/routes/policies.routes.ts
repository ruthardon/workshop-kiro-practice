import { Router } from 'express';
import * as controller from '../controllers/policies.controller';

const router = Router();

/**
 * @openapi
 * /api/policies:
 *   get:
 *     tags: [Policies]
 *     summary: Lista las pólizas (datos personales enmascarados)
 *     responses:
 *       200:
 *         description: Lista de pólizas
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Policy'
 */
router.get('/', controller.list);

/**
 * @openapi
 * /api/policies/{id}:
 *   get:
 *     tags: [Policies]
 *     summary: Obtiene el detalle de una póliza
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Detalle de la póliza
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Policy'
 *       400:
 *         description: Id inválido
 *       404:
 *         description: Póliza no encontrada
 */
router.get('/:id', controller.getById);

export default router;
