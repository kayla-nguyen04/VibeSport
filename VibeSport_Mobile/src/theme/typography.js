
export const fontFamily = {
  primary: 'Roboto',
};

export const fontSize = {
  caption2: 11,
  caption: 12,
  bodySmall: 13,
  body: 14,
  bodyLarge: 15,
  subtitle: 16,
  title: 18,
  heading: 20,
  display: 30,
  hero: 32,
};

export const fontWeight = {
  light: 300,
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
};

export const lineHeight = {
  caption2: 12.89,
  caption: 14.06,
  bodySmall: 15.23,
  body: 16.41,
  bodyLarge: 17.58,
  subtitle: 18.75,
  title: 21.09,
  heading: 23.44,
  display: 35.16,
  hero: 40.10,
};

export const letterSpacing = {
  DEFAULT: 0,
};

export const typography = {
  caption2: {
    fontSize: 11,
    fontWeight: 400,
    lineHeight: 12.89,
    letterSpacing: 0,
    variants: {
      bold: { fontWeight: 700 },
    },
  },
  caption: {
    fontSize: 12,
    fontWeight: 700,
    lineHeight: 14.06,
    letterSpacing: 0,
    variants: {
      regular: { fontWeight: 400, count: 7 },
      semibold: { fontWeight: 600, count: 3 },
      medium: { fontWeight: 500, count: 1 },
    },
  },
  bodySmall: {
    fontSize: 13,
    fontWeight: 400,
    lineHeight: 15.23,
    letterSpacing: 0,
    variants: {
      semibold: { fontWeight: 600, count: 86 },
      light: { fontWeight: 300, count: 50 },
      medium: { fontWeight: 500, count: 14 },
      bold: { fontWeight: 700, count: 5 },
    },
  },
  body: {
    fontSize: 14,
    fontWeight: 400,
    lineHeight: 16.41,
    letterSpacing: 0,
  },
  bodyLarge: {
    fontSize: 15,
    fontWeight: 500,
    lineHeight: 17.58,
    letterSpacing: 0,
    variants: {
      semibold: { fontWeight: 600, count: 15 },
      bold: { fontWeight: 700, count: 13 },
      regular: { fontWeight: 400, count: 9 },
    },
  },
  subtitle: {
    fontSize: 16,
    fontWeight: 700,
    lineHeight: 18.75,
    letterSpacing: 0,
    variants: {
      medium: { fontWeight: 500, count: 7 },
      regular: { fontWeight: 400, count: 5 },
      light: { fontWeight: 300, count: 1 },
    },
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    lineHeight: 21.09,
    letterSpacing: 0,
    variants: {
      regular: { fontWeight: 400, count: 1 },
    },
  },
  heading: {
    fontSize: 20,
    fontWeight: 700,
    lineHeight: 23.44,
    letterSpacing: 0,
    variants: {
      regular: { fontWeight: 400, count: 5 },
      medium: { fontWeight: 500, count: 3 },
      semibold: { fontWeight: 600, count: 3 },
    },
  },
  display: {
    fontSize: 30,
    fontWeight: 700,
    lineHeight: 35.16,
    letterSpacing: 0,
  },
  hero: {
    fontSize: 32,
    fontWeight: 400,
    lineHeight: 40.10,
    letterSpacing: 0,
  },
};
