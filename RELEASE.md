# Chrome Web Store Release Automation

This document describes how to automate releases to the Chrome Web Store when maintaining this extension on GitHub.

## Overview

The CI/CD pipeline includes:
- **test.yml** - Runs tests and security audit on every push/PR
- **package.yml** - Creates a distributable .zip on tagged releases

## Manual Release Process

1. Update version in `manifest.json`
2. Commit changes
3. Create a git tag: `git tag v1.1.0`
4. Push the tag: `git push origin v1.1.0`
5. The CI will create a release with the packaged extension
6. Download the .zip from GitHub Releases
7. Upload to Chrome Web Store Developer Dashboard

## Automated Chrome Web Store Publishing

To fully automate publishing to the Chrome Web Store, add the following workflow:

### 1. Get Chrome Web Store API Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable the **Chrome Web Store API**
4. Create OAuth 2.0 credentials:
   - Go to APIs & Services > Credentials
   - Create OAuth client ID (Desktop app)
   - Download client secret JSON
5. Get a refresh token by running the OAuth flow once locally

### 2. Set Up GitHub Secrets

Add these secrets to your repository (Settings > Secrets > Actions):

- `CHROME_EXTENSION_ID` - Your extension ID from Chrome Web Store
- `CHROME_CLIENT_ID` - OAuth client ID
- `CHROME_CLIENT_SECRET` - OAuth client secret
- `CHROME_REFRESH_TOKEN` - OAuth refresh token

### 3. Add Publish Workflow

Create `.github/workflows/publish.yml`:

```yaml
name: Publish to Chrome Web Store

on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Run tests
        run: npm test

      - name: Run security audit
        run: npm run test:security

      - name: Package extension
        run: npm run package

      - name: Upload to Chrome Web Store
        uses: mnao305/chrome-extension-upload@v5.0.0
        with:
          file-path: dist/*.zip
          extension-id: ${{ secrets.CHROME_EXTENSION_ID }}
          client-id: ${{ secrets.CHROME_CLIENT_ID }}
          client-secret: ${{ secrets.CHROME_CLIENT_SECRET }}
          refresh-token: ${{ secrets.CHROME_REFRESH_TOKEN }}

      - name: Publish extension
        uses: mnao305/chrome-extension-upload@v5.0.0
        with:
          file-path: dist/*.zip
          extension-id: ${{ secrets.CHROME_EXTENSION_ID }}
          client-id: ${{ secrets.CHROME_CLIENT_ID }}
          client-secret: ${{ secrets.CHROME_CLIENT_SECRET }}
          refresh-token: ${{ secrets.CHROME_REFRESH_TOKEN }}
          publish: true
```

## Release Checklist

Before each release:

1. [ ] Update version in `manifest.json`
2. [ ] Update changelog/release notes
3. [ ] Run tests locally: `npm test`
4. [ ] Run security audit: `npm run test:security`
5. [ ] Test extension manually in Chrome
6. [ ] Create and push git tag

## Getting OAuth Refresh Token

To get the refresh token for the first time:

```bash
# Install chrome-webstore-upload-cli
npm install -g chrome-webstore-upload-cli

# Run authentication flow
webstore token --client-id YOUR_CLIENT_ID --client-secret YOUR_CLIENT_SECRET
```

This will open a browser window for OAuth consent. After approving, you'll receive a refresh token to use in CI.

## Version Strategy

- **Patch** (1.0.1): Bug fixes
- **Minor** (1.1.0): New features
- **Major** (2.0.0): Breaking changes

Always update `manifest.json` version before creating a release tag.

## Troubleshooting

### Upload fails with 401
- Refresh token may be expired - regenerate it
- Check that Chrome Web Store API is enabled

### Upload succeeds but publish fails
- Check Chrome Web Store Developer Dashboard for policy violations
- Review requires human approval for first submission

### Tests fail in CI
- Check Node.js version compatibility
- Review security audit results for false positives

## CRX Signing and Private Keys

Chrome extensions use RSA key pairs for identity. The extension ID is derived from the public key.

### For Chrome Web Store Distribution

The Web Store manages signing automatically. You **don't need** to include a `.pem` file in your uploads.

### To Maintain Consistent Extension ID

If you want the same extension ID during development and after publishing:

1. Generate a key pair once:
   ```bash
   # In Chrome: chrome://extensions > Pack extension
   # Or via command line:
   google-chrome --pack-extension=/path/to/gcal-groups
   ```

2. This creates:
   - `gcal-groups.crx` - Signed extension package
   - `gcal-groups.pem` - **Private key (keep secret!)**

3. For first Web Store upload only, include `key.pem` in the root of your ZIP

4. **Never commit the .pem file** - add to `.gitignore`

5. **Extract and publish the public key** for user verification:
   ```bash
   # Extract public key from .pem
   openssl rsa -in gcal-groups.pem -pubout -out public-key.pem

   # Or get base64 key for manifest.json
   openssl rsa -in gcal-groups.pem -pubout -outform DER | base64
   ```

### How Users Verify Your Releases

Users can verify a `.crx` came from you by:

1. **Compare extension IDs** - The ID in `chrome://extensions` should match your published ID
2. **Extract public key from CRX**:
   ```bash
   # Using crx-util or similar tool
   npx crx-util info gcal-groups.crx
   ```
3. **Check against published key** - Compare with public key in your repo/README

### For Self-Distribution (Outside Web Store)

If distributing the extension outside the Web Store:

```bash
google-chrome --pack-extension=/path/to/gcal-groups --pack-extension-key=/path/to/gcal-groups.pem
```

Store the `.pem` file as a GitHub secret (`CHROME_EXTENSION_PEM`) and use it in CI to sign releases.

### GitHub Action for CRX Signing

```yaml
- name: Sign extension
  uses: nickolasburr/chrome-extension-crx-action@v1
  with:
    extension-dir: .
    private-key: ${{ secrets.CHROME_EXTENSION_PEM }}
    output-file: dist/gcal-groups.crx
```

## Resources

- [Chrome Web Store API](https://developer.chrome.com/docs/webstore/api/)
- [chrome-extension-upload Action](https://github.com/mnao305/chrome-extension-upload)
- [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole)
- [Extension Packaging Docs](https://developer.chrome.com/docs/extensions/how-to/distribute/host-on-linux)
