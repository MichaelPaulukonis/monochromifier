precision highp float;

varying vec2 vTexCoord;

uniform sampler2D uTexImage;
uniform sampler2D uTexPaint;
uniform vec2 uTexSize;
uniform float uThreshold;
uniform int uPatternType; // 0: Dots, 1: Lines, 2: Dither
uniform float uDotSize;   // Size of the grid cell
uniform float uAngle;     // Rotation in radians
uniform bool uInvert;
uniform vec3 uBackgroundColor;
uniform bool uTransparencyMode;
uniform float uTransparencyThreshold;
uniform int uColorMode;       // 0=avg, 1=red, 2=green, 3=blue, 4=luminance, 5=custom
uniform vec3 uChannelWeights; // used when uColorMode == 5

// --- Color-mode helpers ---

float luminance(vec3 color) {
  return dot(color, vec3(0.2126, 0.7152, 0.0722));
}

// Returns the processed color vec3.
// For grayscale modes (1-5) all components are equal.
// For mode 0 (full color pass) returns the original RGB.
vec3 applyColorMode(vec3 color) {
  if (uColorMode == 1) return vec3(color.r);
  if (uColorMode == 2) return vec3(color.g);
  if (uColorMode == 3) return vec3(color.b);
  if (uColorMode == 4) return vec3(luminance(color));
  if (uColorMode == 5) return vec3(dot(color, uChannelWeights));
  return color; // mode 0: full color pass (average used downstream)
}

// 8x8 Bayer Matrix for Ordered Dithering
float bayer8x8(vec2 uv) {
  vec2 pos = mod(uv, 8.0);
  int x = int(pos.x);
  int y = int(pos.y);
  int index = y * 8 + x;

  if (index == 0) return 0.0/64.0; if (index == 1) return 32.0/64.0; if (index == 2) return 8.0/64.0; if (index == 3) return 40.0/64.0;
  if (index == 4) return 2.0/64.0; if (index == 5) return 34.0/64.0; if (index == 6) return 10.0/64.0; if (index == 7) return 42.0/64.0;
  if (index == 8) return 48.0/64.0; if (index == 9) return 16.0/64.0; if (index == 10) return 56.0/64.0; if (index == 11) return 24.0/64.0;
  if (index == 12) return 50.0/64.0; if (index == 13) return 18.0/64.0; if (index == 14) return 58.0/64.0; if (index == 15) return 26.0/64.0;
  if (index == 16) return 12.0/64.0; if (index == 17) return 44.0/64.0; if (index == 18) return 4.0/64.0; if (index == 19) return 36.0/64.0;
  if (index == 20) return 14.0/64.0; if (index == 21) return 46.0/64.0; if (index == 22) return 6.0/64.0; if (index == 23) return 38.0/64.0;
  if (index == 24) return 60.0/64.0; if (index == 25) return 28.0/64.0; if (index == 26) return 52.0/64.0; if (index == 27) return 20.0/64.0;
  if (index == 28) return 62.0/64.0; if (index == 29) return 30.0/64.0; if (index == 30) return 54.0/64.0; if (index == 31) return 22.0/64.0;
  if (index == 32) return 3.0/64.0; if (index == 33) return 35.0/64.0; if (index == 34) return 11.0/64.0; if (index == 35) return 43.0/64.0;
  if (index == 36) return 1.0/64.0; if (index == 37) return 33.0/64.0; if (index == 38) return 9.0/64.0; if (index == 39) return 41.0/64.0;
  if (index == 40) return 51.0/64.0; if (index == 41) return 19.0/64.0; if (index == 42) return 59.0/64.0; if (index == 43) return 27.0/64.0;
  if (index == 44) return 49.0/64.0; if (index == 45) return 17.0/64.0; if (index == 46) return 57.0/64.0; if (index == 47) return 25.0/64.0;
  if (index == 48) return 15.0/64.0; if (index == 49) return 47.0/64.0; if (index == 50) return 7.0/64.0; if (index == 51) return 39.0/64.0;
  if (index == 52) return 13.0/64.0; if (index == 53) return 45.0/64.0; if (index == 54) return 5.0/64.0; if (index == 55) return 37.0/64.0;
  if (index == 56) return 63.0/64.0; if (index == 57) return 31.0/64.0; if (index == 58) return 55.0/64.0; if (index == 59) return 23.0/64.0;
  if (index == 60) return 61.0/64.0; if (index == 61) return 29.0/64.0; if (index == 62) return 53.0/64.0; if (index == 63) return 21.0/64.0;

  return 0.0;
}

vec2 rotate(vec2 pt, float angle) {
  float s = sin(angle);
  float c = cos(angle);
  return vec2(pt.x * c - pt.y * s, pt.x * s + pt.y * c);
}

