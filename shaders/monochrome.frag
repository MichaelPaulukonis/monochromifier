precision highp float;

varying vec2 vTexCoord;

uniform sampler2D uTexImage;
uniform sampler2D uTexPaint;
uniform vec2 uTexSize;
uniform float uThreshold;
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

void main() {
  // Snap UV coordinates to the center of the nearest pixel to avoid
  // linear interpolation artifacts at texture boundaries.
  vec2 clampedUV = clamp(vTexCoord, 0.0, 0.999999);
  vec2 pixel = clampedUV * uTexSize;
  vec2 snapped = floor(pixel) + 0.5;
  vec2 uv = snapped / uTexSize;

  // Sample source image and paint layer
  vec4 imgColor = texture2D(uTexImage, uv);
  vec4 paintColor = texture2D(uTexPaint, uv);

  // 1. Unpremultiply and composite paint onto source BEFORE the B&W pipeline.
  //    This ensures paint strokes raise source luminance naturally, so they
  //    influence the threshold decision rather than being stamped over the result.
  //    canvas2d backing store is premultiplied alpha, so we unpremultiply first
  //    to avoid dark halos on semi-transparent stroke edges.
  vec4 paint;
  if (paintColor.a > 0.0001) {
    paint = vec4(paintColor.rgb / paintColor.a, paintColor.a);
  } else {
    paint = vec4(0.0);
  }

  vec3 sourceRgb = mix(imgColor.rgb, paint.rgb, paint.a);
  // Alpha compositing: painted areas over transparent source become opaque
  float effectiveAlpha = imgColor.a + paint.a * (1.0 - imgColor.a);

  // 2. Apply color mode, then reduce to a single gray value for the B&W pipeline.
  vec3 processed = applyColorMode(sourceRgb);
  float gray = dot(processed, vec3(1.0 / 3.0));

  // 3. Apply threshold
  float bw = gray > uThreshold ? 1.0 : 0.0;

  // 4. Apply Invert
  if (uInvert) {
    bw = 1.0 - bw;
  }

  // 5. Determine final color
  if (uTransparencyMode) {
    float transparencyLimit = (255.0 - uTransparencyThreshold) / 255.0;
    if (bw >= transparencyLimit || effectiveAlpha < 0.001) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
    } else {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    }
  } else {
    if (effectiveAlpha < 0.001 || bw == (uInvert ? 0.0 : 1.0)) {
      gl_FragColor = vec4(uBackgroundColor, 1.0);
    } else {
      float val = uInvert ? 1.0 : 0.0;
      gl_FragColor = vec4(val, val, val, 1.0);
    }
  }
}
