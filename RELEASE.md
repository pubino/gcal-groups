# Chrome Web Store Release Automation

This document describes the complete setup process for automating releases to the Chrome Web Store via GitHub Actions.

## Overview

The CI/CD pipeline includes:
- **test.yml** - Runs tests and security audit on every push/PR
- **package.yml** - Creates distributable .zip and signed .crx on tagged releases
- **publish.yml** - Uploads to Chrome Web Store when a GitHub Release is created

## Initial Setup (One-Time)

### Step 1: Generate CRX Signing Key

Generate a private key for signing your extension releases:

**Option A - Using Chrome:**
1. Open `chrome://extensions`
2. Enable "Developer mode" (top right)
3. Click "Pack extension"
4. Browse to your extension folder
5. Leave "Private key file" empty (first time only)
6. Click "Pack Extension"

This creates:
- `extension.crx` - Can be deleted
- `extension.pem` - **Your private key (keep safe!)**

**Option B - Using OpenSSL:**
```bash
openssl genrsa -out gcal-groups.pem 2048
```

### Step 2: Extract Public Key

Extract and commit the public key for transparency (users can verify releases):

```bash
openssl rsa -in gcal-groups.pem -pubout -out gcal-groups-public-key.pem
git add gcal-groups-public-key.pem
git commit -m "Add public key for CRX signature verification"
```

### Step 3: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (e.g., `gcal-groups`)
3. Go to **APIs & Services → Library**
4. Search for **Chrome Web Store API** and **Enable** it

### Step 4: Configure OAuth Consent Screen

1. Go to **APIs & Services → OAuth consent screen**
2. Select **External** user type
3. Fill in required fields:
   - App name: Your extension name
   - User support email: Your email
   - Developer contact: Your email
4. Click **Save and Continue** through remaining steps
5. Add yourself as a test user

### Step 5: Create OAuth Credentials

1. Go to **APIs & Services → Credentials**
2. Click **+ CREATE CREDENTIALS → OAuth client ID**
3. Application type: **Web application**
4. Name: `gcal-groups-ci` (or similar)
5. Under "Authorized redirect URIs", add: `http://localhost:8080`
6. Click **Create**
7. Save the **Client ID** and **Client Secret**

### Step 6: Generate Refresh Token

1. Visit this URL (replace `YOUR_CLIENT_ID`):
   ```
   https://accounts.google.com/o/oauth2/auth?response_type=code&scope=https://www.googleapis.com/auth/chromewebstore&client_id=YOUR_CLIENT_ID&redirect_uri=http://localhost:8080
   ```

2. Approve access in the consent screen

3. You'll be redirected to `http://localhost:8080/?code=AUTH_CODE...`
   - The page will show "connection refused" (that's expected)
   - Copy the `code` value from the URL (everything between `code=` and `&scope`)

4. Exchange for refresh token (run as single line):
   ```bash
   curl -X POST "https://oauth2.googleapis.com/token" -d "client_id=YOUR_CLIENT_ID" -d "client_secret=YOUR_CLIENT_SECRET" -d "code=AUTH_CODE" -d "grant_type=authorization_code" -d "redirect_uri=http://localhost:8080"
   ```

5. Save the `refresh_token` from the JSON response

### Step 7: Initial Chrome Web Store Upload

The first upload must be done manually to get an Extension ID:

1. Package your extension:
   ```bash
   npm run package
   ```

2. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)

3. Click **New Item** and upload the ZIP from `dist/`

4. Fill in required store listing information:
   - Description
   - Screenshots
   - Privacy policy (if required)
   - Permission justifications

5. **Save as draft** (or submit for review)

6. Copy your **Extension ID** (32-character string from the dashboard URL or item details)

### Step 8: Configure GitHub Secrets

Go to your repository's **Settings → Secrets and variables → Actions** and add:

| Secret Name | Description |
|-------------|-------------|
| `CHROME_EXTENSION_PEM` | Entire contents of your `.pem` private key file |
| `CHROME_EXTENSION_ID` | 32-character extension ID from Chrome Web Store |
| `CHROME_CLIENT_ID` | OAuth client ID (ends with `.apps.googleusercontent.com`) |
| `CHROME_CLIENT_SECRET` | OAuth client secret |
| `CHROME_REFRESH_TOKEN` | Refresh token from Step 6 |

## Creating Releases

### Automated Release Process

1. Update version in `manifest.json`
2. Commit and push changes
3. Create and push a git tag:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
4. Create a GitHub Release:
   - Go to **Releases → Create new release**
   - Select your tag
   - Add release notes
   - Click **Publish release**

This triggers:
- `package.yml` - Creates ZIP and signed CRX, uploads as release artifacts
- `publish.yml` - Uploads to Chrome Web Store

### Manual Release Process

If you prefer not to auto-publish:

1. Run the package workflow manually or via tag
2. Download the ZIP from GitHub Release artifacts
3. Upload manually to Chrome Web Store Developer Dashboard

## Release Checklist

Before each release:

- [ ] Update version in `manifest.json`
- [ ] Run tests locally: `npm test`
- [ ] Run security audit: `npm run test:security`
- [ ] Test extension manually in Chrome
- [ ] Commit all changes
- [ ] Create and push git tag
- [ ] Create GitHub Release

## Version Strategy

- **Patch** (1.0.1): Bug fixes
- **Minor** (1.1.0): New features
- **Major** (2.0.0): Breaking changes

Always update `manifest.json` version before creating a release tag.

## CRX Signing for Provenance

