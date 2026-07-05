
export { color, background, text, icon, primary, border, surface, status, input } from './colors';
export { fontFamily, fontSize, fontWeight, lineHeight, letterSpacing, typography } from './typography';
export { spacing } from './spacing';
export { borderRadius } from './borderRadius';
export { shadows } from './shadows';
export { avatarPalette, getAvatarColor } from './avatarPalette';

import * as colors from './colors';
import * as typography from './typography';
import { spacing } from './spacing';
import { borderRadius } from './borderRadius';
import { shadows } from './shadows';

export const theme = {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
};

export default theme;
