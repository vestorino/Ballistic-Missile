import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import GUI from 'lil-gui';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass';
import { Sky } from 'three/examples/jsm/objects/Sky';

let scene, camera, renderer, missile, clock, composer;
let phase = "boost";
let followOffset = new THREE.Vector3(0, 5, -15);
let cameraMode = "overview";
let boostEnded = false;
let particleSystem, explosionParticles;
let stars = [];
let clouds = [];
let timeOfDay = "day";
let lastImpactPosition = new THREE.Vector3();
let impactEffects = [];
let cameraShake = { active: false, intensity: 0, duration: 0, elapsed: 0 };

const phaseText = document.getElementById("phaseText");
const TARGET_TILT_ANGLE = THREE.MathUtils.degToRad(45); // tilt to 45° by end of boost

// === Init Scene ===
scene = new THREE.Scene();
// Dynamic sky will be added instead of static background
scene.fog = new THREE.FogExp2(0x87ceeb, 0.002); // Add atmospheric fog

camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 10, 30);

renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.5;
renderer.outputEncoding = THREE.sRGBEncoding;
document.body.appendChild(renderer.domElement);

// Post-processing setup
composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.5, 0.4, 0.85);
bloomPass.threshold = 0.21;
bloomPass.strength = 0.7;
bloomPass.radius = 0.55;
composer.addPass(bloomPass);

const outputPass = new OutputPass();
composer.addPass(outputPass);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// === Enhanced Lighting ===
const sunLight = new THREE.DirectionalLight(0xffffff, 1);
sunLight.position.set(10, 20, 10);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 500;
sunLight.shadow.camera.left = -50;
sunLight.shadow.camera.right = 50;
sunLight.shadow.camera.top = 50;
sunLight.shadow.camera.bottom = -50;
scene.add(sunLight);

const ambientLight = new THREE.AmbientLight(0x404040);
scene.add(ambientLight);

// Add a hemisphere light for more natural outdoor lighting
const hemisphereLight = new THREE.HemisphereLight(0xffffbb, 0x080820, 0.5);
scene.add(hemisphereLight);

// === Enhanced Ground ===
const groundGeometry = new THREE.PlaneGeometry(2000000, 20000000, 50, 50);
const groundMaterial = new THREE.MeshStandardMaterial({ 
  color: 0x228B22,
  roughness: 0.8,
  metalness: 0.2
});

// Add some displacement to make ground more interesting
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Add some ground details
const groundDetailTexture = new THREE.TextureLoader().load('https://threejs.org/examples/textures/terrain/grasslight-big.jpg');
groundDetailTexture.wrapS = groundDetailTexture.wrapT = THREE.RepeatWrapping;
groundDetailTexture.repeat.set(1, 1);

const groundDetailMaterial = new THREE.MeshStandardMaterial({
  map: groundDetailTexture,
  side: THREE.DoubleSide
});
// === Enhanced Launch Platform ===
const platformBase = new THREE.Mesh(
  new THREE.CylinderGeometry(3, 3, 0.5, 32),
  new THREE.MeshStandardMaterial({ 
    color: 0x333333,
    roughness: 0.8,
    metalness: 0.2
  })
);
platformBase.position.set(0, 0.25, 0);
platformBase.receiveShadow = true;
scene.add(platformBase);

// Main platform structure
const platformMain = new THREE.Mesh(
  new THREE.CylinderGeometry(2, 2, 1, 32),
  new THREE.MeshStandardMaterial({ 
    color: 0x555555,
    roughness: 0.7,
    metalness: 0.3
  })
);
platformMain.position.set(0, 1, 0);
platformMain.castShadow = true;
platformMain.receiveShadow = true;
scene.add(platformMain);

// Platform details
const platformDetail = new THREE.Mesh(
  new THREE.CylinderGeometry(1.8, 1.8, 0.2, 32),
  new THREE.MeshStandardMaterial({ 
    color: 0x444444,
    roughness: 0.6,
    metalness: 0.4
  })
);
platformDetail.position.set(0, 1.6, 0);
platformDetail.castShadow = true;
scene.add(platformDetail);

// Add support structures
const supportGeometry = new THREE.BoxGeometry(0.3, 2, 0.3);
const supportMaterial = new THREE.MeshStandardMaterial({ color: 0x777777 });
for (let i = 0; i < 4; i++) {
  const angle = (i / 4) * Math.PI * 2;
  const support = new THREE.Mesh(supportGeometry, supportMaterial);
  support.position.set(Math.cos(angle) * 2.5, 1, Math.sin(angle) * 2.5);
  support.rotation.y = angle;
  support.castShadow = true;
  scene.add(support);
}

// Add walkway
const walkway = new THREE.Mesh(
  new THREE.BoxGeometry(1, 0.1, 3),
  new THREE.MeshStandardMaterial({ color: 0x888888 })
);
walkway.position.set(0, 0.55, -4);
walkway.rotation.y = Math.PI / 4;
walkway.castShadow = true;
walkway.receiveShadow = true;
scene.add(walkway);

// Add warning stripes
const stripeMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
for (let i = 0; i < 3; i++) {
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 0.05, 0.3),
    stripeMaterial
  );
  stripe.position.set(0, 1.7, -1 + i * 1);
  scene.add(stripe);
}

// === Enhanced Missile ===
const missileGeometry = new THREE.CylinderGeometry(0.3, 0.3, 5, 32);
const missileMaterial = new THREE.MeshStandardMaterial({ 
  color: 0xff3333,
  metalness: 0.7,
  roughness: 0.3
});
missile = new THREE.Mesh(missileGeometry, missileMaterial);
missile.position.set(0, 3.5, 0);
missile.castShadow = true;
scene.add(missile);

// Add missile fins
const finGeometry = new THREE.ConeGeometry(0.4, 0.8, 4);
const finMaterial = new THREE.MeshStandardMaterial({ color: 0xaaaaaa });
for (let i = 0; i < 4; i++) {
  const fin = new THREE.Mesh(finGeometry, finMaterial);
  fin.rotation.y = i * Math.PI / 2;
  fin.position.y = -2;
  fin.castShadow = true;
  missile.add(fin);
}

// Add missile nose cone
const noseGeometry = new THREE.ConeGeometry(0.3, 1, 32);
const nose = new THREE.Mesh(noseGeometry, missileMaterial);
nose.position.y = 3;
missile.add(nose);

// Add enhanced exhaust flame during boost phase
const flameGeometry = new THREE.ConeGeometry(0.4, 1.5, 32);
const flameMaterial = new THREE.MeshStandardMaterial({ 
  color: 0xff6600,
  emissive: 0xff6600,
  emissiveIntensity: 2,
  transparent: true,
  opacity: 0.8
});
const flame = new THREE.Mesh(flameGeometry, flameMaterial);
flame.position.y = -3;
flame.rotation.x = Math.PI;
flame.visible = false;
missile.add(flame);

