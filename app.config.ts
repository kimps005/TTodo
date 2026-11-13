import type { ConfigContext, ExpoConfig } from 'expo/config';
export default ({ config }: ConfigContext): ExpoConfig => {
  const bundle = process.env.TTODO_BUNDLE_ID ?? 'com.kimps005.ttodo';
  const group = `group.${bundle}`;
  return {
    ...config,
    name: 'TTodo', slug: 'ttodo', scheme: 'ttodo', version: '1.0.0',
    userInterfaceStyle: 'light',
    ios: { ...config.ios, supportsTablet: false, bundleIdentifier: bundle, entitlements: { 'com.apple.security.application-groups': [group] } },
    plugins: [
      'expo-sqlite',
      'expo-sharing',
      ['expo-image-picker', { photosPermission: '선택한 사진에서 할 일에 필요한 글자를 읽어요.', cameraPermission: false, microphonePermission: false }],
      ['expo-build-properties', { ios: { deploymentTarget: '18.0' } }],
      './plugins/with-ttodo-ios',
    ],
    extra: {
      eas: {
        ...(process.env.EXPO_PROJECT_ID ? { projectId: process.env.EXPO_PROJECT_ID } : {}),
        build: { experimental: { ios: { appExtensions: [{ targetName: 'TTodoWidgets', bundleIdentifier: `${bundle}.widgets`, entitlements: { 'com.apple.security.application-groups': [group] } }] } } },
      },
    },
  };
};
