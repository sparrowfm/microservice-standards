#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { YourServiceStack } from './lib/your-service-stack';
import { getConfig } from './config';

const app = new cdk.App();

const environment = app.node.tryGetContext('environment') || 'dev';
const config = getConfig(environment);

new YourServiceStack(app, `YourServiceStack-${environment}`, {
  env: {
    account: config.aws.accountId,
    region: config.aws.region,
  },
  environment,
  config,
});