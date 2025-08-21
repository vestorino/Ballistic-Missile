import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import GUI from 'lil-gui';
//
let scene, camera, renderer, missile, clock;
let phase = "boost";
let followOffset = new THREE.Vector3(0, 5, -15);
let cameraMode = "overview";
let boostEnded = false;

const phaseText = document.getElementById("phaseText");
const TARGET_TILT_ANGLE = THREE.MathUtils.degToRad(45); // tilt to 45° by end of boost
//test
// === Init Scene ===
scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb); // Sky blue
scene.fog = new THREE.FogExp2(0x87ceeb, 0.002); // Add atmospheric fog

camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 10, 30);

renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

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

// Add exhaust flame during boost phase
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

// === Skybox ===
const skyGeometry = new THREE.SphereGeometry(500, 32, 32);
const skyMaterial = new THREE.MeshBasicMaterial({ 
  color: 0x87CEEB,
  side: THREE.BackSide
});
const skybox = new THREE.Mesh(skyGeometry, skyMaterial);
scene.add(skybox);


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
  initialFuel:50,      // kg
fuelBurnRate: 5,       // kg/s
fuelLeft: 50        // track remaining fuel

};

// === Trail Effect ===
const trailPoints = [];
const trailGeometry = new THREE.BufferGeometry();
const trailMaterial = new THREE.LineBasicMaterial({ color: 0xff9900 });
const trail = new THREE.Line(trailGeometry, trailMaterial);
scene.add(trail);

function updateTrail() {
  if (!params.showTrail) {
    trail.visible = false;
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
}

// === GUI Setup ===
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
displayFolder.add({ cameraMode: "overview" }, 'cameraMode', ["overview", "follow", "fixed", "free"]).name("Camera Mode").onChange((val) => {
  cameraMode = val;

});
displayFolder.add(params, 'fuelLeft').name("Fuel Left (kg)").listen();

const controlsFolder = gui.addFolder('Controls');
controlsFolder.add(params, 'paused').name("⏯ Pause");
controlsFolder.add(params, 'reset').name("🔁 Reset");
controlsFolder.add({ start: () => { 
  params.paused = false;
  clock.start(); 
}}, 'start').name("▶ Start");

// Open folders by default
physicsFolder.open();
displayFolder.open();
controlsFolder.open();

function resetSimulation() {
  params.paused = true;
  clock.stop();
  clock.elapsedTime = 0;
  velocity.set(0, 0, 0);
  position.set(0, 3.5, 0);
  missile.position.copy(position);
  trailPoints.length = 0;
  updateTrail();
  flame.visible = false;
  phase = "Boost";
  phaseText.textContent = "Current Phase: Boost";
  boostEnded = false;
params.fuelLeft = params.initialFuel;

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

function animate() {
  requestAnimationFrame(animate);

  if (params.paused) {
    renderer.render(scene, camera);
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
    velocity.set(0, 0, 0);
    phase = "Impact";
    phaseText.textContent = "Current Phase: Impact 💥";
    missile.position.y = 2.5;
  }

  // Update trail
  updateTrail();

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



  renderer.render(scene, camera);
}

animate();


window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});




