import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ServiceConfig } from '../config';

export interface YourServiceStackProps extends cdk.StackProps {
  environment: string;
  config: ServiceConfig;
}

export class YourServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: YourServiceStackProps) {
    super(scope, id, props);

    const { environment, config } = props;

    // Example: DynamoDB Table
    const table = new cdk.aws_dynamodb.Table(this, 'Table', {
      tableName: `your-service-${environment}`,
      partitionKey: { name: 'id', type: cdk.aws_dynamodb.AttributeType.STRING },
      billingMode: cdk.aws_dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: environment === 'prod'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
    });

    // Example: SQS Queue
    const dlq = new cdk.aws_sqs.Queue(this, 'DeadLetterQueue', {
      queueName: `your-service-dlq-${environment}`,
      messageRetentionPeriod: cdk.Duration.days(14),
    });

    const queue = new cdk.aws_sqs.Queue(this, 'Queue', {
      queueName: `your-service-queue-${environment}`,
      visibilityTimeout: cdk.Duration.seconds(config.queue.visibilityTimeout),
      messageRetentionPeriod: cdk.Duration.seconds(config.queue.messageRetentionPeriod),
      deadLetterQueue: {
        queue: dlq,
        maxReceiveCount: config.queue.maxReceiveCount,
      },
    });

    // Example: Lambda Function
    const lambda = new cdk.aws_lambda.Function(this, 'Lambda', {
      functionName: `YourServiceStack-${environment}-Lambda`,
      runtime: cdk.aws_lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: cdk.aws_lambda.Code.fromAsset('dist/lambdas/worker'),
      timeout: cdk.Duration.seconds(config.lambdas.timeout),
      memorySize: config.lambdas.memorySize,
      reservedConcurrentExecutions: config.lambdas.reservedConcurrency,
      environment: {
        TABLE_NAME: table.tableName,
        QUEUE_URL: queue.queueUrl,
        ENVIRONMENT: environment,
      },
      logRetention: config.monitoring.logRetentionDays,
    });

    // Grant permissions
    table.grantReadWriteData(lambda);
    queue.grantConsumeMessages(lambda);

    // Add SQS event source
    lambda.addEventSource(new cdk.aws_lambda_event_sources.SqsEventSource(queue, {
      batchSize: 10,
      maxBatchingWindow: cdk.Duration.seconds(5),
    }));

    // Example: API Gateway
    const api = new cdk.aws_apigateway.RestApi(this, 'Api', {
      restApiName: `your-service-${environment}`,
      defaultCorsPreflightOptions: {
        allowOrigins: cdk.aws_apigateway.Cors.ALL_ORIGINS,
        allowMethods: cdk.aws_apigateway.Cors.ALL_METHODS,
      },
      deployOptions: {
        stageName: environment,
        throttleSettings: {
          rateLimit: config.api.throttle.rateLimit,
          burstLimit: config.api.throttle.burstLimit,
        },
      },
    });

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API Gateway URL',
    });

    new cdk.CfnOutput(this, 'QueueUrl', {
      value: queue.queueUrl,
      description: 'SQS Queue URL',
    });
  }
}