#!/usr/bin/env bash
# Build the static game and publish that build to the existing Amplify app.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REGION="${AWS_REGION:-us-east-2}"
STACK="uptime-amplify"
BRANCH="main"

echo "Running simulator tests"
npm run test:sim

echo "Building the static site"
npm run build

echo "Ensuring the Amplify app exists"
aws cloudformation deploy \
  --template-file infra/amplify.yaml \
  --stack-name "$STACK" \
  --region "$REGION" \
  --no-fail-on-empty-changeset

APP_ID="$(aws cloudformation describe-stacks \
  --stack-name "$STACK" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='AppId'].OutputValue" \
  --output text)"
SITE_URL="$(aws cloudformation describe-stacks \
  --stack-name "$STACK" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='Url'].OutputValue" \
  --output text)"

ZIP="$(mktemp -t uptime-amplify).zip"
trap 'rm -f "$ZIP"' EXIT
(cd dist && zip -qr "$ZIP" .)

echo "Uploading the build"
DEPLOY_JSON="$(aws amplify create-deployment \
  --app-id "$APP_ID" \
  --branch-name "$BRANCH" \
  --region "$REGION" \
  --output json)"
JOB_ID="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["jobId"])' <<<"$DEPLOY_JSON")"
UPLOAD_URL="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["zipUploadUrl"])' <<<"$DEPLOY_JSON")"
curl --fail --silent --show-error \
  --request PUT \
  --header "Content-Type: application/zip" \
  --upload-file "$ZIP" \
  "$UPLOAD_URL"

aws amplify start-deployment \
  --app-id "$APP_ID" \
  --branch-name "$BRANCH" \
  --job-id "$JOB_ID" \
  --region "$REGION" \
  --output text >/dev/null

echo "Waiting for Amplify job $JOB_ID"
for _ in $(seq 1 60); do
  STATUS="$(aws amplify get-job \
    --app-id "$APP_ID" \
    --branch-name "$BRANCH" \
    --job-id "$JOB_ID" \
    --region "$REGION" \
    --query 'job.summary.status' \
    --output text)"
  echo "  $STATUS"
  case "$STATUS" in
    SUCCEED) break ;;
    FAILED|CANCELLED)
      echo "Amplify deployment failed" >&2
      exit 1
      ;;
  esac
  sleep 5
done

if [[ "$STATUS" != "SUCCEED" ]]; then
  echo "Amplify deployment did not finish" >&2
  exit 1
fi

echo "Live at $SITE_URL"
