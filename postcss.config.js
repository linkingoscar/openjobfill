import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

// Content-script styles live in a Shadow DOM, but `rem` still resolves against
// the host page's <html> font-size. Some recruitment sites deliberately use a
// very large root font-size for responsive layouts, which used to scale the
// whole OpenJobFill widget with it. Resolve rem values at build time so the
// extension keeps the same physical size on every host page.
const openjobfillRemToPx = () => ({
  postcssPlugin: 'openjobfill-rem-to-px',
  Declaration(declaration) {
    declaration.value = declaration.value.replace(
      /(-?(?:\d+|\d*\.\d+))rem\b/g,
      (_, value) => `${Number((Number(value) * 16).toFixed(4))}px`,
    );
  },
  AtRule(atRule) {
    atRule.params = atRule.params.replace(
      /(-?(?:\d+|\d*\.\d+))rem\b/g,
      (_, value) => `${Number((Number(value) * 16).toFixed(4))}px`,
    );
  },
});

openjobfillRemToPx.postcss = true;

export default {
  plugins: [tailwindcss(), openjobfillRemToPx(), autoprefixer()],
};
