/**
 * Dynamic favicon: the Securo shell logo tinted with the active theme's
 * primary color (mirrors the sidebar logo, which uses text-primary).
 */

const LOGO_PATHS = [
  'M2125 4149 c-222 -23 -430 -97 -652 -232 -66 -40 -103 -68 -103 -79 0 -9 19 -59 41 -110 197 -446 465 -1250 614 -1845 61 -242 56 -233 -140 252 -299 743 -439 1057 -601 1355 -132 242 -116 226 -200 210 -95 -18 -242 -94 -335 -173 -91 -78 -219 -246 -219 -287 0 -11 364 -501 695 -935 75 -99 202 -265 281 -370 79 -104 200 -264 269 -355 69 -90 125 -168 125 -172 0 -10 -239 236 -405 417 -70 77 -172 187 -225 245 -102 111 -597 675 -764 870 -54 63 -101 116 -106 118 -19 7 -147 -149 -188 -231 -69 -137 -83 -193 -89 -352 -5 -137 -5 -143 24 -227 69 -198 189 -332 419 -462 128 -74 473 -256 889 -470 94 -49 289 -150 435 -226 336 -175 381 -189 500 -154 29 8 193 89 364 178 171 90 435 227 586 306 607 316 773 409 857 481 118 101 213 247 249 379 25 94 23 270 -5 375 -33 126 -102 255 -178 336 l-66 70 -30 -28 c-38 -36 -176 -191 -477 -538 -283 -326 -309 -355 -576 -649 -251 -276 -410 -443 -418 -435 -5 5 65 102 260 354 158 206 589 774 936 1235 l176 235 -30 57 c-97 182 -323 356 -529 405 l-71 17 -19 -23 c-33 -41 -190 -338 -282 -535 -121 -259 -232 -522 -433 -1025 -93 -233 -170 -417 -172 -408 -4 18 107 434 219 827 89 308 250 766 403 1143 31 76 56 142 56 148 0 13 -149 108 -245 156 -262 131 -547 182 -840 152z',
  'M949 1318 c-28 -94 -31 -206 -6 -270 53 -136 217 -187 567 -174 239 8 470 29 457 42 -7 7 -985 474 -993 474 -2 0 -13 -33 -25 -72z',
  'M3280 1227 c-185 -89 -406 -196 -492 -237 -106 -50 -151 -77 -140 -81 85 -30 681 -46 782 -20 160 40 232 126 233 277 0 67 -29 225 -42 223 -3 0 -157 -73 -341 -162z',
]

let cleaned = false

/** Point the favicon at an inline SVG of the logo in the given color. */
export function updateFavicon(color: string): void {
  const fill = color.trim()
  if (!fill) return

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 460 460">` +
    `<g transform="translate(0,460) scale(0.1,-0.1)" fill="${fill}">` +
    LOGO_PATHS.map((d) => `<path d="${d}"/>`).join('') +
    `</g></svg>`
  const href = `data:image/svg+xml,${encodeURIComponent(svg)}`

  // Static PNG/ICO links from index.html would compete with the dynamic one —
  // drop them once.
  if (!cleaned) {
    document
      .querySelectorAll('link[rel="icon"]:not(#favicon-dynamic)')
      .forEach((el) => el.remove())
    cleaned = true
  }

  let link = document.getElementById('favicon-dynamic') as HTMLLinkElement | null
  if (!link) {
    link = document.createElement('link')
    link.id = 'favicon-dynamic'
    link.rel = 'icon'
    link.type = 'image/svg+xml'
    document.head.appendChild(link)
  }
  link.href = href
}

/** Read the active --primary value and apply it to the favicon. */
export function syncFaviconToTheme(): void {
  const primary = getComputedStyle(document.documentElement).getPropertyValue('--primary')
  updateFavicon(primary)
}
