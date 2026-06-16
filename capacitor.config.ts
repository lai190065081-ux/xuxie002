import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.example.novelwriter',
  appName: 'Novel Writer',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
