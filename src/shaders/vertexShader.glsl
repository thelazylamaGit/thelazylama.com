precision highp float;
// attribute vec3 position;
varying vec2 vUv;

void main() {
  // position is already in clip space (-1..1) on ScreenQuad
  vUv = position.xy * 0.5 + 0.5;  // map to 0..1
  gl_Position = vec4(position, 1.0);
}