// Add particle system for exhaust
function createParticleSystem() {
  const particleCount = 500;
  const particles = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  const sizes = new Float32Array(particleCount);
  
  const color1 = new THREE.Color(0xff5500);
  const color2 = new THREE.Color(0xff9500);
  
  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = 0;
    positions[i * 3 + 1] = 0;
    positions[i * 3 + 2] = 0;
    
    const mixedColor = color1.clone().lerp(color2, Math.random());
    colors[i * 3] = mixedColor.r;
    colors[i * 3 + 1] = mixedColor.g;
    colors[i * 3 + 2] = mixedColor.b;
    
    sizes[i] = Math.random() * 0.5 + 0.1;
  }
  
  particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particles.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  particles.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  
  const particleMaterial = new THREE.PointsMaterial({
    size: 0.5,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  
  particleSystem = new THREE.Points(particles, particleMaterial);
  particleSystem.sortParticles = true;
  particleSystem.userData = {
    velocities: Array(particleCount).fill().map(() => new THREE.Vector3(
      (Math.random() - 0.5) * 0.3,
      -Math.random() * 2 - 1,
      (Math.random() - 0.5) * 0.3
    )),
    lifetimes: Array(particleCount).fill().map(() => Math.random() * 2)
  };
  
  scene.add(particleSystem);
}

createParticleSystem();

// Create explosion particles system
function createExplosionParticles() {
  const particleCount = 1000;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  const sizes = new Float32Array(particleCount);
  
  const color1 = new THREE.Color(0xff0000);
  const color2 = new THREE.Color(0xffff00);
  
  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = 0;
    positions[i * 3 + 1] = 0;
    positions[i * 3 + 2] = 0;
    
    const mixedColor = color1.clone().lerp(color2, Math.random());
    colors[i * 3] = mixedColor.r;
    colors[i * 3 + 1] = mixedColor.g;
    colors[i * 3 + 2] = mixedColor.b;
    
    sizes[i] = Math.random() * 2 + 0.5;
  }
  
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  
  const material = new THREE.PointsMaterial({
    size: 1,
    vertexColors: true,
    transparent: true,
    opacity: 1,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  
  explosionParticles = new THREE.Points(geometry, material);
  explosionParticles.visible = false;
  explosionParticles.userData = {
    velocities: Array(particleCount).fill().map(() => new THREE.Vector3(
      (Math.random() - 0.5) * 10,
      (Math.random() - 0.5) * 10,
      (Math.random() - 0.5) * 10
    )),
    active: false,
    lifetime: 3,
    elapsed: 0
  };
  
  scene.add(explosionParticles);
}

createExplosionParticles();

// === Enhanced Sky System ===
// Create dynamic sky
const sky = new Sky();
sky.scale.setScalar(450000);
scene.add(sky);

const sun = new THREE.Vector3();
const effectController = {
  turbidity: 10,
  rayleigh: 3,
  mieCoefficient: 0.005,
  mieDirectionalG: 0.7,
  elevation: 2,
  azimuth: 180,
  exposure: renderer.toneMappingExposure
};

function updateSky() {
  const uniforms = sky.material.uniforms;
  uniforms['turbidity'].value = effectController.turbidity;
  uniforms['rayleigh'].value = effectController.rayleigh;
  uniforms['mieCoefficient'].value = effectController.mieCoefficient;
  uniforms['mieDirectionalG'].value = effectController.mieDirectionalG;

  const phi = THREE.MathUtils.degToRad(90 - effectController.elevation);
  const theta = THREE.MathUtils.degToRad(effectController.azimuth);
  sun.setFromSphericalCoords(1, phi, theta);

  uniforms['sunPosition'].value.copy(sun);
  renderer.toneMappingExposure = effectController.exposure;
}

// Initialize sky
updateSky();

// Add stars for night sky
function createStars() {
  const starGeometry = new THREE.SphereGeometry(0.25, 8, 8);
  const starMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
  
  for (let i = 0; i < 1000; i++) {
    const star = new THREE.Mesh(starGeometry, starMaterial);
    const radius = 400;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    
    star.position.x = radius * Math.sin(phi) * Math.cos(theta);
    star.position.y = radius * Math.sin(phi) * Math.sin(theta);
    star.position.z = radius * Math.cos(phi);
    
    star.visible = timeOfDay === "night";
    stars.push(star);
    scene.add(star);
  }
}

createStars();

// Add clouds
function createClouds() {
  const cloudGeometry = new THREE.SphereGeometry(5, 8, 8);
  const cloudMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.8,
    roughness: 1,
    metalness: 0
  });
  
  for (let i = 0; i < 20; i++) {
    const cloud = new THREE.Mesh(cloudGeometry, cloudMaterial);
    cloud.position.set(
      (Math.random() - 0.5) * 200,
      50 + Math.random() * 30,
      (Math.random() - 0.5) * 200
    );
    cloud.scale.set(
      1 + Math.random() * 3,
      0.5 + Math.random(),
      1 + Math.random() * 2
    );
    clouds.push(cloud);
    scene.add(cloud);
  }
}

createClouds();


// === Clock ===
clock = new THREE.Clock(false);

// === Physics Parameters ===
const GRAVITY = -9.81;
const AIR_DENSITY = 1.225;


let velocity = new THREE.Vector3(0, 0, 0);
let position = missile.position.clone();

// === GUI Parameters ===
const params = {
  mass: 100,
  thrust: 3000,
  dragCoeff: 0.75,
  area: 0.09,
  speed: 0,
  altitude: 0,
  paused: false,
  reset: () => resetSimulation(),
  showForces: true,
  showTrail: true,
  initialFuel: 50,      // kg
  fuelBurnRate: 5,       // kg/s
  fuelLeft: 50,        // track remaining fuel
  timeOfDay: "day",
  visualEffects: true,
  cameraShakeIntensity: 1.0,
  particleDensity: 1.0,
  realisticLighting: true,
  showClouds: true,
  showExplosion: true
};

// === Enhanced Trail Effect ===
const trailPoints = [];
const trailGeometry = new THREE.BufferGeometry();
const trailMaterial = new THREE.LineBasicMaterial({ 
  color: 0xff9900,
  transparent: true,
  opacity: 0.7,
  blending: THREE.AdditiveBlending
});
const trail = new THREE.Line(trailGeometry, trailMaterial);
scene.add(trail);

// Add glow effect to trail
const trailGlowGeometry = new THREE.TubeGeometry(
  new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0)]),
  20, 0.2, 8, false
);
const trailGlowMaterial = new THREE.MeshBasicMaterial({
  color: 0xff5500,
  transparent: true,
  opacity: 0.3,
  blending: THREE.AdditiveBlending
});
const trailGlow = new THREE.Mesh(trailGlowGeometry, trailGlowMaterial);
trailGlow.visible = false;
scene.add(trailGlow);

function updateTrail() {
  if (!params.showTrail) {
    trail.visible = false;
    trailGlow.visible = false;
    return;
  }
  
  trail.visible = true;
  trailPoints.push(missile.position.clone());
  
  // Limit trail length
  if (trailPoints.length > 100) {
    trailPoints.shift();
  }
  
  const positions = new Float32Array(trailPoints.length * 3);
  trailPoints.forEach((point, i) => {
    positions[i * 3] = point.x;
    positions[i * 3 + 1] = point.y;
    positions[i * 3 + 2] = point.z;
  });
  
  trailGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  trailGeometry.attributes.position.needsUpdate = true;
  
  // Update trail glow if we have enough points
  if (trailPoints.length > 5) {
    trailGlow.visible = true;
    const curve = new THREE.CatmullRomCurve3(trailPoints.slice(-20));
    const geometry = new THREE.TubeGeometry(curve, 20, 0.2, 8, false);
    trailGlow.geometry.dispose();
    trailGlow.geometry = geometry;
  } else {
    trailGlow.visible = false;
  }
}

// === Enhanced GUI Setup ===
const gui = new GUI({ width: 300 });
const physicsFolder = gui.addFolder('Physics');
physicsFolder.add(params, 'mass', 50, 1000).step(10).name("Mass (kg)");
physicsFolder.add(params, 'thrust', 1000, 10000).step(100).name("Thrust (N)");
physicsFolder.add(params, 'dragCoeff', 0.1, 1.5).step(0.05).name("Drag Coeff.");
physicsFolder.add(params, 'area', 0.01, 1).step(0.01).name("Cross Area (m²)");

const displayFolder = gui.addFolder('Display');
displayFolder.add(params, 'speed').name("Speed (m/s)").listen();
displayFolder.add(params, 'altitude').name("Altitude (m)").listen();
displayFolder.add(params, 'showForces').name("Show Forces");
displayFolder.add(params, 'showTrail').name("Show Trail");
displayFolder.add({ cameraMode: "overview" }, 'cameraMode', ["overview", "follow", "fixed", "free", "cinematic", "first-person"]).name("Camera Mode").onChange((val) => {
  cameraMode = val;
});
displayFolder.add(params, 'fuelLeft').name("Fuel Left (kg)").listen();

const visualsFolder = gui.addFolder('Visual Effects');
visualsFolder.add(params, 'visualEffects').name("Enable Effects").onChange(value => {
  bloomPass.enabled = value;
});
visualsFolder.add(params, 'timeOfDay', ["day", "sunset", "night"]).name("Time of Day").onChange(value => {
  timeOfDay = value;
  
  // Update sky based on time of day
  if (value === "day") {
    effectController.elevation = 45;
    effectController.turbidity = 10;
    effectController.rayleigh = 3;
  } else if (value === "sunset") {
    effectController.elevation = 5;
    effectController.turbidity = 5;
    effectController.rayleigh = 5;
  } else if (value === "night") {
    effectController.elevation = -10;
    effectController.turbidity = 2;
    effectController.rayleigh = 0.5;
  }
  
  updateSky();
  
  // Toggle stars visibility
  stars.forEach(star => {
    star.visible = value === "night";
  });
});
visualsFolder.add(params, 'cameraShakeIntensity', 0, 2).step(0.1).name("Camera Shake");
visualsFolder.add(params, 'particleDensity', 0, 2).step(0.1).name("Particle Density");
visualsFolder.add(params, 'realisticLighting').name("Enhanced Lighting");
visualsFolder.add(params, 'showClouds').name("Show Clouds").onChange(value => {
  clouds.forEach(cloud => cloud.visible = value);
});
visualsFolder.add(params, 'showExplosion').name("Show Explosion");

const controlsFolder = gui.addFolder('Controls');
controlsFolder.add(params, 'paused').name("⏯ Pause");
// Remove emojis for a cleaner military look
document.getElementById("startBtn").addEventListener("click", () => {
    params.paused = false;
    clock.start();
});

document.getElementById("resetBtn").addEventListener("click", () => {
    params.reset(); // make sure reset() exists in your params
});


// Open folders by default
physicsFolder.open();
displayFolder.open();
visualsFolder.open();
controlsFolder.open();

