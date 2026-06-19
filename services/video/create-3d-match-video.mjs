import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(new URL("../..", import.meta.url).pathname);
const presetsPath = resolve(root, "outputs/watchalong-kit/match-presets.js");
const outputDir = resolve(root, "outputs/3d-videos");
const runtimeDir = resolve(root, "outputs/runtime/3d-match");
const vendorDir = resolve(root, "outputs/runtime/vendor");
const streamId = process.env.STREAM_ID || process.argv[2] || "mex-rsa";
const fps = Number(process.env.THREE_D_VIDEO_FPS || 4);
const duration = Number(process.env.THREE_D_VIDEO_SECONDS || 22);
const voice = process.env.THREE_D_VIDEO_VOICE || "Alex";
const chromePath = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const threeUrl = "https://unpkg.com/three@0.160.0/build/three.module.js";
const threePath = resolve(vendorDir, "three.module.js");

const extraPresets = [
  {
    id: "mex-rsa",
    kickoffIst: "12:30 AM IST, Friday June 12",
    kickoffUtc: "2026-06-11T19:00:00Z",
    home: "MEXICO",
    away: "SOUTH AFRICA",
    homeShort: "MEX",
    awayShort: "RSA",
    homeColor: "#006847",
    awayColor: "#ffb81c",
    topic: "Mexico's historic home opener, South Africa's pressure-breaking counters, Group A momentum",
    keyBattle: "Mexico's wide pressure vs South Africa's transition runs through midfield",
    gamePulse: "Mexico pushed the tempo at the Azteca; South Africa tried to break out quickly under heavy pressure",
    finalScore: { home: 2, away: 0 }
  }
];

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`${command} failed\n${result.stdout || ""}\n${result.stderr || ""}`.trim());
  }
  return result;
}

function loadPresets(source) {
  const fn = new Function("window", `${source}; return window.MATCH_PRESETS || [];`);
  return fn({});
}

function escapeText(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}

function metadata(match) {
  const script = [
    `${match.home} versus ${match.away}, cinematic 3D match simulation from Kickoff Room Live.`,
    "This is original 3D animation only. No official footage. No broadcast audio.",
    "The camera drops into the stadium, the midfield press opens space, and the attack finishes across goal.",
    `Key battle: ${match.keyBattle}.`,
    "Use this as a safe football recap style, not as official match footage."
  ].join(" ");
  return {
    script,
    title: `${match.home} vs ${match.away} Realistic 3D Match Simulation | No Footage`,
    description: [
      `${match.home} vs ${match.away} original 3D football match simulation.`,
      "",
      "Original 3D animation only. No official footage. No broadcast audio.",
      "Made for Kickoff Room Live."
    ].join("\n")
  };
}

