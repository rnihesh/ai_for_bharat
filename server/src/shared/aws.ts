// AWS SDK Configuration
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';

const AWS_REGION = process.env.AWS_REGION || 'ap-south-1';

// --- DynamoDB ---
let dynamoClient: DynamoDBClient;
let docClient: DynamoDBDocumentClient;

function initDynamoDB(): DynamoDBDocumentClient {
  if (!docClient) {
    dynamoClient = new DynamoDBClient({ region: AWS_REGION });
    docClient = DynamoDBDocumentClient.from(dynamoClient, {
      marshallOptions: {
        removeUndefinedValues: true,
        convertClassInstanceToMap: true,
      },
      unmarshallOptions: {
        wrapNumbers: false,
      },
    });
    console.log('✅ DynamoDB client initialized');
  }
  return docClient;
}

export function getDocClient(): DynamoDBDocumentClient {
  return initDynamoDB();
}

export function getDynamoClient(): DynamoDBClient {
  if (!dynamoClient) {
    initDynamoDB();
  }
  return dynamoClient;
}

// --- S3 ---
let s3Client: S3Client;

export function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({ region: AWS_REGION });
    console.log('✅ S3 client initialized');
  }
  return s3Client;
}

// --- Cognito ---
let cognitoClient: CognitoIdentityProviderClient;

export function getCognitoClient(): CognitoIdentityProviderClient {
  if (!cognitoClient) {
    cognitoClient = new CognitoIdentityProviderClient({ region: AWS_REGION });
    console.log('✅ Cognito client initialized');
  }
  return cognitoClient;
}

// --- Bedrock ---
let bedrockClient: BedrockRuntimeClient;

export function getBedrockClient(): BedrockRuntimeClient {
  if (!bedrockClient) {
    const bedrockRegion = process.env.BEDROCK_REGION || AWS_REGION;
    bedrockClient = new BedrockRuntimeClient({ region: bedrockRegion });
    console.log('✅ Bedrock client initialized');
  }
  return bedrockClient;
}

// --- Configuration ---
export const AWS_CONFIG = {
  region: AWS_REGION,
  s3Bucket: process.env.S3_BUCKET_NAME || 'civiclemma-uploads',
  cloudfrontDomain: process.env.CLOUDFRONT_DOMAIN || '',
  cognitoUserPoolId: process.env.COGNITO_USER_POOL_ID || '',
  cognitoClientId: process.env.COGNITO_CLIENT_ID || '',
  bedrockModelId: process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-haiku-20240307-v1:0',
} as const;

// --- Table name helpers ---
const TABLE_PREFIX = process.env.DYNAMODB_TABLE_PREFIX || 'civiclemma_';

export const TABLES = {
  ISSUES: `${TABLE_PREFIX}issues`,
  MUNICIPALITIES: `${TABLE_PREFIX}municipalities`,
  USERS: `${TABLE_PREFIX}users`,
  SCORE_HISTORY: `${TABLE_PREFIX}score_history`,
  VERIFICATIONS: `${TABLE_PREFIX}verifications`,
  MUNICIPALITY_REGISTRATIONS: `${TABLE_PREFIX}municipality_registrations`,
  LOCATION_STATS: `${TABLE_PREFIX}location_stats`,
} as const;

// --- GSI Names ---
export const GSI = {
  // Issues GSIs
  ISSUES_BY_MUNICIPALITY: 'gsi-municipalityId-createdAt',
  ISSUES_BY_STATUS: 'gsi-status-createdAt',
  ISSUES_BY_TYPE: 'gsi-type-createdAt',
  ISSUES_BY_CREATED: 'gsi-createdAt',
  ISSUES_BY_LAT: 'gsi-latitude',

  // Municipalities GSIs
  MUNICIPALITIES_BY_SCORE: 'gsi-score',
  MUNICIPALITIES_BY_NAME: 'gsi-name',

  // Municipality Registrations GSIs
  REGISTRATIONS_BY_STATUS: 'gsi-status-createdAt',
  REGISTRATIONS_BY_USER: 'gsi-userId-status',

  // Users GSIs
  USERS_BY_ROLE: 'gsi-role-createdAt',
} as const;

// --- Helper types for DynamoDB timestamps ---
export interface DynamoTimestamp {
  iso: string;
  epoch: number;
}

export function toTimestamp(date: Date = new Date()): DynamoTimestamp {
  return {
    iso: date.toISOString(),
    epoch: date.getTime(),
  };
}

export function fromTimestamp(ts: DynamoTimestamp | string): Date {
  if (typeof ts === 'string') {
    return new Date(ts);
  }
  return new Date(ts.iso || ts.epoch);
}

// AWS regions
export const AWS_REGIONS = {
  AP_SOUTH_1: 'ap-south-1',   // Mumbai
  AP_SOUTHEAST_1: 'ap-southeast-1', // Singapore
  US_EAST_1: 'us-east-1',     // N. Virginia
} as const;

export const DEFAULT_REGION = AWS_REGIONS.AP_SOUTH_1;
