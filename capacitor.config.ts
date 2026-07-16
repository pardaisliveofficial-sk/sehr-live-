import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sehrlive.app',
  appName: 'Sehr Live',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
