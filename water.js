// Flowing water background for any <canvas data-water>.
// Pauses when off-screen, holds still for reduced-motion, falls back to the CSS gradient without WebGL.
(function () {
  const frag = `
precision mediump float;
uniform vec2 r;
uniform float t;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + 1.0), f.x), f.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * n(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return v;
}
void main(){
  vec2 uv = gl_FragCoord.xy / r.y;
  float T = t * 0.05;
  vec2 q = vec2(fbm(uv * 1.4 + vec2(T, 0.0)), fbm(uv * 1.4 + vec2(5.2, 1.3) - T));
  vec2 w = uv * vec2(1.6, 2.6) + 2.2 * q + vec2(T * 2.0, -T * 0.4);
  float f = fbm(w);
  float g = fbm(w * 1.7 + 3.0);
  float ridge = pow(1.0 - abs(f * 2.0 - 1.0), 7.0);
  float ridge2 = pow(1.0 - abs(g * 2.0 - 1.0), 10.0);
  vec3 deep = vec3(0.07, 0.17, 0.17);
  vec3 mid  = vec3(0.15, 0.31, 0.29);
  vec3 gold = vec3(1.0, 0.76, 0.46);
  vec3 c = mix(deep, mid, smoothstep(0.25, 0.85, f));
  float sun = smoothstep(1.2, 0.0, length(gl_FragCoord.xy / r - vec2(0.78, 0.9)));
  c += gold * (ridge * 0.34 + ridge2 * 0.2) * (0.45 + sun);
  c += gold * 0.10 * sun;
  float vig = smoothstep(1.25, 0.35, length(gl_FragCoord.xy / r - 0.5));
  c *= 0.72 + 0.28 * vig;
  gl_FragColor = vec4(c, 1.0);
}`;
  const vert = 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }';
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.querySelectorAll('canvas[data-water]').forEach(canvas => {
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
    if (!gl) { canvas.remove(); return; }
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, vert));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, frag));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.remove(); return; }
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uR = gl.getUniformLocation(prog, 'r'), uT = gl.getUniformLocation(prog, 't');

    // Render at reduced resolution; the grain overlay and soft shapes hide it, and it keeps phones cool.
    const resize = () => {
      const scale = Math.min(window.devicePixelRatio || 1, 2) * 0.5;
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * scale));
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    let visible = false, paused = still, raf = 0, elapsed = 40, last = 0;
    const draw = () => { gl.uniform2f(uR, canvas.width, canvas.height); gl.uniform1f(uT, elapsed); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); };
    const loop = now => {
      if (last) elapsed += Math.min(now - last, 100) / 1000;
      last = now;
      draw();
      raf = requestAnimationFrame(loop);
    };
    const sync = () => {
      cancelAnimationFrame(raf); last = 0;
      if (visible && !paused) raf = requestAnimationFrame(loop); else draw();
    };
    resize(); draw();
    new ResizeObserver(() => { resize(); draw(); }).observe(canvas);
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; sync(); }).observe(canvas);

    const btn = canvas.parentElement.querySelector('.water-toggle');
    if (btn) {
      const label = () => { btn.setAttribute('aria-label', paused ? 'Play background motion' : 'Pause background motion'); btn.textContent = paused ? '▶' : '❚❚'; };
      label();
      btn.addEventListener('click', () => { paused = !paused; label(); sync(); });
    }
  });
})();
