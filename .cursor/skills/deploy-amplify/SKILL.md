---
name: deploy-amplify
description: Build the UPTIME game and publish it to the existing Amplify Hosting app. Use only when the user explicitly invokes /deploy-amplify.
disable-model-invocation: true
---

# Deploy to Amplify

Invoking this command is permission to build and publish the current code. Do not ask for confirmation first. Do not commit or push unless the user also asked for that.

The app is the CloudFormation stack `uptime-amplify` in `us-east-2`. Do not create a second Amplify app. Do not change git config, the AWS account, or the region.

## Steps

1. Run `scripts/deploy-amplify.sh` with full permissions so the AWS CLI can reach the account.
2. If tests or the build fail, stop and report the error. Do not upload a failed build.
3. Reply with whether the deploy succeeded and the live URL printed by the script (`https://main.<id>.amplifyapp.com`).