function resetSimulation() {
  params.paused = true;
  clock.stop();
  clock.elapsedTime = 0;
  velocity.set(0, 0, 0);
  position.set(0, 3.5, 0);
  missile.position.copy(position);
  missile.rotation.set(0, 0, 0);
  trailPoints.length = 0;
  updateTrail();
  flame.visible = false;
  phase = "Boost";
  phaseText.textContent = "Current Phase: Boost";
  boostEnded = false;
  params.fuelLeft = params.initialFuel;
  
  // Reset explosion particles
  if (explosionParticles) {
    explosionParticles.visible = false;
    explosionParticles.userData.active = false;
    explosionParticles.userData.elapsed = 0;
  }
  
  // Reset camera shake
  cameraShake.active = false;
  cameraShake.elapsed = 0;
  
  // Clear impact effects
  impactEffects.forEach(effect => scene.remove(effect));
  impactEffects = [];
}

// === Arrow Helpers for Force Visualization ===
let thrustArrow = new THREE.ArrowHelper(new THREE.Vector3(), missile.position, 5, 0xff0000);
let gravityArrow = new THREE.ArrowHelper(new THREE.Vector3(), missile.position, 5, 0x0000ff);
let dragArrow = new THREE.ArrowHelper(new THREE.Vector3(), missile.position, 5, 0x00ff00);
scene.add(thrustArrow, gravityArrow, dragArrow);


function getAirDensity(altitude) {
  const seaLevelDensity = 1.225; // kg/m³ at sea level
  const scaleHeight = 8500; // meters

  // Exponential decrease in density with altitude
  return seaLevelDensity * Math.exp(-altitude / scaleHeight);
}

function computeDrag(velocity, altitude) {
  const airDensity = getAirDensity(altitude);
  const dragCoefficient = params.dragCoeff;
  const area = params.area;

  const speed = velocity.length();
  const dragMagnitude = 0.5 * airDensity * speed * speed * dragCoefficient * area;

  const dragForce = velocity.clone().normalize().multiplyScalar(-dragMagnitude);
  return dragForce;
}


function updateArrow(arrow, forceVec) {
  const dir = forceVec.clone().normalize();
  const length = forceVec.length() / 500;
  arrow.setDirection(dir);
  arrow.setLength(length);
  arrow.position.copy(missile.position);
}

// Update particle systems
function updateParticles(deltaTime) {
  if (!particleSystem) return;
  
  // Update exhaust particles
  if (flame.visible && params.visualEffects) {
    particleSystem.visible = true;
    
    const positions = particleSystem.geometry.attributes.position.array;
    const sizes = particleSystem.geometry.attributes.size.array;
    const velocities = particleSystem.userData.velocities;
    const lifetimes = particleSystem.userData.lifetimes;
    
    for (let i = 0; i < positions.length / 3; i++) {
      // Reset dead particles
      lifetimes[i] -= deltaTime;
      
      if (lifetimes[i] <= 0) {
        // Reset particle at missile exhaust position
        const exhaustPos = new THREE.Vector3(0, -3, 0).applyMatrix4(missile.matrixWorld);
        positions[i * 3] = exhaustPos.x + (Math.random() - 0.5) * 0.3;
        positions[i * 3 + 1] = exhaustPos.y;
        positions[i * 3 + 2] = exhaustPos.z + (Math.random() - 0.5) * 0.3;
        
        // Reset velocity with some randomness
        const exhaustDir = new THREE.Vector3(0, -1, 0).applyQuaternion(missile.quaternion);
        velocities[i].copy(exhaustDir).multiplyScalar(Math.random() * 2 + 1);
        velocities[i].x += (Math.random() - 0.5) * 0.5;
        velocities[i].z += (Math.random() - 0.5) * 0.5;
        
        // Reset lifetime
        lifetimes[i] = Math.random() * 2 * params.particleDensity;
        
        // Reset size
        sizes[i] = Math.random() * 0.5 + 0.1;
      } else {
        // Update position based on velocity
        positions[i * 3] += velocities[i].x * deltaTime;
        positions[i * 3 + 1] += velocities[i].y * deltaTime;
        positions[i * 3 + 2] += velocities[i].z * deltaTime;
        
        // Shrink particle as it ages
        sizes[i] *= 0.99;
      }
    }
    
    particleSystem.geometry.attributes.position.needsUpdate = true;
    particleSystem.geometry.attributes.size.needsUpdate = true;
  } else {
    particleSystem.visible = false;
  }
  
  // Update explosion particles
  if (explosionParticles && explosionParticles.userData.active) {
    explosionParticles.visible = true;
    explosionParticles.userData.elapsed += deltaTime;
    
    if (explosionParticles.userData.elapsed >= explosionParticles.userData.lifetime) {
      explosionParticles.visible = false;
      explosionParticles.userData.active = false;
      return;
    }
    
    const progress = explosionParticles.userData.elapsed / explosionParticles.userData.lifetime;
    const positions = explosionParticles.geometry.attributes.position.array;
    const sizes = explosionParticles.geometry.attributes.size.array;
    const velocities = explosionParticles.userData.velocities;
    
    for (let i = 0; i < positions.length / 3; i++) {
      // Update position based on velocity
      positions[i * 3] += velocities[i].x * deltaTime;
      positions[i * 3 + 1] += velocities[i].y * deltaTime;
      positions[i * 3 + 2] += velocities[i].z * deltaTime;
      
      // Apply gravity to velocity
      velocities[i].y -= 9.8 * deltaTime;
      
      // Slow down particles over time
      velocities[i].multiplyScalar(0.99);
      
      // Shrink particle as explosion progresses
      sizes[i] *= 0.99;
    }
    
    // Fade out explosion
    explosionParticles.material.opacity = 1 - progress;
    
    explosionParticles.geometry.attributes.position.needsUpdate = true;
    explosionParticles.geometry.attributes.size.needsUpdate = true;
  }
}

// Create impact crater and effects
function createImpactEffects(position) {
  if (!params.showExplosion) return;
  
  // Create crater
  const craterGeometry = new THREE.CircleGeometry(3, 32);
  const craterMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x333333,
    roughness: 0.9,
    metalness: 0.1,
    side: THREE.DoubleSide
  });
  const crater = new THREE.Mesh(craterGeometry, craterMaterial);
  crater.position.copy(position);
  crater.position.y += 0.01; // Slightly above ground to prevent z-fighting
  crater.rotation.x = -Math.PI / 2;
  scene.add(crater);
  impactEffects.push(crater);
  
  // Create debris
  for (let i = 0; i < 20; i++) {
    const size = Math.random() * 0.5 + 0.2;
    const debrisGeometry = new THREE.BoxGeometry(size, size, size);
    const debrisMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x555555,
      roughness: 1.0,
      metalness: 0.2
    });
    const debris = new THREE.Mesh(debrisGeometry, debrisMaterial);
    
    // Position around impact
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * 5 + 1;
    debris.position.set(
      position.x + Math.cos(angle) * radius,
      position.y + Math.random() * 0.5,
      position.z + Math.sin(angle) * radius
    );
    
    // Random rotation
    debris.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI
    );
    
    scene.add(debris);
    impactEffects.push(debris);
  }
  
  // Trigger explosion particles
  if (explosionParticles && params.visualEffects) {
    explosionParticles.position.copy(position);
    explosionParticles.position.y += 1;
    explosionParticles.visible = true;
    explosionParticles.userData.active = true;
    explosionParticles.userData.elapsed = 0;
    
    // Reset particle positions to center
    const positions = explosionParticles.geometry.attributes.position.array;
    for (let i = 0; i < positions.length / 3; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;
    }
    explosionParticles.geometry.attributes.position.needsUpdate = true;
  }
  
  // Trigger camera shake
  cameraShake.active = true;
  cameraShake.intensity = 1.0 * params.cameraShakeIntensity;
  cameraShake.duration = 2.0;
  cameraShake.elapsed = 0;
}

// Apply camera shake effect
function applyCameraShake(deltaTime) {
  if (!cameraShake.active) return;
  
  cameraShake.elapsed += deltaTime;
  if (cameraShake.elapsed >= cameraShake.duration) {
    cameraShake.active = false;
    return;
  }
  
  const progress = cameraShake.elapsed / cameraShake.duration;
  const intensity = cameraShake.intensity * (1 - progress);
  
  camera.position.x += (Math.random() - 0.5) * intensity;
  camera.position.y += (Math.random() - 0.5) * intensity;
  camera.position.z += (Math.random() - 0.5) * intensity;
}

// Update cloud positions
function updateClouds(deltaTime) {
  clouds.forEach((cloud, i) => {
    cloud.position.x += Math.sin(clock.elapsedTime * 0.1 + i) * 0.05 * deltaTime;
    cloud.rotation.y += 0.01 * deltaTime;
  });
}

