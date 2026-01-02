import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { DynamoDBClient, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';
import { SQSClient, GetQueueAttributesCommand } from '@aws-sdk/client-sqs';
import {
  HealthCheckConfig,
  HealthCheckResponse,
  DependencyStatus,
  HealthCheckDependency,
} from './types';

const startTime = Date.now();

/**
 * Check DynamoDB table health
 */
async function checkDynamoDBTable(
  tableName: string,
  region: string
): Promise<{ healthy: boolean; error?: string; responseTime: number }> {
  const start = Date.now();
  try {
    const client = new DynamoDBClient({ region });
    const command = new DescribeTableCommand({ TableName: tableName });
    const response = await client.send(command);
    const responseTime = Date.now() - start;

    if (response.Table?.TableStatus === 'ACTIVE') {
      return { healthy: true, responseTime };
    }
    return {
      healthy: false,
      error: `Table status: ${response.Table?.TableStatus}`,
      responseTime,
    };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Date.now() - start,
    };
  }
}

/**
 * Check S3 bucket health
 */
async function checkS3Bucket(
  bucketName: string,
  region: string
): Promise<{ healthy: boolean; error?: string; responseTime: number }> {
  const start = Date.now();
  try {
    const client = new S3Client({ region });
    const command = new HeadBucketCommand({ Bucket: bucketName });
    await client.send(command);
    return { healthy: true, responseTime: Date.now() - start };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Date.now() - start,
    };
  }
}

/**
 * Check SQS queue health
 */
async function checkSQSQueue(
  queueUrl: string,
  region: string
): Promise<{ healthy: boolean; error?: string; responseTime: number }> {
  const start = Date.now();
  try {
    const client = new SQSClient({ region });
    const command = new GetQueueAttributesCommand({
      QueueUrl: queueUrl,
      AttributeNames: ['QueueArn'],
    });
    await client.send(command);
    return { healthy: true, responseTime: Date.now() - start };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Date.now() - start,
    };
  }
}

/**
 * Check a single dependency
 */
async function checkDependency(
  dep: HealthCheckDependency,
  region: string
): Promise<DependencyStatus> {
  const status: DependencyStatus = {
    name: dep.name,
    type: dep.type,
    status: 'unhealthy',
    resource: dep.resource,
  };

  try {
    let result: { healthy: boolean; error?: string; responseTime: number };

    if (dep.check) {
      // Custom check
      const start = Date.now();
      const healthy = await dep.check();
      result = { healthy, responseTime: Date.now() - start };
    } else if (dep.type === 'dynamodb' && dep.resource) {
      result = await checkDynamoDBTable(dep.resource, region);
    } else if (dep.type === 's3' && dep.resource) {
      result = await checkS3Bucket(dep.resource, region);
    } else if (dep.type === 'sqs' && dep.resource) {
      result = await checkSQSQueue(dep.resource, region);
    } else {
      throw new Error(`Invalid dependency configuration: ${dep.name}`);
    }

    status.status = result.healthy ? 'healthy' : 'unhealthy';
    status.responseTime = result.responseTime;
    if (result.error) {
      status.error = result.error;
    }
  } catch (error) {
    status.status = 'unhealthy';
    status.error = error instanceof Error ? error.message : 'Unknown error';
  }

  return status;
}

/**
 * Create a health check handler
 */
export function createHealthHandler(config: HealthCheckConfig) {
  return async (
    event: APIGatewayProxyEvent,
    context: Context
  ): Promise<APIGatewayProxyResult> => {
    const region = process.env.AWS_REGION || 'us-east-1';
    const uptime = Math.floor((Date.now() - startTime) / 1000);

    const response: HealthCheckResponse = {
      status: 'healthy',
      service: config.serviceName,
      version: config.version || process.env.SERVICE_VERSION,
      gitCommit: config.gitCommit || process.env.GIT_COMMIT,
      environment: config.environment || process.env.ENVIRONMENT,
      deployedAt: config.deployedAt || process.env.DEPLOYED_AT,
      timestamp: new Date().toISOString(),
      uptime,
    };

    // Check dependencies if configured
    if (config.dependencies && config.dependencies.length > 0) {
      const dependencyStatuses = await Promise.all(
        config.dependencies.map((dep) => checkDependency(dep, region))
      );

      response.dependencies = dependencyStatuses;

      // Determine overall health status
      const unhealthyCount = dependencyStatuses.filter(
        (d) => d.status === 'unhealthy'
      ).length;

      if (unhealthyCount === dependencyStatuses.length) {
        response.status = 'unhealthy';
      } else if (unhealthyCount > 0) {
        response.status = 'degraded';
      }
    }

    // Return appropriate HTTP status code
    const httpStatus = response.status === 'unhealthy' ? 503 : 200;

    return {
      statusCode: httpStatus,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
      body: JSON.stringify(response, null, 2),
    };
  };
}