function sceneHtml(match) {
  const finalHome = match.finalScore?.home ?? 1;
  const finalAway = match.finalScore?.away ?? 0;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>3D Match Simulation</title>
    <style>
      html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: #020611; }
      canvas { display: block; width: 100vw; height: 100vh; }
      .hud {
        position: fixed;
        inset: 0;
        pointer-events: none;
        font-family: Arial Black, Arial, sans-serif;
        color: #fff;
      }
      .score {
        position: absolute;
        left: 48px;
        top: 34px;
        min-width: 590px;
        padding: 20px 28px;
        border-radius: 14px;
        background: rgba(3, 7, 18, 0.88);
        border: 1px solid rgba(255,255,255,0.2);
        box-shadow: 0 24px 80px rgba(0,0,0,0.48);
      }
      .score small {
        display: block;
        color: #21d4a3;
        font-size: 20px;
        letter-spacing: 0;
      }
      .score strong {
        display: block;
        margin-top: 4px;
        font-size: 42px;
        line-height: 1;
      }
      .topline {
        position: absolute;
        right: 48px;
        top: 34px;
        width: 870px;
        padding: 18px 26px;
        border-radius: 14px;
        background: rgba(3, 7, 18, 0.72);
        border: 1px solid rgba(255,255,255,0.16);
        box-shadow: 0 24px 80px rgba(0,0,0,0.42);
      }
      .topline strong {
        display: block;
        font-size: 34px;
      }
      .topline span {
        display: block;
        margin-top: 5px;
        color: #d8e1f2;
        font-family: Arial, sans-serif;
        font-size: 26px;
        font-weight: 800;
      }
      .bottom {
        position: absolute;
        left: 48px;
        right: 48px;
        bottom: 34px;
        display: flex;
        justify-content: space-between;
        align-items: end;
      }
      .caption {
        max-width: 1180px;
        padding: 22px 28px;
        border-radius: 14px;
        background: rgba(3, 7, 18, 0.76);
        border: 1px solid rgba(255,255,255,0.14);
      }
      .caption strong {
        display: block;
        color: #ffbf3f;
        font-size: 42px;
      }
      .caption span {
        display: block;
        margin-top: 7px;
        color: #d8e1f2;
        font-family: Arial, sans-serif;
        font-size: 25px;
        font-weight: 800;
      }
      .brand {
        color: #21d4a3;
        font-size: 34px;
        text-shadow: 0 10px 34px rgba(0,0,0,0.65);
      }
    </style>
  </head>
  <body>
    <div class="hud">
      <div class="score">
        <small>ORIGINAL 3D SIMULATION</small>
        <strong id="scoreline">${match.homeShort} 0 - 0 ${match.awayShort}</strong>
      </div>
      <div class="topline">
        <strong>${escapeText(match.home)} vs ${escapeText(match.away)}</strong>
        <span>No official footage. No broadcast audio.</span>
      </div>
      <div class="bottom">
        <div class="caption">
          <strong id="action">Stadium camera locked in</strong>
          <span>${escapeText(match.gamePulse)}</span>
        </div>
        <div class="brand">KICKOFF ROOM LIVE</div>
      </div>
    </div>
    <script type="module">
      import * as THREE from '../vendor/three.module.js';

      const frame = Number(new URLSearchParams(location.search).get('frame') || 0);
      const fps = Number(new URLSearchParams(location.search).get('fps') || ${fps});
      const duration = ${duration};
      const t = frame / fps;
      const progress = Math.min(1, Math.max(0, t / duration));
      const homeColor = new THREE.Color('${match.homeColor}');
      const awayColor = new THREE.Color('${match.awayColor}');
      const finalHome = ${finalHome};
      const finalAway = ${finalAway};
      const scoreHome = t > 18 ? finalHome : t > 14 ? Math.min(1, finalHome) : 0;
      const scoreAway = t > 18 ? finalAway : 0;
      document.getElementById('scoreline').textContent = '${match.homeShort} ' + scoreHome + ' - ' + scoreAway + ' ${match.awayShort}';
      document.getElementById('action').textContent = t < 4 ? 'Walkout atmosphere before kickoff' : t < 9 ? 'Midfield pressure opens the lane' : t < 14 ? 'Forward run breaks behind the line' : t < 18 ? 'Shot across goal, keeper stretches' : 'Goal moment in 3D replay style';

      const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      renderer.setSize(1920, 1080);
      renderer.setPixelRatio(1);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.setClearColor(0x020611, 1);
      document.body.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      scene.fog = new THREE.Fog(0x07101f, 38, 118);

      const camera = new THREE.PerspectiveCamera(32, 1920 / 1080, 0.1, 220);
      scene.add(camera);

      const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x07101f, 0.42);
      scene.add(hemi);

      const stadiumLight = new THREE.DirectionalLight(0xffffff, 3.2);
      stadiumLight.position.set(-22, 34, 18);
      stadiumLight.castShadow = true;
      stadiumLight.shadow.mapSize.width = 2048;
      stadiumLight.shadow.mapSize.height = 2048;
      stadiumLight.shadow.camera.near = 1;
      stadiumLight.shadow.camera.far = 100;
      stadiumLight.shadow.camera.left = -44;
      stadiumLight.shadow.camera.right = 44;
      stadiumLight.shadow.camera.top = 34;
      stadiumLight.shadow.camera.bottom = -34;
      scene.add(stadiumLight);

      const fillLight = new THREE.PointLight(0x21d4a3, 1.8, 70);
      fillLight.position.set(20, 24, -20);
      scene.add(fillLight);

      function mat(color, roughness = 0.55, metalness = 0.02) {
        return new THREE.MeshStandardMaterial({ color, roughness, metalness });
      }

      const grass = mat(0x0a4d36, 0.92);
      const stripeA = mat(0x0c6044, 0.94);
      const stripeB = mat(0x073d2d, 0.94);
      const white = mat(0xf7fbff, 0.45);
      const dark = mat(0x050814, 0.78);
      const gold = mat(0xffbf3f, 0.35);
      const homeMat = mat(homeColor, 0.48);
      const awayMat = mat(awayColor, 0.48);
      const skinMat = mat(0xeec19b, 0.55);
      const shortsMat = mat(0xf8fafc, 0.5);
      const bootMat = mat(0x050505, 0.45);

      const pitch = new THREE.Group();
      scene.add(pitch);

      const pitchBase = new THREE.Mesh(new THREE.BoxGeometry(72, 0.26, 46), grass);
      pitchBase.position.y = -0.14;
      pitchBase.receiveShadow = true;
      pitch.add(pitchBase);

      for (let i = 0; i < 9; i += 1) {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(8, 0.04, 45.7), i % 2 ? stripeA : stripeB);
        stripe.position.set(-32 + i * 8, 0.02, 0);
        stripe.receiveShadow = true;
        pitch.add(stripe);
      }
      const grassLineMat = new THREE.MeshBasicMaterial({ color: 0xcdebd6, transparent: true, opacity: 0.06 });
      for (let i = 0; i < 90; i += 1) {
        const blade = new THREE.Mesh(new THREE.PlaneGeometry(0.028, 3.6), grassLineMat);
        blade.position.set(-35 + (i % 30) * 2.4, 0.105, -21 + Math.floor(i / 30) * 14);
        blade.rotation.x = -Math.PI / 2;
        blade.rotation.z = (i % 5) * 0.11;
        pitch.add(blade);
      }

      function lineBox(w, d, x, z) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), white);
        mesh.position.set(x, 0.08, z);
        pitch.add(mesh);
      }

      lineBox(72, 0.18, 0, -23);
      lineBox(72, 0.18, 0, 23);
      lineBox(0.18, 46, -36, 0);
      lineBox(0.18, 46, 36, 0);
      lineBox(0.16, 46, 0, 0);
      lineBox(12, 0.16, -30, -10);
      lineBox(12, 0.16, -30, 10);
      lineBox(0.16, 20, -24, 0);
      lineBox(12, 0.16, 30, -10);
      lineBox(12, 0.16, 30, 10);
      lineBox(0.16, 20, 24, 0);

      const centerRing = new THREE.Mesh(new THREE.TorusGeometry(5.2, 0.08, 10, 96), white);
      centerRing.rotation.x = Math.PI / 2;
      centerRing.position.y = 0.12;
      pitch.add(centerRing);

      function goal(x, rot) {
        const group = new THREE.Group();
        const postMat = mat(0xffffff, 0.35);
        const backMat = new THREE.MeshStandardMaterial({ color: 0xffffff, opacity: 0.18, transparent: true, roughness: 0.7 });
        const postGeom = new THREE.CylinderGeometry(0.08, 0.08, 4.2, 16);
        const crossGeom = new THREE.CylinderGeometry(0.08, 0.08, 10, 16);
        const left = new THREE.Mesh(postGeom, postMat);
        const right = new THREE.Mesh(postGeom, postMat);
        const cross = new THREE.Mesh(crossGeom, postMat);
        left.position.set(0, 2.1, -5);
        right.position.set(0, 2.1, 5);
        cross.position.set(0, 4.2, 0);
        cross.rotation.x = Math.PI / 2;
        const net = new THREE.Mesh(new THREE.BoxGeometry(3, 3.8, 10), backMat);
        net.position.set(rot > 0 ? -1.5 : 1.5, 2, 0);
        group.add(left, right, cross, net);
        group.position.set(x, 0, 0);
        scene.add(group);
      }
      goal(-36, 1);
      goal(36, -1);

      function addPlayer(teamMat, x, z, number, scale = 1) {
        const g = new THREE.Group();
        const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.54 * scale, 0.72 * scale, 1.36 * scale, 18), teamMat);
        torso.position.y = 2.48 * scale;
        torso.castShadow = true;
        const chest = new THREE.Mesh(new THREE.BoxGeometry(1.38 * scale, 0.28 * scale, 0.56 * scale), teamMat);
        chest.position.y = 3.08 * scale;
        chest.castShadow = true;
        const shorts = new THREE.Mesh(new THREE.BoxGeometry(1.18 * scale, 0.46 * scale, 0.68 * scale), shortsMat);
        shorts.position.y = 1.68 * scale;
        shorts.castShadow = true;
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.58 * scale, 24, 16), skinMat);
        head.position.y = 3.84 * scale;
        head.castShadow = true;
        const hair = new THREE.Mesh(new THREE.SphereGeometry(0.6 * scale, 24, 8, 0, Math.PI * 2, 0, Math.PI * 0.48), dark);
        hair.position.y = 4.11 * scale;
        hair.castShadow = true;
        const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * scale, 0.2 * scale, 0.28 * scale, 12), skinMat);
        neck.position.y = 3.38 * scale;
        neck.castShadow = true;
        const armGeom = new THREE.CapsuleGeometry(0.11 * scale, 1.22 * scale, 4, 10);
        const arm1 = new THREE.Mesh(armGeom, skinMat);
        const arm2 = new THREE.Mesh(armGeom, skinMat);
        arm1.position.set(-0.87 * scale, 2.52 * scale, 0);
        arm2.position.set(0.87 * scale, 2.52 * scale, 0);
        arm1.rotation.z = 0.24;
        arm2.rotation.z = -0.24;
        arm1.castShadow = true;
        arm2.castShadow = true;
        const legGeom = new THREE.CapsuleGeometry(0.13 * scale, 1.2 * scale, 4, 10);
        const leg1 = new THREE.Mesh(legGeom, shortsMat);
        const leg2 = new THREE.Mesh(legGeom, shortsMat);
        leg1.position.set(-0.27 * scale, 0.98 * scale, 0);
        leg2.position.set(0.27 * scale, 0.98 * scale, 0);
        leg1.rotation.z = 0.12;
        leg2.rotation.z = -0.12;
        leg1.castShadow = true;
        leg2.castShadow = true;
        const boot1 = new THREE.Mesh(new THREE.BoxGeometry(0.36 * scale, 0.13 * scale, 0.66 * scale), bootMat);
        const boot2 = boot1.clone();
        boot1.position.set(-0.32 * scale, 0.27 * scale, -0.16 * scale);
        boot2.position.set(0.32 * scale, 0.27 * scale, -0.16 * scale);
        boot1.castShadow = true;
        boot2.castShadow = true;
        g.add(torso, chest, shorts, neck, head, hair, arm1, arm2, leg1, leg2, boot1, boot2);
        g.position.set(x, 0, z);
        g.userData.base = { x, z, number };
        scene.add(g);
        return g;
      }

      const players = [
        addPlayer(homeMat, -19, -7, 4, 1.08),
        addPlayer(homeMat, -8, 4, 8, 1.14),
        addPlayer(homeMat, 2, -3, 10, 1.2),
        addPlayer(homeMat, 14, 8, 9, 1.17),
        addPlayer(awayMat, -4, 12, 5, 1.08),
        addPlayer(awayMat, 7, 4, 6, 1.08),
        addPlayer(awayMat, 18, -8, 3, 1.1),
        addPlayer(awayMat, 25, 10, 2, 1.06),
        addPlayer(mat(0xff5a36), 31, 0, 1, 1.18),
        addPlayer(mat(0xff5a36), -31, 0, 1, 1.18)
      ];

      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.44, 32, 18), mat(0xf8fafc, 0.28));
      ball.castShadow = true;
      scene.add(ball);

      const path = [
        new THREE.Vector3(-10, 0.55, 4),
        new THREE.Vector3(1, 0.85, -2),
        new THREE.Vector3(13, 1.2, -7),
        new THREE.Vector3(26, 1.0, -1),
        new THREE.Vector3(33, 1.7, 2)
      ];

      function smooth(x) {
        x = Math.max(0, Math.min(1, x));
        return x * x * (3 - 2 * x);
      }

      function pathPoint(localT) {
        const total = path.length - 1;
        const f = Math.min(total - 0.0001, Math.max(0, localT * total));
        const i = Math.floor(f);
        const p = smooth(f - i);
        return path[i].clone().lerp(path[i + 1], p);
      }

      function updatePlayers() {
        const move = smooth(Math.max(0, Math.min(1, (t - 4) / 13)));
        players[1].position.x = -8 + move * 8;
        players[1].position.z = 4 - move * 3;
        players[2].position.x = 2 + move * 8;
        players[2].position.z = -3 - move * 3;
        players[3].position.x = 14 + move * 9;
        players[3].position.z = 8 - move * 8;
        players[6].position.x = 18 + move * 4;
        players[6].position.z = -8 + move * 5;
        players[8].position.x = 31 + smooth(Math.max(0, Math.min(1, (t - 14) / 6))) * 1.2;
        players.forEach((p, index) => {
          p.rotation.y = Math.sin(t * 0.7 + index) * 0.18 + (index < 4 ? -0.2 : 0.24);
          p.position.y = Math.abs(Math.sin(t * 2.4 + index)) * 0.05;
        });
      }

      function addStadium() {
        const standMat = mat(0x111827, 0.72);
        const crowdMats = [homeMat, awayMat, white, gold, mat(0x21d4a3)];
        const stand1 = new THREE.Mesh(new THREE.BoxGeometry(84, 5, 10), standMat);
        stand1.position.set(0, 3, -33);
        const stand2 = stand1.clone();
        stand2.position.z = 33;
        scene.add(stand1, stand2);
        for (let side of [-1, 1]) {
          for (let row = 0; row < 4; row += 1) {
            for (let i = 0; i < 44; i += 1) {
              const dot = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), crowdMats[(i + row) % crowdMats.length]);
              dot.position.set(-40 + i * 1.85, 5.6 + row * 0.72, side * (29.8 + row * 0.75));
              scene.add(dot);
            }
          }
        }
      }
      addStadium();

      function addBoard(text, x, z, color) {
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#050814';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = color;
        ctx.font = '900 54px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);
        const texture = new THREE.CanvasTexture(canvas);
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(14, 1.75), new THREE.MeshBasicMaterial({ map: texture }));
        mesh.position.set(x, 2.2, z);
        mesh.rotation.x = -0.06;
        scene.add(mesh);
      }
      addBoard('NO OFFICIAL FOOTAGE', -18, -24.4, '#21d4a3');
      addBoard('KICKOFF ROOM LIVE', 18, -24.4, '#ffbf3f');

      updatePlayers();
      const actionT = Math.max(0, Math.min(1, (t - 3) / 17));
      ball.position.copy(pathPoint(actionT));
      ball.position.y += Math.sin(actionT * Math.PI * 3) * 1.15;
      ball.rotation.x = t * 7;
      ball.rotation.z = t * 5;

      const intro = Math.max(0, Math.min(1, t / 4));
      const camStart = new THREE.Vector3(-10, 15, 33);
      const camEnd = new THREE.Vector3(3 + progress * 20, 9.8 - progress * 1.6, 30 - progress * 12);
      camera.position.copy(camStart.lerp(camEnd, smooth(intro)));
      camera.lookAt(new THREE.Vector3(10 + progress * 16, 2.4, -1 + progress * 2));

      renderer.render(scene, camera);
      window.__READY = true;
    </script>
  </body>
