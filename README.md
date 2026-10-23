# Device Screen Shape Editor

A small local web app to draw rectangles with smooth corners, match them to device screens, and copy the result as SVG.

## Features

- **Rectangles with two corner types**
  - **Superellipse** (default): each corner is a quarter of `|x|^n + |y|^n = 1`. Set the exponent `n` and the size (px, or % of the shorter side). The curvature is 0 where the corner meets the straight edge.
  - **Bezier**: one cubic bezier for each corner, with a radius and a tension (0.5523 = circle).
  - Both types can use the same values for all corners, or different values for each corner.
- **Images**: drop, paste, or pick images. Move and resize them, and change their opacity.
- **SVG export**: copy the SVG or the path `d` of the selected rectangle, or the SVG of all shapes.
- **Device corners page** (`#device-corners`): Apple device bezels with a screen rectangle on top. The corners are superellipses fitted to the screen opening in each bezel PNG.
- Undo and redo, zoom and pan, and autosave to the browser's localStorage. Each page has its own saved data.

## Run

```sh
npm install
npm run dev -- --host --port 5199
```

## Files

- `src/geometry.ts`: corner math. Builds the SVG path for both corner types. A superellipse corner is drawn as 8 cubic segments, within 0.15% of the exact curve.
- `src/deviceCorners.ts`: measured screen positions, sizes, and corner values for the Device corners page.
- `src/bezels.ts`: the default bezels on the main canvas.
- `public/bezels/`: bezel PNGs.

## Measured device corners

The values in `src/deviceCorners.ts` come from the screen openings in the bezel PNGs. For each device, one superellipse is fitted to the edge points of all four screen corners. The iPhone Duo outer screen has one value for the left corners and one for the right corners. In every corner, the fitted curve is less than 0.64 PNG px from the PNG edge.

The iPhone 17e has no bezel PNG. Its screen size comes from Apple's specs (2532 × 1170 px, @3x assumed), and its corner is copied from the iPhone 16. It is drawn in orange to show that it is an estimate.

## Bezel images

The bezel PNGs come from [Apple Design Resources](https://developer.apple.com/design/resources/) and are subject to Apple's license terms.
