import path from 'path';
import swaggerJsdoc from 'swagger-jsdoc';

const routesDir = path.join(__dirname, '..', 'routes');

export const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'ClaimShield API',
      version: '1.0.0',
      description: 'API de gestión de siniestros y reclamaciones de seguros.',
    },
    servers: [{ url: 'http://localhost:3000', description: 'Local' }],
    components: {
      schemas: {
        ApiError: {
          type: 'object',
          properties: {
            code: { type: 'string', example: 'CLAIM_NOT_FOUND' },
            message: { type: 'string', example: 'Siniestro no encontrado' },
            details: { type: 'object', nullable: true },
          },
        },
        ApiResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { nullable: true },
            error: { allOf: [{ $ref: '#/components/schemas/ApiError' }], nullable: true },
          },
        },
        Policy: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            policy_number: { type: 'string', example: 'POL-2025-000123' },
            holder_name: { type: 'string', example: 'María Fernanda Ortiz' },
            national_id: { type: 'string', example: '1012345678' },
            phone: { type: 'string', example: '+57 300 123 4567' },
            email: { type: 'string', example: 'maria.ortiz@example.com' },
            status: { type: 'string', enum: ['ACTIVE', 'EXPIRED'] },
            start_date: { type: 'string', format: 'date' },
            end_date: { type: 'string', format: 'date' },
            deductible: { type: 'string', example: '250.00' },
            coverage_limit: { type: 'string', example: '20000.00' },
          },
        },
        Claim: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            policy_id: { type: 'integer', example: 1 },
            policy_number: { type: 'string', example: '***-**-0123' },
            holder_name: { type: 'string' },
            description: { type: 'string' },
            incident_date: { type: 'string', format: 'date' },
            claimed_amount: { type: 'string', example: '1800.00' },
            indemnity_amount: { type: 'string', example: '1550.00' },
            status: { type: 'string', enum: ['OPEN', 'APPROVED', 'REJECTED', 'CLOSED'] },
            closed_at: { type: 'string', format: 'date-time', nullable: true },
            reopen_count: { type: 'integer', example: 0 },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        CreateClaimRequest: {
          type: 'object',
          required: ['policy_id', 'description', 'incident_date', 'claimed_amount'],
          properties: {
            policy_id: { type: 'integer', example: 1 },
            description: { type: 'string', example: 'Choque lateral en intersección' },
            incident_date: { type: 'string', format: 'date', example: '2025-10-01' },
            claimed_amount: { type: 'number', example: 1200.5 },
          },
        },
        ClaimStats: {
          type: 'object',
          properties: {
            total: { type: 'integer', example: 8 },
            open: { type: 'integer', example: 3 },
            reserved_amount: { type: 'string', example: '15950.00' },
          },
        },
      },
    },
  },
  apis: [path.join(routesDir, '*.ts'), path.join(routesDir, '*.js')],
});