// Returns a single gray value in [0,1] for the pixel at `uv` in `tex`,
// respecting the active uColorMode.
// Paint is composited onto the source BEFORE computing luminance so that
// paint strokes influence halftone density rather than being stamped over
// the finished pattern (which would produce scalloped dot/line edges).
float getRawLuminance(vec2 uv, sampler2D tex) {
  vec4 imgColor = texture2D(tex, clamp(uv, 0.0, 1.0));
  vec4 paintColor = texture2D(uTexPaint, clamp(uv, 0.0, 1.0));

  // Unpremultiply paint (canvas2d backing store is premultiplied)
  vec4 paint;
  if (paintColor.a > 0.0001) {
    paint = vec4(paintColor.rgb / paintColor.a, paintColor.a);
  } else {
    paint = vec4(0.0);
  }

  float effectiveAlpha = imgColor.a + paint.a * (1.0 - imgColor.a);
  if (effectiveAlpha < 0.001) return 1.0; // fully transparent — no ink

  vec3 combined = mix(imgColor.rgb, paint.rgb, paint.a);
  vec3 processed = applyColorMode(combined);
  return dot(processed, vec3(1.0 / 3.0));
}

void main() {
  vec2 clampedUV = clamp(vTexCoord, 0.0, 0.999999);
  vec2 pixelPos = clampedUV * uTexSize;

  float isInk = 0.0;

  if (uPatternType == 0) { // CIRCULAR DOTS
    if (uThreshold >= 0.99) {
      isInk = 1.0;
    } else if (uThreshold <= 0.01) {
      isInk = 0.0;
    } else {
      vec2 rotatedPos = rotate(pixelPos, uAngle);
      vec2 cellCoord = floor(rotatedPos / uDotSize);

      // Check this cell and its 8 neighbors.
      // When density is high a dot's radius exceeds its cell boundary. Without
      // neighbor checks, those overflow pixels fall back to their own cell's
      // (smaller) dot and the large circle gets clipped into a rounded-rectangle
      // blob. Sampling adjacent cells ensures every pixel that geometrically
      // falls inside any dot is correctly marked as ink.
      for (int dx = -1; dx <= 1; dx++) {
        for (int dy = -1; dy <= 1; dy++) {
          vec2 nc        = cellCoord + vec2(float(dx), float(dy));
          vec2 ncCenter  = (nc + 0.5) * uDotSize;                        // rotated space
          vec2 ncWorld   = rotate(ncCenter, -uAngle);
          float lum      = getRawLuminance((floor(ncWorld) + 0.5) / uTexSize, uTexImage);
          float density  = clamp(uThreshold * 2.0 - lum, 0.0, 1.0);
          if (density <= 0.01) continue;

          // dist is in cell units; radius 1.414 (= 2 * sqrt(2)/2) lets dots
          // overlap neighbours at high density, closing corner gaps and enabling
          // large abstract dots at extreme settings.
          float dist   = distance(rotatedPos, ncCenter) / uDotSize;
          float radius = density * 1.414;
          isInk = max(isInk, smoothstep(radius, radius - 0.1, dist));
        }
      }
    }

  } else if (uPatternType == 1) { // LINE SCREEN
    vec2 rotatedPos = rotate(pixelPos, uAngle);
    float wave = sin(rotatedPos.x * (6.28318 / uDotSize)) * 0.5 + 0.5;
    float lum = getRawLuminance((floor(pixelPos) + 0.5) / uTexSize, uTexImage);

    float density = clamp(uThreshold * 2.0 - lum, 0.0, 1.0);
    if (uThreshold >= 0.99) isInk = 1.0;
    else if (uThreshold <= 0.01) isInk = 0.0;
    else isInk = step(wave, density);

  } else if (uPatternType == 2) { // BAYER DITHER
    float thresholdMat = bayer8x8(pixelPos);
    float lum = getRawLuminance((floor(pixelPos) + 0.5) / uTexSize, uTexImage);

    float density = clamp(uThreshold * 2.0 - lum, 0.0, 1.0);
    if (uThreshold >= 0.99) isInk = 1.0;
    else if (uThreshold <= 0.01) isInk = 0.0;
    else isInk = density > thresholdMat ? 1.0 : 0.0;
  }

  // Apply Invert
  if (uInvert) {
    isInk = 1.0 - isInk;
  }

  // Final Output — paint is already baked into the luminance via getRawLuminance,
  // so no separate paint composite step is needed here.
  if (isInk > 0.5) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
  } else {
    if (uTransparencyMode) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
    } else {
      gl_FragColor = vec4(uBackgroundColor, 1.0);
    }
  }
}