The GitHub release includes a signed `.crx` file that users can verify came from you.

### Why Sign Releases?

- Chrome Web Store re-signs extensions with Google's key
- The signed `.crx` in GitHub releases uses YOUR key
- Users can verify the release is authentic by comparing public keys

### How Users Verify Releases

1. **Compare extension IDs** - ID in `chrome://extensions` should match published ID
2. **Extract public key from CRX**:
   ```bash
   npx crx-util info gcal-groups.crx
   ```
3. **Compare with repo** - Check against `gcal-groups-public-key.pem` in the repository

## Troubleshooting

### Upload fails with 401
- Refresh token may have expired - regenerate it (repeat Step 6)
- Verify Chrome Web Store API is enabled in Google Cloud Console

### Upload succeeds but publish fails with 400
- **First submission**: Requires manual review in Developer Dashboard
- **Incomplete listing**: Fill in all required fields (description, screenshots, etc.)
- **Policy violations**: Check Developer Dashboard for specific issues

### Tests fail in CI
- Check Node.js version compatibility
- Review security audit results for false positives

### CRX signing skipped
- Verify `CHROME_EXTENSION_PEM` secret is set
- Check the secret contains the full PEM file including headers

### "invalid_grant" when getting refresh token
- Authorization codes expire quickly - get a fresh code and retry immediately

## Permission Justifications

When submitting to Chrome Web Store, you'll need to justify permissions:

### activeTab
> This extension requires activeTab to interact with the Google Calendar page (calendar.google.com) to read available calendars and toggle their visibility when users switch between calendar groups. It only operates on calendar.google.com as specified in content_scripts matches.

### storage
> Used to persist user-created calendar groups and their settings across browser sessions.

---

# Firefox Add-ons (AMO) Release Automation

This section describes how to publish to Firefox Add-ons (addons.mozilla.org).

## Overview

The Firefox workflow (`publish-firefox.yml`) runs alongside Chrome publishing when a GitHub Release is created.

## Initial Setup (One-Time)

### Step 1: Create Mozilla Developer Account

1. Go to [Firefox Add-on Developer Hub](https://addons.mozilla.org/developers/)
2. Sign in or create a Firefox account
3. Accept the developer agreement

### Step 2: Initial Manual Upload

Like Chrome, the first upload must be done manually:

1. Go to [Submit a New Add-on](https://addons.mozilla.org/developers/addon/submit/)
2. Choose **On this site** for distribution
3. Upload your extension ZIP:
   ```bash
   npm install -g web-ext
   web-ext build --source-dir . --artifacts-dir dist
   ```
4. Fill in listing information:
   - Name, summary, description
   - Categories
   - Screenshots
   - Support email/website
5. Submit for review

### Step 3: Generate API Credentials

1. Go to [Manage API Keys](https://addons.mozilla.org/developers/addon/api/key/)
2. Generate new credentials
3. Save:
   - **JWT issuer** (API Key)
   - **JWT secret** (API Secret)

### Step 4: Configure GitHub Secrets

Add to your repository secrets:

| Secret Name | Description |
|-------------|-------------|
| `FIREFOX_API_KEY` | JWT issuer from AMO |
| `FIREFOX_API_SECRET` | JWT secret from AMO |

## Creating Releases

When you create a GitHub Release:
- Chrome workflow uploads to Chrome Web Store
- Firefox workflow uploads to Firefox Add-ons

Both use the same source code and version from `manifest.json`.

## Firefox-Specific Manifest

The manifest includes Firefox-specific settings:

```json
"browser_specific_settings": {
  "gecko": {
    "id": "gcal-groups@pubino.github.io",
    "strict_min_version": "109.0"
  }
}
```

- **id**: Unique identifier (email format or UUID)
- **strict_min_version**: 109.0 for Manifest V3 support

Chrome ignores this field, so it's safe to include.

## Differences from Chrome

| Feature | Chrome | Firefox |
|---------|--------|---------|
| Store | Chrome Web Store | Firefox Add-ons (AMO) |
| Manifest | V3 | V3 (109+) |
| API namespace | `chrome.*` | `chrome.*` or `browser.*` |
| Review time | Usually 1-3 days | Usually 1-2 days |
| Auto-publish | After first review | After first review |

## Troubleshooting

### "Add-on ID not found"
- Ensure `browser_specific_settings.gecko.id` matches what's registered on AMO
- First submission must be manual

### Signing fails
- API credentials may be invalid or expired
- Regenerate at AMO API Keys page

### Review rejected
- Check AMO reviewer comments
- Common issues: missing privacy policy, unclear permissions

## Permission Justifications for Firefox

Firefox also requires permission justifications. Use similar text as Chrome:

### activeTab
> Required to read and toggle calendar checkboxes on calendar.google.com when users switch between calendar groups.

### storage
> Persists user-created calendar groups across sessions.

## Resources

- [Firefox Add-on Developer Hub](https://addons.mozilla.org/developers/)
- [AMO API Documentation](https://addons-server.readthedocs.io/)
- [web-ext Documentation](https://extensionworkshop.com/documentation/develop/web-ext-command-reference/)
- [Extension Workshop](https://extensionworkshop.com/)

---

# Chrome Web Store Resources

- [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
- [Chrome Web Store API Documentation](https://developer.chrome.com/docs/webstore/api/)
- [chrome-extension-upload GitHub Action](https://github.com/mnao305/chrome-extension-upload)
- [Extension Packaging Documentation](https://developer.chrome.com/docs/extensions/how-to/distribute/host-on-linux)