</html>`;
}

async function ensureThree() {
  await mkdir(vendorDir, { recursive: true });
  if (existsSync(threePath)) return;
  run("curl", ["-L", "-sS", threeUrl, "-o", threePath, "--max-time", "60"]);
}

async function exportFrames(scenePath, frameDir) {
  const frameCount = Math.round(duration * fps);
  await rm(frameDir, { recursive: true, force: true });
  await mkdir(frameDir, { recursive: true });
  for (let index = 0; index < frameCount; index += 1) {
    const pngPath = resolve(frameDir, `frame-${String(index + 1).padStart(5, "0")}.png`);
    run(chromePath, [
      "--headless=new",
      "--disable-gpu",
      "--enable-unsafe-swiftshader",
      "--use-gl=swiftshader",
      "--allow-file-access-from-files",
      "--hide-scrollbars",
      "--run-all-compositor-stages-before-draw",
      "--virtual-time-budget=3500",
      `--screenshot=${pngPath}`,
      "--window-size=1920,1080",
      `file://${scenePath}?frame=${index}&fps=${fps}`
    ]);
  }
}

await mkdir(outputDir, { recursive: true });
await mkdir(runtimeDir, { recursive: true });
await ensureThree();

const presets = [...extraPresets, ...loadPresets(await readFile(presetsPath, "utf8"))];
const match = presets.find((item) => item.id === streamId) || presets[0];
if (!match) throw new Error(`No match preset found for ${streamId}`);

