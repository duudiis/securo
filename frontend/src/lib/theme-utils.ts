export function setThemeBasedOnSystem(lightColor: string | null, darkColor: string | null, resolvedTheme?: string) {
  const root = document.documentElement
  const isDark = resolvedTheme === 'dark'

  const themeColor = isDark 
    ? darkColor
    : lightColor

  if (themeColor) {
    root.style.setProperty('--primary', themeColor)
    root.style.setProperty('--ring', themeColor)
    root.style.setProperty('--sidebar-primary', themeColor)

    const contrastBase = isDark ? 'white' : 'black'

    // Dark mode mixes toward a dark GRAY base, not pure black: black-based
    // mixes landed below the card/popover surface lightness, making the
    // accent highlight (menu selection, hovers, "today" chip) nearly
    // invisible. The gray bases sit at the neutral theme's accent/muted
    // lightness, so the tinted result is always a visible step lighter.
    const accentBg = isDark
      ? `color-mix(in srgb, ${themeColor} 24%, #2E2E32)`
      : `color-mix(in srgb, ${themeColor}, white 90%)`
    const mutedBg = isDark
      ? `color-mix(in srgb, ${themeColor} 10%, #2A2A2A)`
      : `color-mix(in srgb, ${themeColor}, white 94%)`
    root.style.setProperty('--accent', accentBg)
    root.style.setProperty('--sidebar-accent', accentBg)
    root.style.setProperty('--muted', mutedBg)

    const accentFg = `color-mix(in srgb, ${themeColor}, ${contrastBase} 20%)`
    root.style.setProperty('--accent-foreground', accentFg)
    root.style.setProperty('--sidebar-accent-foreground', accentFg)
  } else {
    root.style.removeProperty('--primary')
    root.style.removeProperty('--ring')
    root.style.removeProperty('--sidebar-primary')
    root.style.removeProperty('--accent')
    root.style.removeProperty('--accent-foreground')
    root.style.removeProperty('--muted')
    root.style.removeProperty('--sidebar-accent')
    root.style.removeProperty('--sidebar-accent-foreground')
  }
}