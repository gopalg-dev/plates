# Testing a UI change at every viewport

Read this when a change touches anything on screen.

## Viewports

| Width | Device | Input |
|---|---|---|
| 360 | small phone | touch |
| 393 | phone | touch |
| 768 | tablet (the drawer turns into a dialog here) | touch |
| 1024 | laptop | mouse |
| 1440 | desktop | mouse |

## What to check at each

- Layout: nothing clipped, overlapping or misaligned; no sideways scroll on the page or in a row.
- Targets: taps and clicks land where they should; touch targets are thumb-sized.
- Focus: the right element has it, its ring is not clipped, and typing keeps it.
- Drawers and dialogs: open, scroll, close, and their footers stay on screen.
- With an input: the on-screen keyboard up (phones). The drawer must sit above it with the footer
  in view, and a swipe must scroll, not close it.
- The console stays free of errors.

## How

- Drive a real Chrome with Playwright from a script in the scratchpad, not in the repo: its own
  `vite dev` on a spare port, its own Mongo database (dropped afterwards), a fresh account.
- Touch: `isMobile` and `hasTouch` on the context. Swipes go through CDP
  `Input.dispatchTouchEvent`; `Input.synthesizeScrollGesture` does not scroll here.
- Keyboard: no browser can show one in automation. Fake it by overriding `visualViewport.height`
  (and `offsetTop` for a panned page), then dispatch `resize` on `window.visualViewport`. On
  Android, Chrome's autofill bar also covers about 30px the visual viewport does not report.
- Measure, do not eyeball only: bounding boxes, `document.activeElement`, computed styles.
  Take screenshots too and look at them.
- Then run the e2e suite, `bun run test:e2e`, which covers phone, tablet and desktop.
