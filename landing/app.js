import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

/* ============================================
   Suprlan LK — 3D Scroll Animation v6
   Production: hardcoded settings, 5 info cards
   ============================================ */

let lidMesh, baseMesh;
let lidAssembledY = 0;
let lidSeparatedY = 0;

// ---- User-tuned values (from debug panel) ----
const LID_OFFSET = -21.5;
const LID_ROT = THREE.MathUtils.degToRad(-180);
const BASE_ROT = THREE.MathUtils.degToRad(-48);
const SEPARATION = 55;
const BAYONET_ANGLE = THREE.MathUtils.degToRad(25);
const TILT_ANGLE = THREE.MathUtils.degToRad(21);

// ---- Color presets ----
const COLORS = {
    white: { lid: 0xf5f0e8, base: 0xe8e4dc },
    black: { lid: 0x2a2a32, base: 0x1e1e26 },
};
let currentColor = 'white';

let camStartPos, camSidePos, camTarget;

// ---- Scene ----
const container = document.getElementById('three-container');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 5000);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x0a0a0f, 1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;
container.appendChild(renderer.domElement);

// ---- Environment ----
const pmremGenerator = new THREE.PMREMGenerator(renderer);
const envScene = new THREE.Scene();
const envGeo = new THREE.SphereGeometry(100, 32, 32);
envScene.add(new THREE.Mesh(envGeo, new THREE.MeshBasicMaterial({ color: 0x222233, side: THREE.BackSide })));
envScene.add(new THREE.AmbientLight(0xffffff, 0.5));
const envPt = new THREE.PointLight(0x8899cc, 1.5, 200);
envPt.position.set(0, 80, 0);
envScene.add(envPt);
scene.environment = pmremGenerator.fromScene(envScene, 0.04).texture;
pmremGenerator.dispose();

// ---- Lights ----
scene.add(new THREE.AmbientLight(0xffffff, 0.6));

const mainLight = new THREE.DirectionalLight(0xffffff, 1.5);
mainLight.position.set(150, 200, 250);
mainLight.castShadow = true;
mainLight.shadow.mapSize.set(2048, 2048);
mainLight.shadow.camera.near = 10;
mainLight.shadow.camera.far = 800;
mainLight.shadow.camera.left = -150;
mainLight.shadow.camera.right = 150;
mainLight.shadow.camera.top = 150;
mainLight.shadow.camera.bottom = -150;
mainLight.shadow.bias = -0.001;
mainLight.shadow.radius = 6;
scene.add(mainLight);

const fillLight = new THREE.DirectionalLight(0x8899bb, 0.5);
fillLight.position.set(-120, 80, -100);
scene.add(fillLight);

const backLight = new THREE.DirectionalLight(0xff6666, 0.3);
backLight.position.set(0, -60, -200);
scene.add(backLight);

const accentLight = new THREE.PointLight(0xe63946, 0.3, 400);
accentLight.position.set(60, 30, 120);
scene.add(accentLight);

// ---- Materials (ABS Plastic) ----
const lidMat = new THREE.MeshPhysicalMaterial({
    color: COLORS.white.lid,
    roughness: 0.45,
    metalness: 0.0,
    clearcoat: 0.3,
    clearcoatRoughness: 0.4,
    reflectivity: 0.5,
    envMapIntensity: 0.8,
});

const baseMat = new THREE.MeshPhysicalMaterial({
    color: COLORS.white.base,
    roughness: 0.4,
    metalness: 0.0,
    clearcoat: 0.4,
    clearcoatRoughness: 0.35,
    reflectivity: 0.6,
    envMapIntensity: 1.0,
});

// ---- Model ----
const modelGroup = new THREE.Group();
scene.add(modelGroup);

// ---- Controls ----
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enableZoom = false;
controls.enablePan = false;
controls.enableRotate = false;

// ---- Load STL ----
const stlLoader = new STLLoader();
let loadedCount = 0;

function smoothGeo(geo) {
    geo.computeBoundingBox();
    const c = new THREE.Vector3();
    geo.boundingBox.getCenter(c);
    geo.translate(-c.x, -c.y, -c.z);
    const merged = mergeVertices(geo, 0.1);
    merged.computeVertexNormals();
    merged.computeBoundingBox();
    return merged;
}

