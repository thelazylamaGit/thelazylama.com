precision highp float;

in vec2 vUv;
uniform sampler2D u_state;

out vec4 fragColor;

void main() {
  // If you know the texture size at compile time you can pass it as a uniform;
  // otherwise textureSize(u_state,0) is fine in WebGL2/GLSL3.
  vec2 texSize = vec2(textureSize(u_state, 0));
  vec2 tc = (floor(vUv * texSize) + 0.5) / texSize; // nearest
  float a = texture(u_state, tc).r;
  vec3 col = mix(vec3(0.05), vec3(0.1, 1.0, 0.2), step(0.5, a));
  fragColor = vec4(col, 1.0);
//   fragColor = vec4(1,0,0, 1.0);
}