function animate() {
  requestAnimationFrame(animate);

  if (params.paused) {
    composer.render();
    return;
  }

  const deltaTime = clock.getDelta();
  const elapsed = clock.elapsedTime;
  let netForce = new THREE.Vector3();

  const weight = new THREE.Vector3(0, params.mass * GRAVITY, 0);
let thrust = new THREE.Vector3();
let drag = new THREE.Vector3();

//boost phase
if (!boostEnded) {
  if (params.fuelLeft > 0) {
    const progress = 1 - params.fuelLeft / params.initialFuel;
    const tiltAngle = TARGET_TILT_ANGLE * progress;
    missile.rotation.z = tiltAngle;

    const thrustDir = new THREE.Vector3(0, 1, 0);
    thrustDir.applyQuaternion(missile.quaternion).normalize();
    thrust = thrustDir.multiplyScalar(params.thrust);

    drag = computeDrag(velocity, missile.position.y);
    netForce.add(thrust).add(weight).add(drag);
    phase = "Boost";
    flame.visible = true;

    // burn fuel
    params.fuelLeft -= params.fuelBurnRate * deltaTime;
    if (params.fuelLeft <= 0) {
      params.fuelLeft = 0;
      boostEnded = true;
    }

     if (params.showForces) {
      updateArrow(thrustArrow, thrust);
      updateArrow(gravityArrow, weight);
      updateArrow(dragArrow, drag);
}

  } else {
    boostEnded = true;
  }



// MIDCOURSE PHASE
} else if (velocity.y >= 0) {
  drag = new THREE.Vector3(0, 0, 0); // no drag
  netForce.add(weight);
  phase = "Midcourse";
  flame.visible = false;


 if (params.showForces) {
      updateArrow(thrustArrow, new THREE.Vector3(0, 0, 0));
      updateArrow(dragArrow, new THREE.Vector3(0, 0, 0));
      updateArrow(gravityArrow, weight);
    }

// RE-ENTRY PHASE
} else {
  drag = computeDrag(velocity, missile.position.y);
  netForce.add(weight).add(drag);
  phase = "Re-entry";
  flame.visible = false;

      if (params.showForces) {
      updateArrow(gravityArrow, weight);
      updateArrow(dragArrow, drag);
      updateArrow(thrustArrow, new THREE.Vector3(0, 0, 0));
    }
}
if (phase === "Re-entry") {
  console.log(`Velocity.y: ${velocity.y.toFixed(2)} m/s`);
}



  const acceleration = netForce.clone().divideScalar(params.mass);
  velocity.add(acceleration.multiplyScalar(deltaTime));
  position.add(velocity.clone().multiplyScalar(deltaTime));

  missile.position.copy(position);
  
  // Update missile rotation based on velocity
if (velocity.length() > 0.1) {
  const direction = velocity.clone().normalize();
  const up = new THREE.Vector3(0, 1, 0); // missile's up axis (Y)

  const quaternion = new THREE.Quaternion();
  quaternion.setFromUnitVectors(up, direction);
  missile.quaternion.copy(quaternion);
}

  phaseText.textContent = `Current Phase: ${phase}`;
  params.speed = velocity.length().toFixed(2);
  params.altitude = Math.max(0, missile.position.y).toFixed(2);
  
  if (missile.position.y <= 2.5) {
    // Store impact position before resetting
    lastImpactPosition.copy(missile.position);
    lastImpactPosition.y = 0.01; // Just above ground level
    
    velocity.set(0, 0, 0);
    phase = "Impact";
    phaseText.textContent = "Current Phase: Impact 💥";
    missile.position.y = 2.5;
    
    // Create impact effects if this is a new impact
    if (params.showExplosion) {
      createImpactEffects(lastImpactPosition);
    }
  }

  // Update visual effects
  updateTrail();
  updateParticles(deltaTime);
  updateClouds(deltaTime);
  applyCameraShake(deltaTime);

  // Toggle force arrows visibility
  thrustArrow.visible = params.showForces;
  gravityArrow.visible = params.showForces;
  dragArrow.visible = params.showForces;

  controls.update();
  
  // Camera modes
  if (cameraMode === "follow") {
  const followDistance = 6; // behind missile
  const followHeight = 3;   // above missile
  const forwardOffset = 4;  // look ahead

  // Calculate offset in missile local space
  const offset = new THREE.Vector3(0, followHeight, -followDistance);
  offset.applyQuaternion(missile.quaternion); // rotate with missile
  const targetPosition = missile.position.clone().add(offset);

  // Smooth position lerp
  camera.position.lerp(targetPosition, 0.1);

  // Look slightly ahead
  const lookAtTarget = missile.position.clone().add(
    new THREE.Vector3(0, 0, forwardOffset).applyQuaternion(missile.quaternion)
  );
  camera.lookAt(lookAtTarget);

  controls.enabled = false;
}
else if (cameraMode === "overview") {
  const baseRadius = 50;
  const orbitSpeed = 0.25;
  const angle = clock.elapsedTime * orbitSpeed;

  // Slightly increase radius if rocket speeds up
  const velocity = missile.userData.velocity?.length() || 0;
  const radius = baseRadius + velocity * 0.5;

  camera.position.set(
    radius * Math.sin(angle),
    30 + Math.sin(angle * 0.4) * 5,
    radius * Math.cos(angle)
  );

  camera.lookAt(missile.position);
  controls.enabled = false;
}

else if (cameraMode === "fixed") {
  // Static position
  camera.position.set(0, 10, 30);

  // Add shake when missile is fast
  const velocity = missile.userData.velocity?.length() || 0;
  const shakeIntensity = Math.min(velocity * 0.002, 0.1);

  camera.position.x += (Math.random() - 0.5) * shakeIntensity;
  camera.position.y += (Math.random() - 0.5) * shakeIntensity;

  // Dynamic zoom
  const distance = camera.position.distanceTo(missile.position);
  if (distance > 20) {
    camera.position.z -= 0.1;
  } else if (distance < 10) {
    camera.position.z += 0.1;
  }

  camera.lookAt(missile.position);
  controls.enabled = false;
}
else if (cameraMode === "free") {
  controls.enabled = false;

  // --- one-time setup when entering free mode ---
  const s = (camera.userData.free ??= {
    yaw: camera.rotation.y,
    pitch: camera.rotation.x,
    keys: Object.create(null),
    locked: false,
    inited: false,
    baseSpeed: 20,      // 🔥 faster base speed
    sprintMult: 6,      // 🔥 shift makes it 3x faster
    lookSpeed: 0.003    // 🔥 faster mouse look
  });

  if (!s.inited) {
    s.inited = true;

    // Pointer lock
    renderer.domElement.addEventListener("click", () => {
      renderer.domElement.requestPointerLock();
    });
    document.addEventListener("pointerlockchange", () => {
      s.locked = (document.pointerLockElement === renderer.domElement);
    });

    // Mouse look
    document.addEventListener("mousemove", (e) => {
      if (!s.locked) return;
      s.yaw   -= e.movementX * s.lookSpeed;
      s.pitch -= e.movementY * s.lookSpeed;
      const limit = Math.PI / 2 - 0.001;
      s.pitch = Math.max(-limit, Math.min(limit, s.pitch));
    });

    // Keys
    document.addEventListener("keydown", (e) => { s.keys[e.code] = true; });
    document.addEventListener("keyup",   (e) => { s.keys[e.code] = false; });
  }

  // Apply orientation
  camera.rotation.set(s.pitch, s.yaw, 0, "YXZ");

  // Movement
  const dt = deltaTime;
  const speed = (s.keys.ShiftLeft || s.keys.ShiftRight ? s.baseSpeed * s.sprintMult : s.baseSpeed) * dt;

  const forward = new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation);
  const right   = new THREE.Vector3(1, 0,  0).applyEuler(camera.rotation);
  const up      = new THREE.Vector3(0, 1,  0);

  const move = new THREE.Vector3();
  if (s.keys.KeyW) move.add(forward);
  if (s.keys.KeyS) move.sub(forward);
  if (s.keys.KeyA) move.sub(right);
  if (s.keys.KeyD) move.add(right);
  if (s.keys.Space) move.add(up);
  if (s.keys.ControlLeft || s.keys.ControlRight) move.sub(up);

  if (move.lengthSq() > 0) {
    move.normalize().multiplyScalar(speed);
    camera.position.add(move);
  }
}
else if (cameraMode === "cinematic") {
  controls.enabled = false;
  
  // Cinematic camera that creates dramatic shots
  const time = clock.elapsedTime;
  const missilePos = missile.position;
  
  // Create different cinematic movements based on phase
  if (phase === "Boost") {
    // During boost, slowly circle and look up at the missile
    const radius = 15;
    const angle = time * 0.2;
    camera.position.set(
      missilePos.x + radius * Math.sin(angle),
      missilePos.y - 5,
      missilePos.z + radius * Math.cos(angle)
    );
    camera.lookAt(missilePos);
  } 
  else if (phase === "Midcourse") {
    // During midcourse, follow from behind and below
    const offset = new THREE.Vector3(-10, -5, -20);
    offset.applyQuaternion(missile.quaternion);
    camera.position.lerp(missilePos.clone().add(offset), 0.05);
    camera.lookAt(missilePos);
  }
  else if (phase === "Re-entry") {
    // During re-entry, dramatic shot from ground looking up
    const groundPos = new THREE.Vector3(missilePos.x, 0, missilePos.z);
    groundPos.x += 20 * Math.sin(time * 0.5);
    groundPos.z += 20 * Math.cos(time * 0.5);
    camera.position.lerp(groundPos, 0.05);
    camera.lookAt(missilePos);
  }
  else if (phase === "Impact") {
    // After impact, circle the impact site
    const radius = 20;
    const angle = time * 0.5;
    camera.position.set(
      lastImpactPosition.x + radius * Math.sin(angle),
      10,
      lastImpactPosition.z + radius * Math.cos(angle)
    );
    camera.lookAt(lastImpactPosition);
  }
}
else if (cameraMode === "first-person") {
  controls.enabled = false;
  
  // Position camera at missile nose
  const offset = new THREE.Vector3(0, 0.5, 0);
  offset.applyQuaternion(missile.quaternion);
  camera.position.copy(missile.position.clone().add(offset));
  
  // Look in direction of travel
  const lookAtPos = missile.position.clone().add(
    new THREE.Vector3(0, 0, 2).applyQuaternion(missile.quaternion)
  );
  camera.lookAt(lookAtPos);
  
  // Add shake based on speed
  const speed = velocity.length();
  const shakeIntensity = Math.min(speed * 0.0005, 0.05) * params.cameraShakeIntensity;
  camera.position.x += (Math.random() - 0.5) * shakeIntensity;
  camera.position.y += (Math.random() - 0.5) * shakeIntensity;
  camera.position.z += (Math.random() - 0.5) * shakeIntensity;
}



  composer.render();
}

