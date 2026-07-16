// This script dynamically generates all Android launcher icons and splash screen resources from SVG definitions at build time.
// This prevents Git binary/text transfer corruption and ensures valid 32-bit RGBA PNG files.

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const RES_DIR = path.join(__dirname, 'android', 'app', 'src', 'main', 'res');

// Configurations for Launcher Icons
const ICON_CONFIGS = [
  { dir: 'mipmap-mdpi', iconSize: 48, foregroundSize: 108 },
  { dir: 'mipmap-hdpi', iconSize: 72, foregroundSize: 162 },
  { dir: 'mipmap-xhdpi', iconSize: 96, foregroundSize: 216 },
  { dir: 'mipmap-xxhdpi', iconSize: 144, foregroundSize: 324 },
  { dir: 'mipmap-xxxhdpi', iconSize: 192, foregroundSize: 432 }
];

// Configurations for Splash Screens
const SPLASH_CONFIGS = [
  { dir: 'drawable', width: 480, height: 800 },
  { dir: 'drawable-land-mdpi', width: 480, height: 320 },
  { dir: 'drawable-land-hdpi', width: 800, height: 480 },
  { dir: 'drawable-land-xhdpi', width: 1280, height: 720 },
  { dir: 'drawable-land-xxhdpi', width: 1920, height: 1080 },
  { dir: 'drawable-land-xxxhdpi', width: 2560, height: 1440 },
  { dir: 'drawable-port-mdpi', width: 320, height: 480 },
  { dir: 'drawable-port-hdpi', width: 480, height: 800 },
  { dir: 'drawable-port-xhdpi', width: 720, height: 1280 },
  { dir: 'drawable-port-xxhdpi', width: 1080, height: 1920 },
  { dir: 'drawable-port-xxxhdpi', width: 1440, height: 2560 }
];

// SVG Definitions
const getLegacyIconSVG = () => `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#120c24"/>
      <stop offset="50%" stop-color="#310c5c"/>
      <stop offset="100%" stop-color="#640969"/>
    </linearGradient>
    <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ff2e93"/>
      <stop offset="50%" stop-color="#ff7a00"/>
      <stop offset="100%" stop-color="#ff0055"/>
    </linearGradient>
    <linearGradient id="accent-grad" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#00f0ff"/>
      <stop offset="100%" stop-color="#7000ff"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#000000" flood-opacity="0.5"/>
    </filter>
  </defs>
  <rect x="16" y="16" width="480" height="480" rx="100" fill="url(#bg-grad)" stroke="#ff2e93" stroke-width="8"/>
  <g filter="url(#shadow)" transform="translate(0, 0)">
    <circle cx="256" cy="256" r="140" fill="none" stroke="url(#accent-grad)" stroke-width="12" stroke-dasharray="10 15 50 15" stroke-linecap="round"/>
    <path d="M210 166 L350 256 L210 346 Z" fill="url(#logo-grad)" stroke="#ffffff" stroke-width="4" stroke-linejoin="round"/>
    <path d="M380 200 A 80 80 0 0 1 380 312" fill="none" stroke="url(#accent-grad)" stroke-width="8" stroke-linecap="round"/>
    <path d="M410 170 A 120 120 0 0 1 410 342" fill="none" stroke="url(#logo-grad)" stroke-width="6" stroke-linecap="round"/>
  </g>
</svg>
`;

const getLegacyRoundIconSVG = () => `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#120c24"/>
      <stop offset="50%" stop-color="#310c5c"/>
      <stop offset="100%" stop-color="#640969"/>
    </linearGradient>
    <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ff2e93"/>
      <stop offset="50%" stop-color="#ff7a00"/>
      <stop offset="100%" stop-color="#ff0055"/>
    </linearGradient>
    <linearGradient id="accent-grad" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#00f0ff"/>
      <stop offset="100%" stop-color="#7000ff"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#000000" flood-opacity="0.5"/>
    </filter>
  </defs>
  <circle cx="256" cy="256" r="240" fill="url(#bg-grad)" stroke="#ff2e93" stroke-width="8"/>
  <g filter="url(#shadow)">
    <circle cx="256" cy="256" r="140" fill="none" stroke="url(#accent-grad)" stroke-width="12" stroke-dasharray="10 15 50 15" stroke-linecap="round"/>
    <path d="M210 166 L350 256 L210 346 Z" fill="url(#logo-grad)" stroke="#ffffff" stroke-width="4" stroke-linejoin="round"/>
    <path d="M380 200 A 80 80 0 0 1 380 312" fill="none" stroke="url(#accent-grad)" stroke-width="8" stroke-linecap="round"/>
    <path d="M410 170 A 120 120 0 0 1 410 342" fill="none" stroke="url(#logo-grad)" stroke-width="6" stroke-linecap="round"/>
  </g>
</svg>
`;

