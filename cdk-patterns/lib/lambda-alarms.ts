/**
 * Lambda Alarms Factory - Standardized CloudWatch alarms for all Aviary services
 *
 * Created: CHI-267 - Add CloudWatch alarms to all Lambda functions
 *
 * Alarms per Lambda:
 * - Errors: Error rate > 5% for 2 consecutive 1-min periods
 * - Duration: p99 latency > threshold for 2 consecutive periods
 * - Throttles: Any throttles (> 0)
 * - DLQ: Dead letter queue messages > 0 (for async Lambdas)
 */

import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

/**
 * Minimal interface for Lambda functions - compatible across CDK versions
 */
export interface ILambdaMetrics {
  functionName: string;
  metricErrors: (props?: cloudwatch.MetricOptions) => cloudwatch.Metric;
  metricInvocations: (props?: cloudwatch.MetricOptions) => cloudwatch.Metric;
  metricDuration: (props?: cloudwatch.MetricOptions) => cloudwatch.Metric;
  metricThrottles: (props?: cloudwatch.MetricOptions) => cloudwatch.Metric;
}

export interface LambdaAlarmsProps {
  /**
   * The Lambda function to monitor.
   * Uses structural typing for cross-CDK-version compatibility.
   */
  lambdaFunction: ILambdaMetrics;

  /**
   * Service name for alarm naming (e.g., 'nightingale', 'condor')
   */
  serviceName: string;

  /**
   * Environment (dev, staging, prod)
   */
  environment: string;

  /**
   * SNS topic for alarm notifications (optional - alarms still created without it)
   */
  alarmTopic?: sns.ITopic;

  /**
   * Dead letter queue to monitor (optional - for async Lambdas)
   */
  deadLetterQueue?: sqs.IQueue;

  /**
   * Duration threshold in seconds (default: 10s for p99)
   */
  durationThresholdSeconds?: number;

  /**
   * Error rate threshold as percentage (default: 5%)
   */
  errorRateThresholdPercent?: number;

  /**
   * Whether to treat missing data as not breaching (default: true)
   * Set to false for critical production services
   */
  treatMissingDataAsNotBreaching?: boolean;
}

export class LambdaAlarms extends Construct {
  public readonly errorAlarm: cloudwatch.Alarm;
  public readonly durationAlarm: cloudwatch.Alarm;
  public readonly throttleAlarm: cloudwatch.Alarm;
  public readonly dlqAlarm?: cloudwatch.Alarm;

