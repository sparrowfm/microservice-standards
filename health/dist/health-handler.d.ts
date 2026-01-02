import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { HealthCheckConfig } from './types';
/**
 * Create a health check handler
 */
export declare function createHealthHandler(config: HealthCheckConfig): (event: APIGatewayProxyEvent, context: Context) => Promise<APIGatewayProxyResult>;