animate();




window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});



// Add keyboard shortcuts for camera modes
window.addEventListener('keydown', (e) => {
  switch(e.key) {
    case '1': cameraMode = "overview"; break;
    case '2': cameraMode = "follow"; break;
    case '3': cameraMode = "fixed"; break;
    case '4': cameraMode = "free"; break;
    case '5': cameraMode = "cinematic"; break;
    case '6': cameraMode = "first-person"; break;
    case 'r': params.reset(); break;
    case ' ': 
      if (params.paused) {
        params.paused = false;
        clock.start();
      } else {
        params.paused = true;
      }
      break;
  }
});

// Add day/night cycle
let dayNightCycle = false;
window.addEventListener('keydown', (e) => {
  if (e.key === 'l') {
    dayNightCycle = !dayNightCycle;
  }
});

// Update day/night cycle
function updateDayNightCycle() {
  if (!dayNightCycle) return;
  
  effectController.elevation = 45 * Math.sin(clock.elapsedTime * 0.05);
  
  if (effectController.elevation > 20) {
    // Day
    effectController.turbidity = 10;
    effectController.rayleigh = 3;
    timeOfDay = "day";
  } else if (effectController.elevation > 0) {
    // Sunset/sunrise
    effectController.turbidity = 5;
    effectController.rayleigh = 5;
    timeOfDay = "sunset";
  } else {
    // Night
    effectController.turbidity = 2;
    effectController.rayleigh = 0.5;
    timeOfDay = "night";
  }
  
  updateSky();
  
  // Toggle stars visibility
  stars.forEach(star => {
    star.visible = timeOfDay === "night";
  });
}

// Add this to the animate loop
const animateOriginal = animate;
animate = function() {
  updateDayNightCycle();
  animateOriginal();
};

// Initialize with a reset
resetSimulation();

// Add this to your main.js file after the launch platform code

// === Enhanced Launch Control Building ===
const building = new THREE.Group();

// Main building structure
const buildingGeometry = new THREE.BoxGeometry(15, 8, 10);
const buildingMaterial = new THREE.MeshStandardMaterial({ 
  color: 0x444444,
  roughness: 0.8,
  metalness: 0.3
});
const buildingMain = new THREE.Mesh(buildingGeometry, buildingMaterial);
buildingMain.position.set(0, 4, 0);
buildingMain.castShadow = true;
buildingMain.receiveShadow = true;
building.add(buildingMain);

// Building roof
const roofGeometry = new THREE.BoxGeometry(16, 1, 11);
const roofMaterial = new THREE.MeshStandardMaterial({ 
  color: 0x222222,
  roughness: 0.9,
  metalness: 0.1
});
const roof = new THREE.Mesh(roofGeometry, roofMaterial);
roof.position.set(0, 8.5, 0);
building.add(roof);

// Windows
const windowGeometry = new THREE.PlaneGeometry(1.5, 1.5);
const windowMaterial = new THREE.MeshBasicMaterial({ 
  color: 0x88ccff,
  emissive: 0x224466,
  emissiveIntensity: 0.5,
  transparent: true,
  opacity: 0.7
});

// Add windows to front and sides
for (let i = 0; i < 3; i++) {
  for (let j = 0; j < 2; j++) {
    // Front windows
    const windowFront = new THREE.Mesh(windowGeometry, windowMaterial);
    windowFront.position.set(-4 + i * 4, 2 + j * 2.5, 5.01);
    building.add(windowFront);
    
    // Side windows (right)
    const windowRight = new THREE.Mesh(windowGeometry, windowMaterial);
    windowRight.position.set(7.51, 2 + j * 2.5, -3 + i * 3);
    windowRight.rotation.y = Math.PI / 2;
    building.add(windowRight);
    
    // Side windows (left)
    const windowLeft = new THREE.Mesh(windowGeometry, windowMaterial);
    windowLeft.position.set(-7.51, 2 + j * 2.5, -3 + i * 3);
    windowLeft.rotation.y = -Math.PI / 2;
    building.add(windowLeft);
  }
}

// Door
const doorGeometry = new THREE.PlaneGeometry(2.5, 3.5);
const doorMaterial = new THREE.MeshStandardMaterial({ 
  color: 0x553311,
  roughness: 0.9,
  metalness: 0.1
});
const door = new THREE.Mesh(doorGeometry, doorMaterial);
door.position.set(0, 1.75, 5.01);
building.add(door);

// Door handle
const handleGeometry = new THREE.SphereGeometry(0.1, 8, 8);
const handleMaterial = new THREE.MeshStandardMaterial({ color: 0xaaaaaa });
const handle = new THREE.Mesh(handleGeometry, handleMaterial);
handle.position.set(0.8, 1.75, 5.02);
building.add(handle);

// Antenna on roof
const antennaBase = new THREE.CylinderGeometry(0.3, 0.3, 0.5, 8);
const antennaBaseMaterial = new THREE.MeshStandardMaterial({ color: 0x777777 });
const antenna = new THREE.Mesh(antennaBase, antennaBaseMaterial);
antenna.position.set(0, 9.25, 0);
building.add(antenna);

const antennaPole = new THREE.CylinderGeometry(0.05, 0.05, 3, 8);
const antennaPoleMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc });
const pole = new THREE.Mesh(antennaPole, antennaPoleMaterial);
pole.position.set(0, 10.75, 0);
building.add(pole);

const antennaTop = new THREE.SphereGeometry(0.2, 8, 8);
const antennaTopMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
const top = new THREE.Mesh(antennaTop, antennaTopMaterial);
top.position.set(0, 12, 0);
building.add(top);

// Position the building next to the launch platform
building.position.set(40, 0, -15);
building.rotation.y = -Math.PI / 4;

scene.add(building);

// Add two additional buildings similar to the launch control building
function createAdditionalBuildings() {
  // Create second building
  const building2 = new THREE.Group();
  
  // Main building structure
  const building2Geometry = new THREE.BoxGeometry(12, 6, 8);
  const building2Material = new THREE.MeshStandardMaterial({ 
    color: 0x555555,
    roughness: 0.8,
    metalness: 0.3
  });
  const building2Main = new THREE.Mesh(building2Geometry, building2Material);
  building2Main.position.set(0, 3, 0);
  building2Main.castShadow = true;
  building2Main.receiveShadow = true;
  building2.add(building2Main);

  // Building roof
  const roof2Geometry = new THREE.BoxGeometry(13, 1, 9);
  const roof2Material = new THREE.MeshStandardMaterial({ 
    color: 0x333333,
    roughness: 0.9,
    metalness: 0.1
  });
  const roof2 = new THREE.Mesh(roof2Geometry, roof2Material);
  roof2.position.set(0, 6.5, 0);
  building2.add(roof2);

  // Windows
  const window2Geometry = new THREE.PlaneGeometry(1.2, 1.2);
  const window2Material = new THREE.MeshBasicMaterial({ 
    color: 0x88ccff,
    emissive: 0x224466,
    emissiveIntensity: 0.5,
    transparent: true,
    opacity: 0.7
  });

  // Add windows to front
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      const windowFront = new THREE.Mesh(window2Geometry, window2Material);
      windowFront.position.set(-3 + i * 6, 2 + j * 2, 4.01);
      building2.add(windowFront);
    }
  }

  // Door
  const door2Geometry = new THREE.PlaneGeometry(2, 2.5);
  const door2Material = new THREE.MeshStandardMaterial({ 
    color: 0x553311,
    roughness: 0.9,
    metalness: 0.1
  });
  const door2 = new THREE.Mesh(door2Geometry, door2Material);
  door2.position.set(0, 1.25, 4.01);
  building2.add(door2);

  // Position the second building
  building2.position.set(-30, 0, -20);
  building2.rotation.y = Math.PI / 4;
  scene.add(building2);

  // Create third building (smaller storage-like structure)
  const building3 = new THREE.Group();
  
  // Main building structure
  const building3Geometry = new THREE.BoxGeometry(8, 4, 6);
  const building3Material = new THREE.MeshStandardMaterial({ 
    color: 0x666666,
    roughness: 0.8,
    metalness: 0.3
  });
  const building3Main = new THREE.Mesh(building3Geometry, building3Material);
  building3Main.position.set(0, 2, 0);
  building3Main.castShadow = true;
  building3Main.receiveShadow = true;
  building3.add(building3Main);

  // Building roof
  const roof3Geometry = new THREE.BoxGeometry(9, 0.5, 7);
  const roof3Material = new THREE.MeshStandardMaterial({ 
    color: 0x444444,
    roughness: 0.9,
    metalness: 0.1
  });
  const roof3 = new THREE.Mesh(roof3Geometry, roof3Material);
  roof3.position.set(0, 4.25, 0);
  building3.add(roof3);

  // Add ventilation pipes
  const pipeGeometry = new THREE.CylinderGeometry(0.2, 0.2, 1, 8);
  const pipeMaterial = new THREE.MeshStandardMaterial({ color: 0x888888 });
  
  const pipe1 = new THREE.Mesh(pipeGeometry, pipeMaterial);
  pipe1.position.set(2, 4.75, 1);
  pipe1.rotation.x = Math.PI / 2;
  building3.add(pipe1);
  
  const pipe2 = new THREE.Mesh(pipeGeometry, pipeMaterial);
  pipe2.position.set(-2, 4.75, -1);
  pipe2.rotation.x = Math.PI / 2;
  building3.add(pipe2);

  // Door
  const door3Geometry = new THREE.PlaneGeometry(1.5, 2);
  const door3Material = new THREE.MeshStandardMaterial({ 
    color: 0x553311,
    roughness: 0.9,
    metalness: 0.1
  });
  const door3 = new THREE.Mesh(door3Geometry, door3Material);
  door3.position.set(0, 1, 3.01);
  building3.add(door3);

  // Position the third building
  building3.position.set(25, 0, 30);
  building3.rotation.y = -Math.PI / 3;
  scene.add(building3);
}

