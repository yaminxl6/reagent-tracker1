import React, { useEffect, useRef, useState } from "react";

// A 3D walkthrough of the physical lab — matches your bench/device/fridge
// layout. Devices are drawn with a small labeled panel texture instead of
// real photos (loading arbitrary external images as WebGL textures isn't
// reliable/allowed), which is the closest practical approximation.
export default function LabMap() {
  const mountRef = useRef(null);
  const keysRef = useRef({});
  const [label, setLabel] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let renderer, scene, camera, frameId;
    let disposed = false;
    const keys = keysRef.current;
    const items = [];
    const pos = { x: 0, y: 1.65, z: 6 };
    let yaw = Math.PI, pitch = 0;
    let dragging = false, lastX = 0, lastY = 0;

    import("three").then((THREE) => {
      if (disposed) return;
      const mount = mountRef.current;
      if (!mount) return;
      const W = mount.clientWidth, H = 560;

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(65, W / H, 0.1, 1000);
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(W, H);
      mount.appendChild(renderer.domElement);
      mount.tabIndex = 0;
      mount.style.outline = "none";

      scene.add(new THREE.AmbientLight(0xffffff, 0.9));
      const dl = new THREE.DirectionalLight(0xffffff, 0.5);
      dl.position.set(15, 25, 15);
      scene.add(dl);

      const floor = new THREE.Mesh(new THREE.PlaneGeometry(56, 32), new THREE.MeshStandardMaterial({ color: 0xE3E0D6, side: THREE.DoubleSide }));
      floor.rotation.x = Math.PI / 2;
      scene.add(floor);
      scene.add(new THREE.GridHelper(56, 56, 0xC7C1B4, 0xDAD5C9));

      function reg(m, name) { m.userData.name = name; items.push(m); scene.add(m); return m; }
      function flat(c) { return new THREE.MeshStandardMaterial({ color: c }); }
      function canvasTex(w, h, drawFn) {
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        const ctx = c.getContext("2d"); drawFn(ctx, w, h);
        return new THREE.CanvasTexture(c);
      }
      function labeledPanel(bg, accent, brand, sub) {
        return canvasTex(512, 384, (ctx, cw, ch) => {
          ctx.fillStyle = bg; ctx.fillRect(0, 0, cw, ch);
          ctx.fillStyle = "#D8D5CC"; ctx.fillRect(0, ch * 0.75, cw, ch * 0.25);
          ctx.fillStyle = "#1a2b3c"; ctx.fillRect(cw * 0.08, ch * 0.12, cw * 0.55, ch * 0.42);
          ctx.fillStyle = accent; ctx.fillRect(cw * 0.1, ch * 0.15, cw * 0.5, ch * 0.06);
          ctx.fillStyle = accent; ctx.font = "bold " + Math.round(ch * 0.07) + "px sans-serif"; ctx.fillText(sub, cw * 0.66, ch * 0.28);
          ctx.fillStyle = "#3d3d3a"; ctx.font = "bold " + Math.round(ch * 0.09) + "px sans-serif"; ctx.fillText(brand, cw * 0.66, ch * 0.38);
          ctx.strokeStyle = "#B9B3A0"; ctx.lineWidth = 2;
          for (let i = 0; i < 4; i++) ctx.strokeRect(cw * 0.68, ch * (0.35 + i * 0.09), cw * 0.22, ch * 0.06);
        });
      }
      function analyzerUnit(x, z, name, bg, accent, brand, sub) {
        const g = new THREE.Group();
        const tex = labeledPanel(bg, accent, brand, sub);
        const mats = [flat(bg), flat(bg), flat(bg), flat(bg), new THREE.MeshStandardMaterial({ map: tex }), flat(bg)];
        const base = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.15, 1.25), mats);
        base.position.y = 0.58;
        g.add(base);
        const lid = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.15, 1.15), flat(bg));
        lid.position.set(0, 1.24, 0);
        g.add(lid);
        g.position.set(x, 0, z);
        return reg(g, name);
      }
      function fridgeTex() {
        return canvasTex(512, 700, (ctx, w, h) => {
          ctx.fillStyle = "#F3F1EA"; ctx.fillRect(0, 0, w, h);
          ctx.strokeStyle = "#C7C1B4"; ctx.lineWidth = 6;
          ctx.strokeRect(w * 0.06, h * 0.04, w * 0.88, h * 0.92);
          ctx.fillStyle = "#0F7173"; ctx.fillRect(w * 0.06, h * 0.04, w * 0.88, h * 0.1);
          ctx.fillStyle = "#fff"; ctx.font = "bold " + Math.round(h * 0.045) + "px sans-serif"; ctx.fillText("Lab fridge", w * 0.12, h * 0.1);
          ctx.strokeStyle = "#B9B3A0"; ctx.lineWidth = 3;
          ctx.strokeRect(w * 0.06, h * 0.55, w * 0.88, h * 0.41);
          ctx.fillStyle = "#8A8A82"; ctx.fillRect(w * 0.85, h * 0.2, w * 0.05, h * 0.25);
          ctx.fillStyle = "#8A8A82"; ctx.fillRect(w * 0.85, h * 0.62, w * 0.05, h * 0.25);
        });
      }
      function fridgeUnit(x, z, name) {
        const g = new THREE.Group();
        const tex = fridgeTex();
        const mats = [flat(0xF3F1EA), flat(0xF3F1EA), flat(0xF3F1EA), flat(0xF3F1EA), new THREE.MeshStandardMaterial({ map: tex }), flat(0xF3F1EA)];
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.9, 1.8), mats);
        body.position.y = 0.95;
        g.add(body);
        g.position.set(x, 0, z);
        return reg(g, name);
      }
      function bench(x, z, w, d, name, color) {
        const g = new THREE.Group();
        const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, d), flat(color || 0xDCD6C6));
        top.position.y = 0.9; g.add(top);
        const legGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.88, 8);
        [[w / 2 - 0.1, d / 2 - 0.1], [-(w / 2 - 0.1), d / 2 - 0.1], [w / 2 - 0.1, -(d / 2 - 0.1)], [-(w / 2 - 0.1), -(d / 2 - 0.1)]].forEach(([lx, lz]) => {
          const leg = new THREE.Mesh(legGeo, flat(0x8A8A82));
          leg.position.set(lx, 0.44, lz); g.add(leg);
        });
        g.position.set(x, 0, z);
        return reg(g, name);
      }
      function computerUnit(x, z, name) {
        const g = new THREE.Group();
        const screenTex = canvasTex(256, 192, (ctx, w, h) => {
          ctx.fillStyle = "#1a2b3c"; ctx.fillRect(0, 0, w, h);
          ctx.fillStyle = "#3B8BD4"; ctx.fillRect(w * 0.08, h * 0.1, w * 0.6, h * 0.12);
          ctx.fillStyle = "#8FA8C7"; ctx.fillRect(w * 0.08, h * 0.3, w * 0.84, h * 0.08);
          ctx.fillStyle = "#8FA8C7"; ctx.fillRect(w * 0.08, h * 0.45, w * 0.84, h * 0.08);
          ctx.fillStyle = "#8FA8C7"; ctx.fillRect(w * 0.08, h * 0.6, w * 0.6, h * 0.08);
        });
        const mon = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.4, 0.04), new THREE.MeshStandardMaterial({ map: screenTex }));
        mon.position.set(0, 1.1, 0); g.add(mon);
        const stand = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.15, 0.08), flat(0x444441));
        stand.position.set(0, 0.9, 0); g.add(stand);
        const desk = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.5), flat(0xDCD6C6));
        desk.position.set(0, 0.78, 0.1); g.add(desk);
        const legGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.75, 6);
        [[0.4, 0.3], [-0.4, 0.3], [0.4, -0.05], [-0.4, -0.05]].forEach(([lx, lz]) => {
          const leg = new THREE.Mesh(legGeo, flat(0x8A8A82)); leg.position.set(lx, 0.39, lz + 0.1); g.add(leg);
        });
        g.position.set(x, 0, z);
        return reg(g, name);
      }
      function door(x, z, label_) { const m = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.15, 0.3), flat(0x8A6D3B)); m.position.set(x, 0.1, z); reg(m, label_); }
      function windowMark(x, z, label_) { const m = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 0.2), flat(0x85B7EB)); m.position.set(x, 1.2, z); reg(m, label_); }
      function misc(x, z, w, d, h, color, name) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), flat(color)); m.position.set(x, h / 2, z); reg(m, name); }

      const coagC = "#7F77DD", roomC = 0xEF9F27, microC = 0xD4537E, miscC = 0x1D9E75, equip = 0x639922;

      door(0, 11, "Main entrance door");
      computerUnit(10, 8, "Computer (entrance desk)");
      analyzerUnit(10, 5, "Spincell 5", "#EDEAE1", "#1D9E75", "Spincell 5", "Hematology");
      analyzerUnit(10, 2.5, "Biomerieux VIDAS-3", "#EDEAE1", "#D4537E", "VIDAS 3", "bioMerieux");
      analyzerUnit(10, 0, "Wuhan PT-1000", "#EDEAE1", "#639922", "PT-1000", "Coagulation");

      bench(6, -3.5, 8, 1.4, "Bench: Sysmex/DxH560/Lifotronic/Medconn", 0xDCD6C6);
      analyzerUnit(8.5, -3.5, "Sysmex XN1000", "#F3F1EA", "#D85A30", "XN-1000", "Sysmex");
      analyzerUnit(6.7, -3.5, "Beckman DxH 560", "#EDEAE1", "#0C447C", "DxH 560", "Beckman Coulter");
      analyzerUnit(4.9, -3.5, "Lifotronic H8", "#EDEAE1", "#7F77DD", "H8", "Lifotronic");
      analyzerUnit(3.1, -3.5, "Medconn Mq-3000", "#EDEAE1", "#EF9F27", "Mq-3000", "Medconn");

      analyzerUnit(6.5, -6.5, "Hemaclot Junior (Human) 1", "#EDEAE1", coagC, "Hemaclot Jr", "HUMAN");
      analyzerUnit(4.5, -6.5, "Hemaclot Junior (Human) 2", "#EDEAE1", coagC, "Hemaclot Jr", "HUMAN");
      analyzerUnit(5.5, -8.5, "ERBA ECL 412", "#EDEAE1", "#D85A30", "ECL 412", "ERBA");

      bench(1, -6.5, 2.4, 1.2, "Working area (bench)", 0xE6E2D6);
      misc(-1.5, -6.5, 1.2, 1.4, 0.95, 0xB4B2A9, "Sink / wash basin");
      analyzerUnit(-4, -6.5, "Beckman Access II", "#EDEAE1", "#0C447C", "Access 2", "Beckman Coulter");
      analyzerUnit(-6.5, -6.5, "Beckman DxC 700", "#EDEAE1", "#0C447C", "DxC 700 AU", "Beckman Coulter");
      analyzerUnit(-9, -6.5, "Roche cobas C 311", "#F2F1EC", "#0C447C", "cobas c 311", "Roche");
      door(-9, -3, "Small side door");
      analyzerUnit(-9, -1, "Beckman DxI 800", "#EDEAE1", "#0C447C", "DxI 800", "Beckman Coulter");

      misc(6, 10, 2.4, 2, 1.6, roomC, "Doctor's office");
      misc(-3, 10, 1.4, 1, 1.6, miscC, "Paper locker");
      door(-6, 10, "Opening / doorway");
      analyzerUnit(-8.5, 8.5, "BioLis 30i", "#EDEAE1", "#D85A30", "BioLis 30i", "Tokyo Boeki");
      misc(-6, 6.5, 1.4, 1, 1.6, miscC, "Staff locker");
      computerUnit(-4, 6.5, "Computer (staff area)");

      analyzerUnit(-11, 6.5, "Aidian QuikRead Go", "#EDEAE1", "#D4537E", "QuikRead go", "Aidian");
      misc(-13, 6.5, 0.9, 0.9, 1.1, microC, "Microscope");
      analyzerUnit(-15, 6.5, "Sysmex Uc-1000 (urine)", "#F3F1EA", "#D85A30", "UC-1000", "Sysmex");
      misc(-17, 6.5, 1.2, 1, 0.95, 0xB4B2A9, "Sink / wash basin (Micro)");

      analyzerUnit(-13, 3.5, "Nova biomedical Prime+", "#EDEAE1", "#378ADD", "Prime Plus", "Nova Biomedical");
      analyzerUnit(-15, 3.5, "Aidian", "#EDEAE1", "#D4537E", "Aidian", "Aidian");
      analyzerUnit(-17, 3.5, "Dirui Fus-3000plus", "#EDEAE1", "#639922", "FUS-3000+", "Dirui");

      misc(-13, 0, 1.4, 1, 1.6, miscC, "Locker");

      door(-19, 0.5, "Warehouse door");
      bench(-16, -2, 3, 1.6, "Warehouse (Room Temperature)", roomC);
      fridgeUnit(-19.5, 1, "Fridge: MAS (Lab0007)");
      fridgeUnit(-19.5, -1.5, "Fridge: Mefleh (Lab00014)");

      door(-24, 1, "Receiving room door");
      misc(-23, -0.5, 1.2, 1.2, 0.95, equip, "Centrifuge");
      analyzerUnit(-25, -0.5, "Richen IR Force 200", "#EDEAE1", "#639922", "IR Force 200", "Richen");
      misc(-27, -0.5, 1.3, 1.1, 1.5, equip, "Incubator");
      fridgeUnit(-23.5, 2, "Fridge: Anzal (Lab0202)");
      misc(-26, 2, 1.1, 0.9, 1.4, equip, "Safety cabinet");
      misc(-28, 2, 1.2, 1, 0.95, 0xB4B2A9, "Sink / wash basin (Receiving)");
      windowMark(-27, -2.2, "Window to blood draw room");

      computerUnit(-19, -6, "Host computer (Blood Bank)");
      fridgeUnit(-21.5, -6, "Fridge: Fawaz (FFP / plasma)");
      fridgeUnit(-24, -6, "Fridge: Maged (Blood Bank)");
      bench(-19, -9, 1.8, 1.2, "Crossmatch area (gel card centrifuge)", equip);
      fridgeUnit(-22, -9.5, "Samples fridge");
      misc(-24, -9.5, 1.3, 1.1, 1.2, equip, "Controls freezer");
      fridgeUnit(-26.5, -9, "Fridge: Fawaz (PRBCs / blood)");

      const onMouseDown = (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; mount.focus(); };
      const onMouseUp = () => { dragging = false; };
      const onMouseMove = (e) => {
        if (!dragging) return;
        yaw -= (e.clientX - lastX) * 0.005;
        pitch = Math.max(-1.2, Math.min(1.2, pitch - (e.clientY - lastY) * 0.005));
        lastX = e.clientX; lastY = e.clientY;
      };
      const onTouchStart = (e) => {
        if (e.touches.length !== 1) return;
        dragging = true; lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
      };
      const onTouchMove = (e) => {
        if (!dragging || e.touches.length !== 1) return;
        yaw -= (e.touches[0].clientX - lastX) * 0.005;
        pitch = Math.max(-1.2, Math.min(1.2, pitch - (e.touches[0].clientY - lastY) * 0.005));
        lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
        e.preventDefault();
      };
      const onTouchEnd = () => { dragging = false; };
      const onKeyDown = (e) => { keys[e.key.toLowerCase()] = true; e.preventDefault(); };
      const onKeyUp = (e) => { keys[e.key.toLowerCase()] = false; };
      const onClick = () => mount.focus();

      mount.addEventListener("mousedown", onMouseDown);
      window.addEventListener("mouseup", onMouseUp);
      window.addEventListener("mousemove", onMouseMove);
      mount.addEventListener("touchstart", onTouchStart, { passive: true });
      mount.addEventListener("touchmove", onTouchMove, { passive: false });
      mount.addEventListener("touchend", onTouchEnd);
      mount.addEventListener("keydown", onKeyDown);
      mount.addEventListener("keyup", onKeyUp);
      mount.addEventListener("click", onClick);

      const raycasterVec = new THREE.Vector3();
      function animate() {
        frameId = requestAnimationFrame(animate);
        const speed = 0.12;
        const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
        const right = new THREE.Vector3(Math.sin(yaw + Math.PI / 2), 0, Math.cos(yaw + Math.PI / 2));
        if (keys["w"] || keys["arrowup"]) { pos.x -= forward.x * speed; pos.z -= forward.z * speed; }
        if (keys["s"] || keys["arrowdown"]) { pos.x += forward.x * speed; pos.z += forward.z * speed; }
        if (keys["a"] || keys["arrowleft"]) { pos.x -= right.x * speed; pos.z -= right.z * speed; }
        if (keys["d"] || keys["arrowright"]) { pos.x += right.x * speed; pos.z += right.z * speed; }
        pos.x = Math.max(-30, Math.min(14, pos.x));
        pos.z = Math.max(-11, Math.min(12, pos.z));
        camera.position.set(pos.x, pos.y, pos.z);
        raycasterVec.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
        camera.lookAt(pos.x + raycasterVec.x, pos.y + raycasterVec.y, pos.z + raycasterVec.z);

        let nearest = null, nearestDist = 3.5;
        items.forEach((it) => {
          const dx = it.position.x - pos.x, dz = it.position.z - pos.z;
          const d = Math.sqrt(dx * dx + dz * dz);
          if (d < nearestDist) { nearestDist = d; nearest = it; }
        });
        setLabel(nearest ? nearest.userData.name : "");
        renderer.render(scene, camera);
      }
      animate();
      setReady(true);

      mount._cleanup = () => {
        cancelAnimationFrame(frameId);
        mount.removeEventListener("mousedown", onMouseDown);
        window.removeEventListener("mouseup", onMouseUp);
        window.removeEventListener("mousemove", onMouseMove);
        mount.removeEventListener("touchstart", onTouchStart);
        mount.removeEventListener("touchmove", onTouchMove);
        mount.removeEventListener("touchend", onTouchEnd);
        mount.removeEventListener("keydown", onKeyDown);
        mount.removeEventListener("keyup", onKeyUp);
        mount.removeEventListener("click", onClick);
        renderer.dispose();
        if (renderer.domElement && renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
      };
    });

    return () => {
      disposed = true;
      if (mountRef.current && mountRef.current._cleanup) mountRef.current._cleanup();
    };
  }, []);

  function press(key, down) { keysRef.current[key] = down; }
  const padBtnStyle = { width: 52, height: 52, borderRadius: "50%", border: "1px solid #C7D1CE", background: "rgba(255,255,255,0.85)", color: "#1B2B2E", fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center", userSelect: "none", touchAction: "none" };

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Lab map</h2>
      <div style={{ fontSize: 13, color: "#7B8E8A", marginBottom: 14 }}>
        On desktop: W A S D or arrows to walk, drag the mouse to look around. On phone: use the arrows below to walk, drag the view to look around.
      </div>
      <div ref={mountRef} style={{ width: "100%", height: 560, position: "relative", borderRadius: 12, overflow: "hidden", background: "#F7F9F8", border: "1px solid #E1E8E5" }}>
        {!ready && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#8A9694", fontSize: 13.5 }}>Loading 3D map…</div>}
        {ready && (
          <div style={{ position: "absolute", bottom: 14, left: 14, display: "grid", gridTemplateColumns: "52px 52px 52px", gridTemplateRows: "52px 52px", gap: 6, zIndex: 5 }}>
            <div />
            <div
              style={padBtnStyle}
              onTouchStart={(e) => { e.preventDefault(); press("w", true); }}
              onTouchEnd={(e) => { e.preventDefault(); press("w", false); }}
              onMouseDown={() => press("w", true)}
              onMouseUp={() => press("w", false)}
              onMouseLeave={() => press("w", false)}
            >↑</div>
            <div />
            <div
              style={padBtnStyle}
              onTouchStart={(e) => { e.preventDefault(); press("a", true); }}
              onTouchEnd={(e) => { e.preventDefault(); press("a", false); }}
              onMouseDown={() => press("a", true)}
              onMouseUp={() => press("a", false)}
              onMouseLeave={() => press("a", false)}
            >←</div>
            <div
              style={padBtnStyle}
              onTouchStart={(e) => { e.preventDefault(); press("s", true); }}
              onTouchEnd={(e) => { e.preventDefault(); press("s", false); }}
              onMouseDown={() => press("s", true)}
              onMouseUp={() => press("s", false)}
              onMouseLeave={() => press("s", false)}
            >↓</div>
            <div
              style={padBtnStyle}
              onTouchStart={(e) => { e.preventDefault(); press("d", true); }}
              onTouchEnd={(e) => { e.preventDefault(); press("d", false); }}
              onMouseDown={() => press("d", true)}
              onMouseUp={() => press("d", false)}
              onMouseLeave={() => press("d", false)}
            >→</div>
          </div>
        )}
      </div>
      <div style={{ marginTop: 8, fontSize: 14, fontWeight: 600, minHeight: 20 }}>{label}</div>
    </div>
  );
}