const base = resolve(outputDir, `${match.id}-3d-match`);
const frameDir = resolve(runtimeDir, match.id);
const scenePath = resolve(runtimeDir, `${match.id}-scene.html`);
const voicePath = `${base}.aiff`;
const videoPath = `${base}.mp4`;
const coverPath = `${base}-cover.jpg`;
const metaPath = `${base}.json`;
const meta = metadata(match);

await writeFile(scenePath, sceneHtml(match));
await exportFrames(scenePath, frameDir);

run("say", ["-v", voice, "-r", "169", "-o", voicePath, meta.script]);
await rm(videoPath, { force: true });
run("ffmpeg", [
  "-y",
  "-framerate", String(fps),
  "-i", resolve(frameDir, "frame-%05d.png"),
  "-i", voicePath,
  "-vf", "minterpolate=fps=30:mi_mode=blend,scale=1920:1080,format=yuv420p",
  "-filter:a", "volume=1.12",
  "-c:v", "libx264",
  "-preset", "medium",
  "-crf", "18",
  "-pix_fmt", "yuv420p",
  "-profile:v", "high",
  "-c:a", "aac",
  "-b:a", "160k",
  "-movflags", "+faststart",
  "-shortest",
  videoPath
]);

run("ffmpeg", [
  "-y",
  "-ss", "00:00:10",
  "-i", videoPath,
  "-frames:v", "1",
  "-update", "1",
  coverPath
]);

if (!existsSync(videoPath)) throw new Error(`Missing generated video: ${videoPath}`);

await writeFile(metaPath, `${JSON.stringify({
  id: match.id,
  match: `${match.home} vs ${match.away}`,
  title: meta.title,
  description: meta.description,
  videoPath,
  coverPath,
  voicePath,
  scenePath,
  frameSource: frameDir,
  renderer: "Three.js WebGL",
  safeUse: "Original 3D simulation only. Do not represent it as official footage or add broadcast audio."
}, null, 2)}\n`);

console.log(JSON.stringify({
  ok: true,
  id: match.id,
  match: `${match.home} vs ${match.away}`,
  videoPath,
  coverPath,
  metaPath
}, null, 2));