// Call this function after the original building is created
createAdditionalBuildings();

// Add a bank building that complements the existing structures
function createBankBuilding() {
  const bank = new THREE.Group();
  
  // Main bank structure (more formal and ornate than military buildings)
  const bankGeometry = new THREE.BoxGeometry(18, 10, 15);
  const bankMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x8B4513, // Rich brown color for a formal look
    roughness: 0.7,
    metalness: 0.2
  });
  const bankMain = new THREE.Mesh(bankGeometry, bankMaterial);
  bankMain.position.set(0, 5, 0);
  bankMain.castShadow = true;
  bankMain.receiveShadow = true;
  bank.add(bankMain);

  // Bank roof (more elaborate than military buildings)
  const bankRoofGeometry = new THREE.BoxGeometry(19, 1.5, 16);
  const bankRoofMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x2F4F4F, // Dark slate gray
    roughness: 0.8,
    metalness: 0.1
  });
  const bankRoof = new THREE.Mesh(bankRoofGeometry, bankRoofMaterial);
  bankRoof.position.set(0, 10.75, 0);
  bank.add(bankRoof);

  // Decorative cornice
  const corniceGeometry = new THREE.BoxGeometry(19.5, 0.3, 16.5);
  const corniceMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xDAA520, // Goldenrod for decorative elements
    roughness: 0.4,
    metalness: 0.6
  });
  const cornice = new THREE.Mesh(corniceGeometry, corniceMaterial);
  cornice.position.set(0, 9.5, 0);
  bank.add(cornice);

  // Grand entrance with columns
  const columnGeometry = new THREE.CylinderGeometry(0.5, 0.5, 4, 16);
  const columnMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xF5F5DC, // Beige for columns
    roughness: 0.6,
    metalness: 0.2
  });
  
  for (let i = 0; i < 2; i++) {
    const column = new THREE.Mesh(columnGeometry, columnMaterial);
    column.position.set(-3 + i * 6, 2, 7.51);
    bank.add(column);
  }

  // Grand entrance door
  const bankDoorGeometry = new THREE.BoxGeometry(4, 3, 0.2);
  const bankDoorMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x8B0000, // Dark red for a formal door
    roughness: 0.5,
    metalness: 0.3
  });
  const bankDoor = new THREE.Mesh(bankDoorGeometry, bankDoorMaterial);
  bankDoor.position.set(0, 1.5, 7.6);
  bank.add(bankDoor);

  // Door handle (more elaborate than military buildings)
  const bankHandleGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.8, 12);
  const bankHandleMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xFFD700, // Gold color
    roughness: 0.3,
    metalness: 0.8
  });
  const bankHandle = new THREE.Mesh(bankHandleGeometry, bankHandleMaterial);
  bankHandle.position.set(1.2, 1.5, 7.7);
  bankHandle.rotation.z = Math.PI / 2;
  bank.add(bankHandle);

  // Bank windows (larger and more formal)
  const bankWindowGeometry = new THREE.PlaneGeometry(2, 2.5);
  const bankWindowMaterial = new THREE.MeshBasicMaterial({ 
    color: 0xADD8E6,
    emissive: 0x224466,
    emissiveIntensity: 0.3,
    transparent: true,
    opacity: 0.8
  });

  // Add windows to front
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 2; j++) {
      const window = new THREE.Mesh(bankWindowGeometry, bankWindowMaterial);
      window.position.set(-5 + i * 5, 3 + j * 3, 7.51);
      bank.add(window);
    }
  }

  // Add windows to sides
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      // Right side windows
      const rightWindow = new THREE.Mesh(bankWindowGeometry, bankWindowMaterial);
      rightWindow.position.set(9.01, 3 + j * 3, -4 + i * 8);
      rightWindow.rotation.y = Math.PI / 2;
      bank.add(rightWindow);
      
      // Left side windows
      const leftWindow = new THREE.Mesh(bankWindowGeometry, bankWindowMaterial);
      leftWindow.position.set(-9.01, 3 + j * 3, -4 + i * 8);
      leftWindow.rotation.y = -Math.PI / 2;
      bank.add(leftWindow);
    }
  }

  // Bank sign
  const signGeometry = new THREE.BoxGeometry(6, 1, 0.2);
  const signMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x2F4F4F, // Dark slate gray
    roughness: 0.5,
    metalness: 0.3
  });
  const sign = new THREE.Mesh(signGeometry, signMaterial);
  sign.position.set(0, 9, 7.6);
  bank.add(sign);

  // Sign text (simulated with simple geometry)
  const textGeometry = new THREE.BoxGeometry(4, 0.2, 0.1);
  const textMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xFFD700, // Gold color
    roughness: 0.3,
    metalness: 0.8
  });
  
  // Create "BANK" text using simple rectangles
  const letters = [
    // Letter B
    { position: [-1.5, 9, 7.75], scale: [0.2, 0.6, 1] },
    { position: [-1.3, 9.2, 7.75], scale: [0.4, 0.2, 1] },
    { position: [-1.3, 9, 7.75], scale: [0.4, 0.2, 1] },
    { position: [-1.3, 8.8, 7.75], scale: [0.4, 0.2, 1] },
    
    // Letter A
    { position: [-0.5, 9, 7.75], scale: [0.2, 0.6, 1] },
    { position: [-0.3, 9.2, 7.75], scale: [0.4, 0.2, 1] },
    { position: [-0.3, 9, 7.75], scale: [0.4, 0.2, 1] },
    
    // Letter N
    { position: [0.5, 9, 7.75], scale: [0.2, 0.6, 1] },
    { position: [0.7, 9, 7.75], scale: [0.2, 0.6, 1] },
    
    // Letter K
    { position: [1.5, 9, 7.75], scale: [0.2, 0.6, 1] },
    { position: [1.3, 9.1, 7.75], scale: [0.3, 0.2, 1] },
    { position: [1.3, 8.9, 7.75], scale: [0.3, 0.2, 1] }
  ];
  
  letters.forEach(letter => {
    const textPart = new THREE.Mesh(textGeometry, textMaterial);
    textPart.position.set(letter.position[0], letter.position[1], letter.position[2]);
    textPart.scale.set(letter.scale[0], letter.scale[1], letter.scale[2]);
    bank.add(textPart);
  });

  // Position the bank building in a prominent location
  bank.position.set(-50, 0, 30);
  bank.rotation.y = -Math.PI / 6;
  scene.add(bank);

  // Add landscaping around the bank (simple bushes)
  const bushGeometry = new THREE.SphereGeometry(1.5, 8, 8);
  const bushMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x228B22,
    roughness: 0.9,
    metalness: 0.1
  });
  
  for (let i = 0; i < 6; i++) {
    const bush = new THREE.Mesh(bushGeometry, bushMaterial);
    const angle = (i / 6) * Math.PI * 2;
    const radius = 12;
    bush.position.set(
      -50 + Math.cos(angle) * radius,
      1.5,
      30 + Math.sin(angle) * radius
    );
    bush.scale.set(
      1 + Math.random() * 0.5,
      1 + Math.random() * 0.5,
      1 + Math.random() * 0.5
    );
    scene.add(bush);
  }
}

// Call this function after the original buildings are created
createBankBuilding();

