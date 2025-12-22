/**
 * Notarization Script for macOS
 *
 * This script is called by electron-builder after code signing.
 * It submits the app to Apple's notarization service for verification.
 *
 * Required Environment Variables:
 *   - APPLE_ID: Your Apple Developer account email
 *   - APPLE_APP_SPECIFIC_PASSWORD: App-specific password from appleid.apple.com
 *   - APPLE_TEAM_ID: Your Apple Developer Team ID (10-character string)
 *
 * Optional Environment Variables:
 *   - SKIP_NOTARIZATION: Set to 'true' to skip notarization (for local dev builds)
 *
 * Setup Instructions:
 * 1. Generate an app-specific password at https://appleid.apple.com/account/manage
 * 2. Find your Team ID at https://developer.apple.com/account/#/membership
 * 3. Store credentials securely (use Keychain or CI/CD secrets)
 */

const { notarize } = require('@electron/notarize');
const path = require('path');
const fs = require('fs');

// Load package.json for app metadata
const packageJson = require('../package.json');

/**
 * Validates that required environment variables are set
 * @returns {boolean} True if all required variables are present
 */
function validateEnvironment() {
  const required = ['APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_TEAM_ID'];
  const missing = required.filter(varName => !process.env[varName]);

  if (missing.length > 0) {
    console.log(`[Notarize] Missing required environment variables: ${missing.join(', ')}`);
    console.log('[Notarize] Skipping notarization due to missing credentials');
    return false;
  }

  return true;
}

/**
 * Main notarization function called by electron-builder afterSign hook
 * @param {Object} context - electron-builder context object
 */
async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;

  // Only notarize macOS builds
  if (electronPlatformName !== 'darwin') {
    console.log('[Notarize] Skipping notarization - not a macOS build');
    return;
  }

  // Check if notarization should be skipped
  if (process.env.SKIP_NOTARIZATION === 'true') {
    console.log('[Notarize] Skipping notarization - SKIP_NOTARIZATION is set');
    return;
  }

  // Validate environment variables
  if (!validateEnvironment()) {
    // In CI, missing credentials should fail the build
    if (process.env.CI) {
      throw new Error('Notarization credentials not configured in CI environment');
    }
    return;
  }

  // Construct app path
  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);

  // Verify the app exists
  if (!fs.existsSync(appPath)) {
    throw new Error(`Cannot find application at: ${appPath}`);
  }

  console.log(`[Notarize] Starting notarization for: ${appPath}`);
  console.log(`[Notarize] App ID: com.claude-m.universal-session-viewer`);
  console.log(`[Notarize] Team ID: ${process.env.APPLE_TEAM_ID}`);

  const startTime = Date.now();

  try {
    await notarize({
      // Application path
      appPath: appPath,

      // Apple Developer credentials
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID,

      // Tool selection (notarytool is the modern approach, altool is deprecated)
      tool: 'notarytool',
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Notarize] Successfully notarized application in ${duration}s`);
    console.log('[Notarize] The app is now ready for distribution');

  } catch (error) {
    console.error('[Notarize] Notarization failed:');
    console.error(error);

    // Log helpful debugging information
    console.error('\n[Notarize] Troubleshooting tips:');
    console.error('1. Verify your Apple ID and app-specific password are correct');
    console.error('2. Ensure your Team ID matches your Developer account');
    console.error('3. Check that the app is properly code-signed with hardened runtime');
    console.error('4. Verify entitlements are correctly configured');
    console.error('5. Check Apple Developer System Status: https://developer.apple.com/system-status/');

    // Re-throw to fail the build
    throw error;
  }
}

// Export for electron-builder afterSign hook
module.exports = notarizing;

// Allow running directly for testing
if (require.main === module) {
  console.log('[Notarize] This script is intended to be called by electron-builder');
  console.log('[Notarize] It will be executed automatically during the build process');
  console.log('\nEnvironment check:');

  const vars = ['APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_TEAM_ID'];
  vars.forEach(v => {
    const isSet = !!process.env[v];
    const status = isSet ? 'SET' : 'NOT SET';
    console.log(`  ${v}: ${status}`);
  });
}
