/* Water Seven ship relief. Presentation only: no game state, input capture or saves.
 * Existing artwork, camera transforms, markers and equipment slots remain authoritative.
 */
(() => {
  "use strict";
  const image = document.getElementById("shipImg");
  const layer = document.getElementById("shipFocusLayer");
  const stage = document.getElementById("shipStage");
  if (!image || !layer || !stage) return;
  const canvas = document.createElement("canvas");
  canvas.className = "ship-depth-canvas";
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;display:none;filter:drop-shadow(0 22px 20px rgba(0,0,0,.45))";
  image.after(canvas);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const fine = matchMedia("(hover: hover) and (pointer: fine)");
  let gl, program, mesh, indexBuffer, colorTexture, depthTexture, count = 0;
  let assets, activeSource = "", generation = 0, disposed = false, lost = false, frame = 0;
  let target = [0, 0], current = [0, 0], sourceSize = [1, 1], fit = [1, 1];
  let renderedFrames = 0, lastError = "", originalOpacity = image.style.opacity;
  const locations = {};
  const suspended = () => document.hidden || stage.classList.contains("tuning") || stage.classList.contains("is-turning");
  const source = () => {
    const pathname = new URL(image.getAttribute("src") || "", location.href).pathname;
    const start = pathname.indexOf("images/board/water_seven/");
    return start >= 0 ? pathname.slice(start) : "";
  };
  function original() {
    canvas.style.display = "none";
    image.style.opacity = originalOpacity;
    stage.removeAttribute("data-ship-depth-ready");
  }
  function shader(type, code) {
    const result = gl.createShader(type);
    gl.shaderSource(result, code);
    gl.compileShader(result);
    if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(result));
    return result;
  }
  function initialize() {
    gl = canvas.getContext("webgl", { alpha: true, antialias: true, premultipliedAlpha: true, powerPreference: "low-power" });
    if (!gl || gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS) < 1) throw Error("Ship relief unavailable");
    const vertex = shader(gl.VERTEX_SHADER, `
      attribute vec2 aUv;
      uniform sampler2D uDepth;
      uniform vec2 uFit;
      uniform vec2 uMotion;
      varying vec2 vUv;
      void main() {
        vUv = aUv;
        float z = texture2D(uDepth, aUv).r - .5;
        vec2 position = vec2(aUv.x * 2. - 1., 1. - aUv.y * 2.) * uFit;
        // A shallow height-field, not a rotation of the whole interface.
        // The calibrated image plane is unchanged at the neutral pose.
        position += uMotion * z;
        gl_Position = vec4(position, 0., 1.);
      }
    `);
    const fragment = shader(gl.FRAGMENT_SHADER, `
      precision mediump float;
      uniform sampler2D uColor;
      uniform sampler2D uDepth;
      uniform vec2 uTexel;
      uniform vec2 uPointer;
      varying vec2 vUv;
      void main() {
        vec4 ink = texture2D(uColor, vUv);
        if (ink.a < .004) discard;
        float left = texture2D(uDepth, vUv - vec2(uTexel.x, 0.)).r;
        float right = texture2D(uDepth, vUv + vec2(uTexel.x, 0.)).r;
        float top = texture2D(uDepth, vUv - vec2(0., uTexel.y)).r;
        float bottom = texture2D(uDepth, vUv + vec2(0., uTexel.y)).r;
        vec3 normal = normalize(vec3((left - right) * 10., (bottom - top) * 10., 1.));
        vec3 light = normalize(vec3(-.38 + uPointer.x * .35, .45 - uPointer.y * .25, .85));
        float diffuse = max(dot(normal, light), 0.);
        float relief = .76 + .29 * diffuse;
        float glint = .035 * pow(max(dot(normal, normalize(light + vec3(0.,0.,1.))), 0.), 22.);
        vec3 color = ink.rgb * relief + vec3(1., .91, .73) * glint;
        gl_FragColor = vec4(color * ink.a, ink.a);
      }
    `);
    program = gl.createProgram();
    gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
    gl.deleteShader(vertex); gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    for (const name of ["uColor", "uDepth", "uFit", "uMotion", "uTexel", "uPointer"]) locations[name] = gl.getUniformLocation(program, name);
    gl.uniform1i(locations.uColor, 0); gl.uniform1i(locations.uDepth, 1);
    mesh = gl.createBuffer(); indexBuffer = gl.createBuffer();
    colorTexture = gl.createTexture(); depthTexture = gl.createTexture();
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
  }
  function texture(unit, textureObject, width, height, bytes, format) {
    gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, textureObject);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (width) gl.texImage2D(gl.TEXTURE_2D, 0, format, width, height, 0, format, gl.UNSIGNED_BYTE, bytes);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
  }
  function resize() {
    if (!gl || lost || disposed) return;
    const width = layer.clientWidth, height = layer.clientHeight;
    if (!width || !height) return;
    // Match the existing camera's zoom as well as device pixels: drawing at
    // the unzoomed layout size would soften sails and rigging in close-ups.
    const zoom = Math.max(1, layer.getBoundingClientRect().width / width);
    const ratio = Math.min((devicePixelRatio || 1) * zoom, 2, 1600 / Math.max(width, height));
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    gl.viewport(0, 0, canvas.width, canvas.height);
    const scale = Math.min(width / sourceSize[0], height / sourceSize[1]);
    fit = [sourceSize[0] * scale / width, sourceSize[1] * scale / height];
    request();
  }
  function draw() {
    frame = 0;
    if (disposed || lost || !activeSource || suspended()) return;
    const enabled = fine.matches && !reduced.matches;
    if (!enabled) { target = [0, 0]; current = [0, 0]; }
    current = current.map((value, i) => Math.abs(target[i] - value) < .003 ? target[i] : value + (target[i] - value) * .18);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2fv(locations.uFit, fit);
    // Maximum silhouette displacement is 3 CSS px at the unzoomed image.
    gl.uniform2f(locations.uMotion, current[0] * 12 / Math.max(1, layer.clientWidth), -current[1] * 12 / Math.max(1, layer.clientHeight));
    gl.uniform2fv(locations.uPointer, current);
    gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, 0);
    renderedFrames++;
    if (current.some((value, i) => value !== target[i])) request();
  }
  function request() { if (!frame && !disposed && !lost && !suspended()) frame = requestAnimationFrame(draw); }
  function install(entry, bitmap, key) {
    const [width, height] = entry.grid;
    const depths = Uint8Array.from(atob(entry.depth), value => value.charCodeAt(0));
    if (width < 2 || height < 2 || width * height > 65535 || depths.length !== width * height) throw Error("Invalid ship geometry");
    const vertices = [], indices = [];
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      vertices.push(x / (width - 1), y / (height - 1));
      if (x < width - 1 && y < height - 1) {
        const a = y * width + x;
        indices.push(a, a + 1, a + width, a + 1, a + width + 1, a + width);
      }
    }
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    const attribute = gl.getAttribLocation(program, "aUv");
    gl.enableVertexAttribArray(attribute); gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
    texture(0, colorTexture, 0, 0, bitmap, gl.RGBA);
    texture(1, depthTexture, width, height, depths, gl.LUMINANCE);
    gl.uniform2f(locations.uTexel, 1 / width, 1 / height);
    count = indices.length; sourceSize = entry.sourceSize; activeSource = key;
    target = [0, 0]; current = [0, 0]; resize();
    if (suspended()) return;
    // Display the replacement only once a fully populated frame was drawn.
    if (frame) cancelAnimationFrame(frame);
    draw();
    canvas.style.display = "block"; image.style.opacity = "0";
    stage.setAttribute("data-ship-depth-ready", "true");
  }
  async function sync() {
    if (disposed || lost || !assets) return;
    const key = source(), token = ++generation;
    original();
    if (suspended()) return;
    const entry = assets[key];
    if (!entry) { activeSource = ""; return; }
    if (activeSource === key) {
      resize(); canvas.style.display = "block"; image.style.opacity = "0";
      stage.setAttribute("data-ship-depth-ready", "true"); return;
    }
    const bitmap = new Image();
    let objectUrl;
    try {
      // The ordinary img may already have cached the redirected CDN response
      // without CORS headers. Request fresh CORS-readable bytes for WebGL;
      // reusing that non-CORS image cache can taint or reject the texture.
      const response = await fetch(new URL(key, location.href), { mode: "cors", credentials: "omit", cache: "reload" });
      if (!response.ok) throw Error("Ship texture unavailable");
      objectUrl = URL.createObjectURL(await response.blob());
      bitmap.src = objectUrl;
      await bitmap.decode();
      if (disposed || lost || token !== generation || source() !== key || suspended()) return;
      install(entry, bitmap, key);
    } catch (error) { if (token === generation) { lastError = error.message; original(); } }
    finally { if (objectUrl) URL.revokeObjectURL(objectUrl); }
  }
  function pointer(event) {
    if (!fine.matches || reduced.matches || suspended() || event.target.closest("button,input,select,textarea,.ship-marker,.slot")) return reset();
    const rect = stage.getBoundingClientRect();
    target = [Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1)),
      Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height * 2 - 1))];
    request();
  }
  function reset() { target = [0, 0]; request(); }
  function cameraSettled(event) { if (event.target === layer && event.propertyName === "transform") resize(); }
  const sourceObserver = new MutationObserver(sync);
  const stageObserver = new MutationObserver(() => { reset(); void sync(); });
  const resizeObserver = new ResizeObserver(resize);
  function visibility() { reset(); if (document.hidden) { if (frame) cancelAnimationFrame(frame); frame = 0; } else void sync(); }
  function dispose() {
    if (disposed) return;
    disposed = true; generation++; original();
    cancelAnimationFrame(frame); sourceObserver.disconnect(); stageObserver.disconnect(); resizeObserver.disconnect();
    stage.removeEventListener("pointermove", pointer); stage.removeEventListener("pointerleave", reset);
    layer.removeEventListener("transitionend", cameraSettled);
    reduced.removeEventListener("change", reset); fine.removeEventListener("change", reset);
    document.removeEventListener("visibilitychange", visibility);
    if (gl && !lost) {
      gl.deleteBuffer(mesh); gl.deleteBuffer(indexBuffer); gl.deleteTexture(colorTexture); gl.deleteTexture(depthTexture); gl.deleteProgram(program);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
    canvas.remove();
  }
  canvas.addEventListener("webglcontextlost", event => { event.preventDefault(); lost = true; generation++; cancelAnimationFrame(frame); frame = 0; original(); });
  canvas.addEventListener("webglcontextrestored", () => { if (disposed) return; try { lost = false; activeSource = ""; initialize(); void sync(); } catch (error) { lastError = error.message; original(); } });
  window.__WATER_SEVEN_DEPTH__ = { status: () => ({ activeSource, ready: canvas.style.display === "block", lost, disposed, vertices: count / 6, frames: renderedFrames, pointer: current.slice(), canvas: [canvas.width, canvas.height], error: lastError }), dispose };
  try {
    initialize();
    sourceObserver.observe(image, { attributes: true, attributeFilter: ["src"] });
    stageObserver.observe(stage, { attributes: true, attributeFilter: ["class"] });
    resizeObserver.observe(layer);
    stage.addEventListener("pointermove", pointer, { passive: true }); stage.addEventListener("pointerleave", reset);
    layer.addEventListener("transitionend", cameraSettled);
    reduced.addEventListener("change", reset); fine.addEventListener("change", reset);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", dispose, { once: true });
    fetch("js/board_water_seven_depth_data.json").then(response => {
      if (!response.ok) throw Error("Ship geometry unavailable"); return response.json();
    }).then(document => {
      if (document.schema !== 1 || document.generator !== "water-seven-ship-relief-v1") throw Error("Invalid ship geometry manifest");
      assets = document.assets; return sync();
    }).catch(error => { lastError = error.message; original(); });
  } catch (error) { lastError = error.message; original(); }
})();
