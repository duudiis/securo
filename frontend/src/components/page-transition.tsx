import { useState } from 'react'
import { useLocation, useOutlet } from 'react-router-dom'

/**
 * Page transition: quick fade-out of the outgoing page, then a slide-up
 * entrance of the incoming one.
 *
 * The page on screen (`shown`) lags the router during the fade-out: while the
 * pathname differs we keep rendering the held outlet with `.page-leave` (fade
 * out); when that animation ends we swap to the current outlet, which mounts
 * fresh (key change) and plays `.page-enter` (slide up + fade in). Everything
 * animates the live DOM, so a skeleton→data swap underneath never jumps
 * (unlike a frozen-snapshot crossfade). Only pathname changes transition;
 * query-param changes (filters, month) render in place with no animation.
 */
export function PageTransition() {
  const location = useLocation()
  const outlet = useOutlet()
  const [shown, setShown] = useState({ outlet, pathname: location.pathname })
  const leaving = location.pathname !== shown.pathname

  return (
    <div
      key={shown.pathname}
      className={leaving ? 'page-leave' : 'page-enter'}
      onAnimationEnd={(e) => {
        // Ignore bubbled animations from descendants (skeleton pulses, etc.).
        if (e.target !== e.currentTarget) return
        if (leaving) setShown({ outlet, pathname: location.pathname })
      }}
    >
      {shown.outlet}
    </div>
  )
}
