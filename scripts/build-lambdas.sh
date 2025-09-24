#!/bin/bash

# Build Lambda functions with dependencies
set -e

echo "🏗️  Building Lambda functions with dependencies..."

# Clean previous builds
rm -rf dist/lambdas

# Build TypeScript
echo "📦 Compiling TypeScript..."
npm run build

# Create Lambda packages
# Customize this array with your Lambda function names
LAMBDAS=("your-lambda-function")

for lambda in "${LAMBDAS[@]}"; do
    echo "📦 Packaging $lambda lambda..."

    # Create lambda package directory
    mkdir -p "dist/lambdas/$lambda-package"

    # Copy compiled JS file and fix import paths
    cp "dist/lambdas/$lambda/index.js" "dist/lambdas/$lambda-package/index.js.tmp"

    # Fix import paths from ../../lib to ./lib
    sed 's|require("../../lib/|require("./lib/|g' "dist/lambdas/$lambda-package/index.js.tmp" > "dist/lambdas/$lambda-package/index.js"
    rm "dist/lambdas/$lambda-package/index.js.tmp"

    # Copy the lib directory with compiled utilities
    cp -r "dist/lib" "dist/lambdas/$lambda-package/"

    # Create package.json with only production dependencies needed for this lambda
    cat > "dist/lambdas/$lambda-package/package.json" <<EOF
{
  "name": "your-service-$lambda",
  "version": "1.0.0",
  "dependencies": {
    "@aws-sdk/client-dynamodb": "^3.410.0",
    "@aws-sdk/client-s3": "^3.410.0",
    "@aws-sdk/client-secrets-manager": "^3.410.0",
    "@aws-sdk/client-sqs": "^3.410.0",
    "@aws-sdk/lib-dynamodb": "^3.410.0",
    "ulid": "^2.3.0"
  }
}
EOF

    # Install dependencies
    echo "📥 Installing dependencies for $lambda..."
    cd "dist/lambdas/$lambda-package"
    npm install --only=production --no-package-lock
    cd - > /dev/null

    # Replace the original directory
    rm -rf "dist/lambdas/$lambda"
    mv "dist/lambdas/$lambda-package" "dist/lambdas/$lambda"

    echo "✅ $lambda lambda packaged successfully"
done

echo "🎉 All Lambda functions built and packaged!"