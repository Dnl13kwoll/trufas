'use strict';
(function () {
  const canvas = document.getElementById('canvas-3d');
  if (!canvas || typeof THREE === 'undefined') return;

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.z = 4.5;

  // ── Trufa ────────────────────────────────────────────────────────
  const trufa = new THREE.Mesh(
    new THREE.SphereGeometry(1, 128, 128),
    new THREE.MeshStandardMaterial({
      color:      0x2d1206,
      roughness:  0.60,
      metalness:  0.08,
    })
  );
  trufa.castShadow = true;
  scene.add(trufa);

  // Brilho superficial (highlight pequeno)
  const highlight = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 32, 32),
    new THREE.MeshBasicMaterial({ color: 0xf5e6c8, transparent: true, opacity: 0.45 })
  );
  highlight.position.set(0.55, 0.65, 0.82);
  trufa.add(highlight);

  // Anel decorativo ao redor
  const anel = new THREE.Mesh(
    new THREE.TorusGeometry(1.45, 0.015, 16, 100),
    new THREE.MeshStandardMaterial({ color: 0xc8860a, roughness: 0.3, metalness: 0.6 })
  );
  anel.rotation.x = Math.PI / 2.5;
  scene.add(anel);

  // ── Partículas (pó de cacau) ──────────────────────────────────────
  const N   = 400;
  const pos = new Float32Array(N * 3);
  const vel = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const r = 2.5 + Math.random() * 4;
    const θ = Math.random() * Math.PI * 2;
    const φ = Math.acos(2 * Math.random() - 1);
    pos[i*3]   = r * Math.sin(φ) * Math.cos(θ);
    pos[i*3+1] = r * Math.sin(φ) * Math.sin(θ);
    pos[i*3+2] = r * Math.cos(φ);
    vel[i*3]   = (Math.random() - 0.5) * 0.002;
    vel[i*3+1] = (Math.random() - 0.5) * 0.002;
    vel[i*3+2] = (Math.random() - 0.5) * 0.002;
  }
  const pgeo = new THREE.BufferGeometry();
  pgeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pontos = new THREE.Points(pgeo, new THREE.PointsMaterial({
    color: 0xc8860a, size: 0.035, transparent: true, opacity: 0.55,
  }));
  scene.add(pontos);

  // ── Luzes ─────────────────────────────────────────────────────────
  scene.add(new THREE.AmbientLight(0x3d1a0f, 0.9));

  const luz1 = new THREE.PointLight(0xf5a623, 4, 15);
  luz1.position.set(4, 4, 5);
  scene.add(luz1);

  const luz2 = new THREE.PointLight(0xc8860a, 2, 10);
  luz2.position.set(-4, -3, 3);
  scene.add(luz2);

  const luz3 = new THREE.PointLight(0xffffff, 0.5, 8);
  luz3.position.set(0, 0, 5);
  scene.add(luz3);

  // ── Resize ────────────────────────────────────────────────────────
  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  // ── Loop ──────────────────────────────────────────────────────────
  let raf = null;
  let t   = 0;

  function animate() {
    t += 0.008;
    trufa.rotation.y  = t * 0.5;
    trufa.rotation.x  = Math.sin(t * 0.4) * 0.25;
    anel.rotation.z   = t * 0.15;
    anel.rotation.y   = t * 0.08;
    pontos.rotation.y = t * 0.06;
    pontos.rotation.x = t * 0.03;
    luz1.position.x   = Math.sin(t * 0.6) * 4;
    luz1.position.y   = Math.cos(t * 0.4) * 4;

    // Mover partículas levemente
    const arr = pgeo.attributes.position.array;
    for (let i = 0; i < N; i++) {
      arr[i*3]   += vel[i*3];
      arr[i*3+1] += vel[i*3+1];
      arr[i*3+2] += vel[i*3+2];
      const dx = arr[i*3], dy = arr[i*3+1], dz = arr[i*3+2];
      const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
      if (dist > 7 || dist < 1.2) {
        vel[i*3] *= -1; vel[i*3+1] *= -1; vel[i*3+2] *= -1;
      }
    }
    pgeo.attributes.position.needsUpdate = true;

    renderer.render(scene, camera);
    raf = requestAnimationFrame(animate);
  }

  window._scene3d = {
    start() { resize(); if (!raf) animate(); },
    stop()  { if (raf) { cancelAnimationFrame(raf); raf = null; } },
  };
})();
