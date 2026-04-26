import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Osapiens API',
            version: '1.0.0',
            description: 'Asynchronous geospatial workflow processing service',
        },
        servers: [{ url: 'http://localhost:3000', description: 'Local development' }],
        components: {
            schemas: {
                WorkflowStatus: {
                    type: 'string',
                    enum: ['initial', 'in_progress', 'completed', 'failed'],
                },
                TaskStatus: {
                    type: 'string',
                    enum: ['queued', 'in_progress', 'completed', 'failed'],
                },
            },
        },
    },
    apis: ['./src/routes/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