const getAdaptiveForegroundSVG = () => `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ff2e93"/>
      <stop offset="50%" stop-color="#ff7a00"/>
      <stop offset="100%" stop-color="#ff0055"/>
    </linearGradient>
    <linearGradient id="accent-grad" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#00f0ff"/>
      <stop offset="70%" stop-color="#7000ff"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#000000" flood-opacity="0.5"/>
    </filter>
  </defs>
  <g filter="url(#shadow)" transform="scale(0.65) translate(138, 138)">
    <circle cx="256" cy="256" r="140" fill="none" stroke="url(#accent-grad)" stroke-width="12" stroke-dasharray="10 15 50 15" stroke-linecap="round"/>
    <path d="M210 166 L350 256 L210 346 Z" fill="url(#logo-grad)" stroke="#ffffff" stroke-width="4" stroke-linejoin="round"/>
    <path d="M380 200 A 80 80 0 0 1 380 312" fill="none" stroke="url(#accent-grad)" stroke-width="8" stroke-linecap="round"/>
    <path d="M410 170 A 120 120 0 0 1 410 342" fill="none" stroke="url(#logo-grad)" stroke-width="6" stroke-linecap="round"/>
  </g>
</svg>
`;

const getSplashSVG = (width, height) => {
  const scale = 0.5;
  const tx = width / 2 - 256 * scale;
  const ty = height / 2 - 256 * scale;

  return `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#120c24"/>
      <stop offset="50%" stop-color="#310c5c"/>
      <stop offset="100%" stop-color="#640969"/>
    </linearGradient>
    <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ff2e93"/>
      <stop offset="50%" stop-color="#ff7a00"/>
      <stop offset="100%" stop-color="#ff0055"/>
    </linearGradient>
    <linearGradient id="accent-grad" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#00f0ff"/>
      <stop offset="100%" stop-color="#7000ff"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#000000" flood-opacity="0.5"/>
    </filter>
  </defs>
  <rect x="0" y="0" width="${width}" height="${height}" fill="url(#bg-grad)"/>
  <g filter="url(#shadow)" transform="translate(${tx}, ${ty}) scale(${scale})">
    <circle cx="256" cy="256" r="140" fill="none" stroke="url(#accent-grad)" stroke-width="12" stroke-dasharray="10 15 50 15" stroke-linecap="round"/>
    <path d="M210 166 L350 256 L210 346 Z" fill="url(#logo-grad)" stroke="#ffffff" stroke-width="4" stroke-linejoin="round"/>
    <path d="M380 200 A 80 80 0 0 1 380 312" fill="none" stroke="url(#accent-grad)" stroke-width="8" stroke-linecap="round"/>
    <path d="M410 170 A 120 120 0 0 1 410 342" fill="none" stroke="url(#logo-grad)" stroke-width="6" stroke-linecap="round"/>
  </g>
</svg>
`;
};

async function execute() {
  console.log('------------------------------------------------------------');
  console.log('🎨 Starting Android Resource Generation Process... 🎨');
  console.log('------------------------------------------------------------');

  const legacySVG = Buffer.from(getLegacyIconSVG());
  const roundSVG = Buffer.from(getLegacyRoundIconSVG());
  const foregroundSVG = Buffer.from(getAdaptiveForegroundSVG());

  // 1. Generate Launcher Icons
  console.log('\nGenerating Android Launcher Icons (mipmap):');
  for (const config of ICON_CONFIGS) {
    const dirPath = path.join(RES_DIR, config.dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    const launcherPath = path.join(dirPath, 'ic_launcher.png');
    await sharp(legacySVG)
      .resize(config.iconSize, config.iconSize)
      .png({ palette: false, quality: 100 })
      .toFile(launcherPath);
    console.log(` ✅ Saved 32-bit: ${launcherPath} (${config.iconSize}x${config.iconSize})`);

    const roundPath = path.join(dirPath, 'ic_launcher_round.png');
    await sharp(roundSVG)
      .resize(config.iconSize, config.iconSize)
      .png({ palette: false, quality: 100 })
      .toFile(roundPath);
    console.log(` ✅ Saved 32-bit: ${roundPath} (${config.iconSize}x${config.iconSize})`);

    const foregroundPath = path.join(dirPath, 'ic_launcher_foreground.png');
    await sharp(foregroundSVG)
      .resize(config.foregroundSize, config.foregroundSize)
      .png({ palette: false, quality: 100 })
      .toFile(foregroundPath);
    console.log(` ✅ Saved 32-bit: ${foregroundPath} (${config.foregroundSize}x${config.foregroundSize})`);
  }

  // 2. Generate Splash Screens
  console.log('\nGenerating Android Splash Screens (drawable):');
  for (const config of SPLASH_CONFIGS) {
    const dirPath = path.join(RES_DIR, config.dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    const svgString = getSplashSVG(config.width, config.height);
    const svgBuffer = Buffer.from(svgString);

    const splashPath = path.join(dirPath, 'splash.png');
    await sharp(svgBuffer)
      .resize(config.width, config.height)
      .png({ palette: false, quality: 100 })
      .toFile(splashPath);
    console.log(` ✅ Saved 32-bit: ${splashPath} (${config.width}x${config.height})`);
  }

  console.log('\n------------------------------------------------------------');
  console.log('🎉 All Android Resources Generated Successfully! 🎉');
  console.log('------------------------------------------------------------');
}

execute().catch(err => {
  console.error('❌ Error during generation:', err);
  process.exit(1);
});
