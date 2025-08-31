precision highp float;
precision highp sampler2D;

uniform sampler2D u_state;
uniform ivec2 u_gridSize;
uniform vec2  u_mouse;      // (-1,-1) when inactive
uniform float u_brush;

out vec4 fragColor;

int get(ivec2 p){
  p = ivec2(mod(vec2(p), vec2(u_gridSize)));           // wrap
  return int(texelFetch(u_state, p, 0).r > 0.5);
}

void main() {
  ivec2 coord = ivec2(gl_FragCoord.xy) - ivec2(0,1);   // integer grid coord
  int s = get(coord);
  int n = 0;
  n += get(coord + ivec2(-1,-1));
  n += get(coord + ivec2( 0,-1));
  n += get(coord + ivec2( 1,-1));
  n += get(coord + ivec2(-1, 0));
  n += get(coord + ivec2( 1, 0));
  n += get(coord + ivec2(-1, 1));
  n += get(coord + ivec2( 0, 1));
  n += get(coord + ivec2( 1, 1));

  int next = (n == 3 || (s == 1 && n == 2)) ? 1 : 0;

  if (u_mouse.x >= 0.0) {
    vec2 cell = u_mouse * vec2(u_gridSize);
    if (distance(cell, vec2(coord)) <= u_brush) next = 1;
  }

  fragColor = vec4(float(next), 0.0, 0.0, 1.0);
}
