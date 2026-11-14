import { StyleSheet } from 'react-native';
export const colors = { bg: '#F6F7F9', surface: '#FFFFFF', ink: '#17212E', muted: '#657182', line: '#E4E8EE', inputLine: '#7B8797', accent: '#23664E', pale: '#E8F3ED', danger: '#AC3535' };
export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { padding: 22, gap: 18, paddingBottom: 32 },
  eyebrow: { color: colors.accent, fontSize: 12, fontWeight: '700', letterSpacing: 2 },
  title: { color: colors.ink, fontSize: 32, fontWeight: '800', letterSpacing: -1 },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 23 },
  section: { color: colors.ink, fontSize: 18, fontWeight: '700' },
  card: { padding: 20, borderRadius: 20, backgroundColor: colors.surface, gap: 12, borderWidth: 1, borderColor: colors.line },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  grow: { flex: 1, gap: 6 },
  input: { padding: 14, borderWidth: 1, borderColor: colors.inputLine, borderRadius: 12, backgroundColor: colors.surface, color: colors.ink, fontSize: 16, minHeight: 50 },
  label: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  button: { backgroundColor: colors.accent, borderRadius: 14, padding: 15, minHeight: 50, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: 'white', fontSize: 15, fontWeight: '700' },
  secondary: { backgroundColor: colors.pale },
  secondaryText: { color: colors.accent },
  disabled: { opacity: .45 },
  danger: { color: colors.danger },
  pill: { color: colors.accent, backgroundColor: colors.pale, fontSize: 12, fontWeight: '600', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 7, alignSelf: 'flex-start' },
  small: { color: colors.muted, fontSize: 12, lineHeight: 19 },
});