// === Stone Wall around the complex ===
// === Stone Wall around the complex ===
function createStoneWall() {
  const wallGroup = new THREE.Group();
  const wallLength = 200; // Increased from 120 to 200 units
  const wallHeight = 4;
  const wallThickness = 2;
  
  // Stone texture for the wall
  const stoneTexture = new THREE.TextureLoader().load('https://threejs.org/examples/textures/stone/stone_wall.jpg');
  stoneTexture.wrapS = stoneTexture.wrapT = THREE.RepeatWrapping;
  stoneTexture.repeat.set(6, 1); // Increased texture repeat to match larger walls
  
  const wallMaterial = new THREE.MeshStandardMaterial({ 
    map: stoneTexture,
    color: 0x888888,
    roughness: 0.9,
    metalness: 0.1
  });
  
  // Create four walls
  const directions = [
    { position: [0, wallHeight/2, -wallLength/2], rotation: [0, 0, 0] }, // North
    { position: [0, wallHeight/2, wallLength/2], rotation: [0, Math.PI, 0] }, // South
    { position: [-wallLength/2, wallHeight/2, 0], rotation: [0, Math.PI/2, 0] }, // West
    { position: [wallLength/2, wallHeight/2, 0], rotation: [0, -Math.PI/2, 0] }  // East
  ];
  
  directions.forEach(dir => {
    const wallGeometry = new THREE.BoxGeometry(wallLength, wallHeight, wallThickness);
    const wall = new THREE.Mesh(wallGeometry, wallMaterial);
    wall.position.set(dir.position[0], dir.position[1], dir.position[2]);
    wall.rotation.y = dir.rotation[1];
    wall.castShadow = true;
    wall.receiveShadow = true;
    wallGroup.add(wall);
  });
  
  // Add corner pillars for reinforcement
  const pillarGeometry = new THREE.BoxGeometry(wallThickness * 1.5, wallHeight * 1.2, wallThickness * 1.5);
  const pillarMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x666666,
    roughness: 0.8,
    metalness: 0.2
  });
  
  const corners = [
    [-wallLength/2, wallHeight * 0.6, -wallLength/2], // NW
    [wallLength/2, wallHeight * 0.6, -wallLength/2],  // NE
    [-wallLength/2, wallHeight * 0.6, wallLength/2],  // SW
    [wallLength/2, wallHeight * 0.6, wallLength/2]    // SE
  ];
  
  corners.forEach(corner => {
    const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
    pillar.position.set(corner[0], corner[1], corner[2]);
    pillar.castShadow = true;
    wallGroup.add(pillar);
  });
  
  // Add a gate on one side (south wall)
  const gateWidth = 15; // Slightly wider gate to match larger scale
  const gateGeometry = new THREE.BoxGeometry(gateWidth, wallHeight * 0.8, wallThickness * 0.8);
  const gateMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x8B4513, // Wood-like color
    roughness: 0.7,
    metalness: 0.3
  });
  
  const gate = new THREE.Mesh(gateGeometry, gateMaterial);
  gate.position.set(0, wallHeight * 0.4, wallLength/2 - wallThickness/2);
  wallGroup.add(gate);
  
  // Add gate details (cross beams)
  const beamGeometry = new THREE.BoxGeometry(gateWidth * 0.8, wallHeight * 0.1, wallThickness * 0.2);
  const beamMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x5D4037, // Darker wood
    roughness: 0.6,
    metalness: 0.4
  });
  
  for (let i = 0; i < 3; i++) {
    const beam = new THREE.Mesh(beamGeometry, beamMaterial);
    beam.position.set(0, wallHeight * (0.2 + i * 0.2), wallLength/2 - wallThickness/4);
    wallGroup.add(beam);
  }
  
  // Position the wall group to center around the buildings
  wallGroup.position.set(0, 0, 0);
  scene.add(wallGroup);
}

// Call this function after creating all buildings
createStoneWall();

// === Enhanced Military Soldiers ===
function createSoldiers() {
  const soldierGroup = new THREE.Group();
  
  // Soldier positions around the complex
  const soldierPositions = [
    // Launch platform security
    { x: 8, z: -5, rotation: Math.PI/2, type: "guard" },
    { x: -8, z: -5, rotation: -Math.PI/2, type: "guard" },
    { x: 0, z: -12, rotation: 0, type: "officer" },
    
    // Building entrances
    { x: 45, z: -10, rotation: -Math.PI/4, type: "guard" },
    { x: 35, z: -20, rotation: Math.PI/4, type: "guard" },
    { x: -25, z: -25, rotation: Math.PI/3, type: "guard" },
    { x: 20, z: 35, rotation: -Math.PI/6, type: "guard" },
    
    // Wall patrol points
    { x: 80, z: 0, rotation: Math.PI, type: "patrol" },
    { x: -80, z: 0, rotation: 0, type: "patrol" },
    { x: 0, z: 80, rotation: -Math.PI/2, type: "patrol" },
    { x: 0, z: -80, rotation: Math.PI/2, type: "patrol" },
    
    // Gate guards
    { x: 10, z: 95, rotation: -Math.PI/2, type: "guard" },
    { x: -10, z: 95, rotation: -Math.PI/2, type: "guard" }
  ];

  // Create soldiers with different types
  soldierPositions.forEach((pos, index) => {
    const soldier = createEnhancedSoldier(pos.type);
    soldier.position.set(pos.x, 0, pos.z);
    soldier.rotation.y = pos.rotation;
    soldier.userData = {
      type: pos.type,
      originalPosition: new THREE.Vector3(pos.x, 0, pos.z),
      patrolIndex: index,
      patrolDirection: 1,
      patrolDistance: 5 + Math.random() * 5,
      patrolSpeed: 0.5 + Math.random() * 1.5
    };
    soldierGroup.add(soldier);
  });

  scene.add(soldierGroup);
  return soldierGroup;
}

