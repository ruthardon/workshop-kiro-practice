import { Router } from 'express';
import * as controller from '../controllers/claims.controller';

const router = Router();

/**
 * @openapi
 * /api/claims:
 *   get:
 *     tags: [Claims]
 *     summary: Lista los siniestros
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [OPEN, APPROVED, REJECTED, CLOSED]
 *     responses:
 *       200:
 *         description: Lista de siniestros
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
 *                         $ref: '#/components/schemas/Claim'
 *       400:
 *         description: Estado inválido
 */
router.get('/', controller.list);

/**
 * @openapi
 * /api/claims/stats:
 *   get:
 *     tags: [Claims]
 *     summary: Indicadores (KPIs) de siniestros
 *     responses:
 *       200:
 *         description: Total, abiertos y monto reservado
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/ClaimStats'
 */
router.get('/stats', controller.stats);

/**
 * @openapi
 * /api/claims/{id}:
 *   get:
 *     tags: [Claims]
 *     summary: Obtiene un siniestro por id
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Siniestro encontrado
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Claim'
 *       400:
 *         description: Id inválido
 *       404:
 *         description: Siniestro no encontrado
 */
router.get('/:id', controller.getById);

/**
 * @openapi
 * /api/claims:
 *   post:
 *     tags: [Claims]
 *     summary: Reporta un nuevo siniestro
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateClaimRequest'
 *     responses:
 *       201:
 *         description: Siniestro creado en estado OPEN
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Claim'
 *       400:
 *         description: Datos inválidos (VALIDATION_ERROR). incident_date debe ser una fecha real en formato YYYY-MM-DD, sin hora
 *       404:
 *         description: Póliza no encontrada
 */
router.post('/', controller.create);

/**
 * @openapi
 * /api/claims/{id}/approve:
 *   patch:
 *     tags: [Claims]
 *     summary: Aprueba un siniestro abierto
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Siniestro aprobado
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Claim'
 *       404:
 *         description: Siniestro no encontrado
 *       409:
 *         description: Transición de estado no permitida
 */
router.patch('/:id/approve', controller.approve);

/**
 * @openapi
 * /api/claims/{id}/reject:
 *   patch:
 *     tags: [Claims]
 *     summary: Rechaza un siniestro abierto
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Siniestro rechazado
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Claim'
 *       404:
 *         description: Siniestro no encontrado
 *       409:
 *         description: Transición de estado no permitida
 */
router.patch('/:id/reject', controller.reject);

/**
 * @openapi
 * /api/claims/{id}/legacy-process:
 *   post:
 *     tags: [Claims]
 *     summary: Procesamiento heredado de un siniestro
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               policy_id:
 *                 type: integer
 *               mode:
 *                 type: string
 *                 enum: [FAST, FULL]
 *               amount:
 *                 type: number
 *     responses:
 *       200:
 *         description: Resultado del procesamiento
 *       400:
 *         description: Id inválido
 */
router.post('/:id/legacy-process', controller.legacyProcess);

export default router;