function onBothLoaded() {
    loadedCount++;
    if (loadedCount < 2) return;

    const lidBox = new THREE.Box3().setFromObject(lidMesh);
    const baseBox = new THREE.Box3().setFromObject(baseMesh);
    const lidH = lidBox.max.y - lidBox.min.y;
    const baseH = baseBox.max.y - baseBox.min.y;

    baseMesh.position.y = 0;

    // Ground shadow
    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(500, 500),
        new THREE.ShadowMaterial({ opacity: 0.2 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -(baseH / 2) - 2;
    ground.receiveShadow = true;
    modelGroup.add(ground);

    // Position
    lidAssembledY = baseH / 2 + lidH / 2 + LID_OFFSET;
    lidSeparatedY = lidAssembledY + SEPARATION;
    lidMesh.position.y = lidAssembledY;
    lidMesh.rotation.y = BAYONET_ANGLE + LID_ROT;
    baseMesh.rotation.y = BASE_ROT;

    // Camera
    const span = Math.max(
        lidBox.max.x - lidBox.min.x, lidBox.max.z - lidBox.min.z,
        baseBox.max.x - baseBox.min.x, baseBox.max.z - baseBox.min.z
    );

    camTarget = new THREE.Vector3(0, lidAssembledY * 0.4, 0);
    camStartPos = new THREE.Vector3(span * 0.3, span * 1.8, span * 1.2);
    camSidePos = new THREE.Vector3(0, span * 0.6, span * 2.2);

    camera.position.copy(camStartPos);
    camera.lookAt(camTarget);
    controls.target.copy(camTarget);
    controls.update();

    // Hide loader
    const loaderEl = document.getElementById('loader');
    if (loaderEl) {
        loaderEl.style.opacity = '0';
        setTimeout(() => loaderEl.remove(), 600);
    }

    setupScrollAnimation();
    setupColorSwitcher();
}

stlLoader.load('./lid.stl', (geo) => {
    lidMesh = new THREE.Mesh(smoothGeo(geo), lidMat);
    lidMesh.castShadow = true;
    lidMesh.receiveShadow = true;
    modelGroup.add(lidMesh);
    onBothLoaded();
}, undefined, (err) => {
    console.error('Lid error:', err);
});

stlLoader.load('./base.stl', (geo) => {
    baseMesh = new THREE.Mesh(smoothGeo(geo), baseMat);
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    modelGroup.add(baseMesh);
    onBothLoaded();
}, undefined, (err) => {
    console.error('Base error:', err);
});

// ---- Scroll Animation ----
function setupScrollAnimation() {
    gsap.registerPlugin(ScrollTrigger);

    const modelSection = document.getElementById('model-section');
    const progBar = document.getElementById('progress-bar');
    const progFill = document.getElementById('progress-fill');

    ScrollTrigger.create({
        trigger: modelSection,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 1,
        onUpdate(self) {
            const p = self.progress;
            if (!lidMesh || !baseMesh) return;

            // --- Camera (0% → 20%) ---
            if (p <= 0.2) {
                const t = p / 0.2;
                const s = t * t * (3 - 2 * t);
                camera.position.lerpVectors(camStartPos, camSidePos, s);
                camera.lookAt(camTarget);

                lidMesh.position.y = lidAssembledY;
                lidMesh.rotation.y = BAYONET_ANGLE + LID_ROT;
                lidMesh.rotation.x = 0;
                baseMesh.rotation.y = BASE_ROT;
                baseMesh.rotation.x = 0;
            }

            // --- Bayonet (20% → 40%) ---
            if (p > 0.2 && p <= 0.4) {
                camera.position.copy(camSidePos);
                camera.lookAt(camTarget);
                const r = (p - 0.2) / 0.2;
                lidMesh.rotation.y = THREE.MathUtils.lerp(BAYONET_ANGLE + LID_ROT, LID_ROT, r);
                lidMesh.position.y = lidAssembledY;
                lidMesh.rotation.x = 0;
                baseMesh.rotation.y = BASE_ROT;
                baseMesh.rotation.x = 0;
            }

            // --- Lift (40% → 75%) ---
            if (p > 0.4 && p <= 0.75) {
                camera.position.copy(camSidePos);
                camera.lookAt(camTarget);
                const l = (p - 0.4) / 0.35;
                lidMesh.rotation.y = LID_ROT;
                lidMesh.position.y = THREE.MathUtils.lerp(lidAssembledY, lidSeparatedY, l);
            }

            // --- Keep separated ---
            if (p > 0.75) {
                camera.position.copy(camSidePos);
                camera.lookAt(camTarget);
                lidMesh.rotation.y = LID_ROT;
                lidMesh.position.y = lidSeparatedY;
            }

            // --- Tilt (55% → 85%) ---
            if (p <= 0.55) {
                lidMesh.rotation.x = 0;
                baseMesh.rotation.x = 0;
            } else if (p <= 0.85) {
                const tp = (p - 0.55) / 0.3;
                lidMesh.rotation.x = THREE.MathUtils.lerp(0, -TILT_ANGLE, tp);
                baseMesh.rotation.x = THREE.MathUtils.lerp(0, TILT_ANGLE * 0.5, tp);
            } else {
                lidMesh.rotation.x = -TILT_ANGLE;
                baseMesh.rotation.x = TILT_ANGLE * 0.5;
            }

            // Progress
            if (progFill) progFill.style.width = (p * 100) + '%';
        },
        onEnter() { progBar?.classList.add('visible'); controls.enableRotate = false; },
        onLeave() { progBar?.classList.remove('visible'); controls.enableRotate = true; },
        onEnterBack() { progBar?.classList.add('visible'); controls.enableRotate = false; },
        onLeaveBack() { progBar?.classList.remove('visible'); controls.enableRotate = true; },
    });

    // Scroll-through info cards — animate each when it enters viewport
    document.querySelectorAll('.scroll-card-inner').forEach((card) => {
        gsap.fromTo(card,
            { opacity: 0, y: 50 },
            {
                opacity: 1, y: 0, duration: 0.8,
                scrollTrigger: {
                    trigger: card,
                    start: 'top 85%',
                    end: 'top 30%',
                    toggleActions: 'play reverse play reverse',
                },
            }
        );
    });

    // Feature cards
    document.querySelectorAll('.feature-card').forEach((card, i) => {
        gsap.from(card, {
            scrollTrigger: { trigger: card, start: 'top 85%', toggleActions: 'play none none reverse' },
            y: 60, opacity: 0, duration: 0.6, delay: i * 0.1,
        });
    });

    // Spec rows
    document.querySelectorAll('.specs-table tr').forEach((row, i) => {
        gsap.from(row, {
            scrollTrigger: { trigger: row, start: 'top 90%', toggleActions: 'play none none reverse' },
            x: -30, opacity: 0, duration: 0.4, delay: i * 0.08,
        });
    });

    // Cert cards
    document.querySelectorAll('.cert-card').forEach((card, i) => {
        gsap.from(card, {
            scrollTrigger: { trigger: card, start: 'top 85%', toggleActions: 'play none none reverse' },
            y: 40, opacity: 0, duration: 0.5, delay: i * 0.15,
        });
    });
}

// ---- Color Switcher ----
function setupColorSwitcher() {
    document.querySelectorAll('.color-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const color = btn.dataset.color;
            if (color === currentColor) return;
            currentColor = color;

            // Update materials
            const preset = COLORS[color];
            gsap.to(lidMat.color, { r: new THREE.Color(preset.lid).r, g: new THREE.Color(preset.lid).g, b: new THREE.Color(preset.lid).b, duration: 0.6 });
            gsap.to(baseMat.color, { r: new THREE.Color(preset.base).r, g: new THREE.Color(preset.base).g, b: new THREE.Color(preset.base).b, duration: 0.6 });

            // Update buttons
            document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
}

// ---- Post-Processing ----
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.12, 0.5, 0.9
);
composer.addPass(bloom);

// ---- Render ----
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    composer.render();
}
animate();

// ---- Resize ----
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});