function createEnhancedSoldier(type = "guard") {
  const soldier = new THREE.Group();
  const uniformColor = type === "officer" ? 0x444444 : 0x556B2F; // Darker for officers
  
  // Create body parts with more detail
  const torso = createTorso(uniformColor);
  const head = createHead();
  const legs = createLegs(uniformColor);
  const arms = createArms(uniformColor);
  const helmet = createHelmet(uniformColor);
  const equipment = createEquipment(type);
  
  // Position parts
  torso.position.y = 1.1;
  head.position.y = 1.9;
  helmet.position.y = 1.95;
  legs.position.y = 0.6;
  
  // Add to soldier group
  soldier.add(torso);
  soldier.add(head);
  soldier.add(helmet);
  soldier.add(legs);
  soldier.add(arms);
  soldier.add(equipment);
  
  // Add animation mixer if needed
  soldier.userData = {
    type: type,
    animation: null
  };
  
  // Shadow casting
  soldier.traverse(child => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  
  return soldier;
}

function createTorso(color) {
  const torsoGroup = new THREE.Group();
  
  // Main torso
  const torsoGeometry = new THREE.CylinderGeometry(0.4, 0.45, 1.2, 8);
  const torsoMaterial = new THREE.MeshStandardMaterial({
    color: color,
    roughness: 0.9,
    metalness: 0.1
  });
  const torso = new THREE.Mesh(torsoGeometry, torsoMaterial);
  torsoGroup.add(torso);
  
  // Vest/gear
  const vestGeometry = new THREE.CylinderGeometry(0.42, 0.47, 0.9, 8);
  const vestMaterial = new THREE.MeshStandardMaterial({
    color: 0x333333,
    roughness: 0.8,
    metalness: 0.3
  });
  const vest = new THREE.Mesh(vestGeometry, vestMaterial);
  vest.position.y = 0.1;
  torsoGroup.add(vest);
  
  // Pockets/details
  const pocketGeometry = new THREE.BoxGeometry(0.15, 0.1, 0.05);
  const pocketMaterial = new THREE.MeshStandardMaterial({
    color: 0x222222,
    roughness: 0.7,
    metalness: 0.2
  });
  
  for (let i = 0; i < 2; i++) {
    const pocket = new THREE.Mesh(pocketGeometry, pocketMaterial);
    pocket.position.set(i * 0.2 - 0.1, -0.3, 0.42);
    torsoGroup.add(pocket);
  }
  
  return torsoGroup;
}

function createHead() {
  const headGroup = new THREE.Group();
  
  // Head base
  const headGeometry = new THREE.SphereGeometry(0.3, 16, 16);
  const headMaterial = new THREE.MeshStandardMaterial({
    color: 0xFFDBAC, // Skin tone
    roughness: 0.8,
    metalness: 0.1
  });
  const head = new THREE.Mesh(headGeometry, headMaterial);
  headGroup.add(head);
  
  // Simple eyes
  const eyeGeometry = new THREE.SphereGeometry(0.05, 8, 8);
  const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
  
  for (let i = 0; i < 2; i++) {
    const eye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    eye.position.set(i * 0.1 - 0.05, 0.05, 0.28);
    headGroup.add(eye);
  }
  
  return headGroup;
}

function createHelmet(color) {
  const helmetGroup = new THREE.Group();
  
  // Helmet base
  const helmetGeometry = new THREE.SphereGeometry(0.32, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  const helmetMaterial = new THREE.MeshStandardMaterial({
    color: color,
    roughness: 0.9,
    metalness: 0.2
  });
  const helmet = new THREE.Mesh(helmetGeometry, helmetMaterial);
  helmet.rotation.x = Math.PI;
  helmetGroup.add(helmet);
  
  // Helmet strap
  const strapGeometry = new THREE.TorusGeometry(0.3, 0.02, 8, 16, Math.PI);
  const strapMaterial = new THREE.MeshStandardMaterial({
    color: 0x222222,
    roughness: 0.8,
    metalness: 0.1
  });
  const strap = new THREE.Mesh(strapGeometry, strapMaterial);
  strap.rotation.x = Math.PI / 2;
  strap.position.y = 0.05;
  helmetGroup.add(strap);
  
  return helmetGroup;
}

function createLegs(color) {
  const legsGroup = new THREE.Group();
  
  const legGeometry = new THREE.CylinderGeometry(0.15, 0.2, 1.2, 8);
  const legMaterial = new THREE.MeshStandardMaterial({
    color: color,
    roughness: 0.9,
    metalness: 0.1
  });
  
  for (let i = 0; i < 2; i++) {
    const leg = new THREE.Mesh(legGeometry, legMaterial);
    leg.position.set(i * 0.25 - 0.125, -0.6, 0);
    legsGroup.add(leg);
    
    // Boots
    const bootGeometry = new THREE.BoxGeometry(0.25, 0.2, 0.3);
    const bootMaterial = new THREE.MeshStandardMaterial({
      color: 0x222222,
      roughness: 0.8,
      metalness: 0.3
    });
    const boot = new THREE.Mesh(bootGeometry, bootMaterial);
    boot.position.y = -0.7;
    leg.add(boot);
  }
  
  return legsGroup;
}

function createArms(color) {
  const armsGroup = new THREE.Group();
  
  const armGeometry = new THREE.CylinderGeometry(0.12, 0.15, 0.8, 8);
  const armMaterial = new THREE.MeshStandardMaterial({
    color: color,
    roughness: 0.9,
    metalness: 0.1
  });
  
  for (let i = 0; i < 2; i++) {
    const arm = new THREE.Mesh(armGeometry, armMaterial);
    arm.position.set(i * 0.6 - 0.3, 1.1, 0);
    arm.rotation.z = i === 0 ? 0.2 : -0.2;
    armsGroup.add(arm);
    
    // Gloves/hands
    const handGeometry = new THREE.SphereGeometry(0.1, 8, 8);
    const handMaterial = new THREE.MeshStandardMaterial({
      color: 0x222222,
      roughness: 0.8,
      metalness: 0.1
    });
    const hand = new THREE.Mesh(handGeometry, handMaterial);
    hand.position.y = i === 0 ? -0.45 : -0.45;
    arm.add(hand);
  }
  
  return armsGroup;
}

function createEquipment(type) {
  const equipmentGroup = new THREE.Group();
  
  // Rifle for all soldiers
  const rifle = createRifle();
  rifle.position.set(0.4, 1.1, 0);
  rifle.rotation.z = -0.3;
  equipmentGroup.add(rifle);
  
  // Additional equipment based on type
  if (type === "officer") {
    // Binoculars
    const binocularsGeometry = new THREE.BoxGeometry(0.15, 0.08, 0.1);
    const binocularsMaterial = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.5,
      metalness: 0.5
    });
    const binoculars = new THREE.Mesh(binocularsGeometry, binocularsMaterial);
    binoculars.position.set(-0.3, 1.5, 0.25);
    binoculars.rotation.z = 0.3;
    equipmentGroup.add(binoculars);
    
    // Radio on back
    const radioGeometry = new THREE.BoxGeometry(0.2, 0.15, 0.1);
    const radioMaterial = new THREE.MeshStandardMaterial({
      color: 0x444444,
      roughness: 0.7,
      metalness: 0.3
    });
    const radio = new THREE.Mesh(radioGeometry, radioMaterial);
    radio.position.set(0, 1.1, -0.4);
    equipmentGroup.add(radio);
    
    // Antenna
    const antennaGeometry = new THREE.CylinderGeometry(0.01, 0.01, 0.3, 8);
    const antennaMaterial = new THREE.MeshStandardMaterial({
      color: 0xCCCCCC,
      roughness: 0.4,
      metalness: 0.6
    });
    const antenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
    antenna.position.set(0, 1.35, -0.4);
    equipmentGroup.add(antenna);
  }
  
  // Sidearm for all soldiers
  const holsterGeometry = new THREE.BoxGeometry(0.1, 0.15, 0.05);
  const holsterMaterial = new THREE.MeshStandardMaterial({
    color: 0x222222,
    roughness: 0.8,
    metalness: 0.2
  });
  const holster = new THREE.Mesh(holsterGeometry, holsterMaterial);
  holster.position.set(-0.35, 0.9, 0.35);
  equipmentGroup.add(holster);
  
  return equipmentGroup;
}

function createRifle() {
  const rifleGroup = new THREE.Group();
  
  // Rifle body
  const bodyGeometry = new THREE.BoxGeometry(1.2, 0.05, 0.08);
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0x333333,
    roughness: 0.7,
    metalness: 0.4
  });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  rifleGroup.add(body);
  
  // Rifle stock
  const stockGeometry = new THREE.BoxGeometry(0.3, 0.1, 0.08);
  const stockMaterial = new THREE.MeshStandardMaterial({
    color: 0x5D4037,
    roughness: 0.8,
    metalness: 0.2
  });
  const stock = new THREE.Mesh(stockGeometry, stockMaterial);
  stock.position.set(-0.55, 0, 0);
  rifleGroup.add(stock);
  
  // Barrel
  const barrelGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.6, 8);
  const barrelMaterial = new THREE.MeshStandardMaterial({
    color: 0x666666,
    roughness: 0.5,
    metalness: 0.6
  });
  const barrel = new THREE.Mesh(barrelGeometry, barrelMaterial);
  barrel.position.set(0.65, 0, 0);
  barrel.rotation.z = Math.PI / 2;
  rifleGroup.add(barrel);
  
  // Magazine
  const magazineGeometry = new THREE.BoxGeometry(0.15, 0.2, 0.06);
  const magazineMaterial = new THREE.MeshStandardMaterial({
    color: 0x222222,
    roughness: 0.6,
    metalness: 0.4
  });
  const magazine = new THREE.Mesh(magazineGeometry, magazineMaterial);
  magazine.position.set(0.1, -0.1, 0);
  rifleGroup.add(magazine);
  
  // Scope (for some rifles)
  if (Math.random() > 0.7) {
    const scopeGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.15, 16);
    const scopeMaterial = new THREE.MeshStandardMaterial({
      color: 0x888888,
      roughness: 0.4,
      metalness: 0.7
    });
    const scope = new THREE.Mesh(scopeGeometry, scopeMaterial);
    scope.position.set(0.4, 0.05, 0);
    scope.rotation.z = Math.PI / 2;
    rifleGroup.add(scope);
    
    const lensGeometry = new THREE.CylinderGeometry(0.025, 0.025, 0.02, 16);
    const lensMaterial = new THREE.MeshStandardMaterial({
      color: 0x0000FF,
      roughness: 0.2,
      metalness: 0.1,
      transparent: true,
      opacity: 0.7
    });
    const lens = new THREE.Mesh(lensGeometry, lensMaterial);
    lens.position.set(0.48, 0.05, 0);
    lens.rotation.z = Math.PI / 2;
    rifleGroup.add(lens);
  }
  
  return rifleGroup;
}

// Update soldier animations and patrol movements
function updateSoldiers(deltaTime) {
  if (!window.soldierGroup) return;
  
  window.soldierGroup.children.forEach(soldier => {
    // Patrol movement for patrol-type soldiers
    if (soldier.userData.type === "patrol") {
      const patrolDistance = soldier.userData.patrolDistance;
      const patrolSpeed = soldier.userData.patrolSpeed;
      
      // Calculate new position along patrol path
      const angle = soldier.rotation.y;
      const newX = soldier.userData.originalPosition.x + 
                  Math.sin(clock.elapsedTime * patrolSpeed) * patrolDistance * Math.cos(angle);
      const newZ = soldier.userData.originalPosition.z + 
                  Math.sin(clock.elapsedTime * patrolSpeed) * patrolDistance * Math.sin(angle);
      
      soldier.position.x = newX;
      soldier.position.z = newZ;
      
      // Slight head movement to simulate looking around
      soldier.children[1].rotation.y = Math.sin(clock.elapsedTime * 2) * 0.1;
    }
    
    // Breathing animation for all soldiers
    const breatheAmount = Math.sin(clock.elapsedTime * 3) * 0.01;
    soldier.position.y = breatheAmount;
    
    // Slight weapon sway
    const weaponSway = Math.sin(clock.elapsedTime * 4) * 0.02;
    const rifle = soldier.children[5].children[0];
    rifle.rotation.z = -0.3 + weaponSway;
  });
}

// Replace the original createSoldiers call with:
window.soldierGroup = createSoldiers();

// Add to your animate function, before composer.render():
updateSoldiers(clock.getDelta());