  constructor(scope: Construct, id: string, props: LambdaAlarmsProps) {
    super(scope, id);

    const {
      lambdaFunction,
      serviceName,
      environment,
      alarmTopic,
      deadLetterQueue,
      durationThresholdSeconds = 10,
      errorRateThresholdPercent = 5,
      treatMissingDataAsNotBreaching = true,
    } = props;

    const alarmNamePrefix = `${serviceName}-${environment}`;
    const treatMissingData = treatMissingDataAsNotBreaching
      ? cloudwatch.TreatMissingData.NOT_BREACHING
      : cloudwatch.TreatMissingData.BREACHING;

    // ========== Error Rate Alarm ==========
    // Uses math expression: (Errors / Invocations) * 100 > threshold
    const errorMetric = lambdaFunction.metricErrors({
      period: cdk.Duration.minutes(1),
      statistic: 'Sum',
    });

    const invocationMetric = lambdaFunction.metricInvocations({
      period: cdk.Duration.minutes(1),
      statistic: 'Sum',
    });

    const errorRateExpression = new cloudwatch.MathExpression({
      expression: '(errors / invocations) * 100',
      usingMetrics: {
        errors: errorMetric,
        invocations: invocationMetric,
      },
      period: cdk.Duration.minutes(1),
      label: 'Error Rate %',
    });

    this.errorAlarm = new cloudwatch.Alarm(this, 'ErrorRateAlarm', {
      alarmName: `${alarmNamePrefix}-${lambdaFunction.functionName}-error-rate`,
      alarmDescription: `Lambda ${lambdaFunction.functionName} error rate > ${errorRateThresholdPercent}%`,
      metric: errorRateExpression,
      threshold: errorRateThresholdPercent,
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData,
    });

    // ========== Duration Alarm ==========
    // p99 latency > threshold
    this.durationAlarm = new cloudwatch.Alarm(this, 'DurationAlarm', {
      alarmName: `${alarmNamePrefix}-${lambdaFunction.functionName}-duration-p99`,
      alarmDescription: `Lambda ${lambdaFunction.functionName} p99 duration > ${durationThresholdSeconds}s`,
      metric: lambdaFunction.metricDuration({
        period: cdk.Duration.minutes(1),
        statistic: 'p99',
      }),
      threshold: durationThresholdSeconds * 1000, // Convert to milliseconds
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData,
    });

    // ========== Throttle Alarm ==========
    // Any throttles (> 0)
    this.throttleAlarm = new cloudwatch.Alarm(this, 'ThrottleAlarm', {
      alarmName: `${alarmNamePrefix}-${lambdaFunction.functionName}-throttles`,
      alarmDescription: `Lambda ${lambdaFunction.functionName} is being throttled`,
      metric: lambdaFunction.metricThrottles({
        period: cdk.Duration.minutes(1),
        statistic: 'Sum',
      }),
      threshold: 0,
      evaluationPeriods: 1,
      datapointsToAlarm: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData,
    });

    // ========== DLQ Alarm (optional) ==========
    if (deadLetterQueue) {
      this.dlqAlarm = new cloudwatch.Alarm(this, 'DLQAlarm', {
        alarmName: `${alarmNamePrefix}-${lambdaFunction.functionName}-dlq`,
        alarmDescription: `Lambda ${lambdaFunction.functionName} has messages in DLQ`,
        metric: deadLetterQueue.metricApproximateNumberOfMessagesVisible({
          period: cdk.Duration.minutes(1),
          statistic: 'Sum',
        }),
        threshold: 0,
        evaluationPeriods: 1,
        datapointsToAlarm: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData,
      });
    }

    // ========== SNS Actions (optional) ==========
    if (alarmTopic) {
      const snsAction = new cloudwatch_actions.SnsAction(alarmTopic);

      this.errorAlarm.addAlarmAction(snsAction);
      this.errorAlarm.addOkAction(snsAction);

      this.durationAlarm.addAlarmAction(snsAction);
      this.durationAlarm.addOkAction(snsAction);

      this.throttleAlarm.addAlarmAction(snsAction);
      this.throttleAlarm.addOkAction(snsAction);

      if (this.dlqAlarm) {
        this.dlqAlarm.addAlarmAction(snsAction);
        this.dlqAlarm.addOkAction(snsAction);
      }
    }
  }
}

/**
 * Props for creating a shared alarm topic
 */
export interface AlarmTopicProps {
  /**
   * Service name for topic naming
   */
  serviceName: string;

  /**
   * Environment (dev, staging, prod)
   */
  environment: string;

  /**
   * Email addresses to subscribe to alarms (optional)
   */
  emailAddresses?: string[];
}

/**
 * Create a shared SNS topic for alarm notifications
 */
export function createAlarmTopic(
  scope: Construct,
  id: string,
  props: AlarmTopicProps
): sns.Topic {
  const { serviceName, environment } = props;

  const topic = new sns.Topic(scope, id, {
    topicName: `${serviceName}-alarms-${environment}`,
    displayName: `${serviceName} ${environment} Alarms`,
  });

  // Email subscriptions can be added manually or via CDK
  // Note: Email subscriptions require confirmation
  if (props.emailAddresses) {
    for (const email of props.emailAddresses) {
      new sns.Subscription(scope, `${id}-${email.replace('@', '-at-')}`, {
        topic,
        protocol: sns.SubscriptionProtocol.EMAIL,
        endpoint: email,
      });
    }
  }

  return topic;
}
