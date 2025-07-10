import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { FirstPersonControls } from 'three/examples/jsm/controls/FirstPersonControls';
import Stats from 'stats.js';
import * as dat from 'dat.gui';
import { Water } from 'three/examples/jsm/objects/Water.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';

// Team members:
// 1. [Your Name 1]
// 2. [Your Name 2]
// 3. [Your Name 3]

// Initialize scene, camera, renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Controls setup
let controls;
let controlsType = 'orbit'; // Default control type

// First person controls
const setupFirstPersonControls = () => {
  controls = new FirstPersonControls(camera, renderer.domElement);
  controls.movementSpeed = 5;
  controls.lookSpeed = 0.1;
  controls.lookVertical = true;
  controls.constrainVertical = true;
  controls.verticalMin = Math.PI / 4;
  controls.verticalMax = Math.PI / 2.1;
};

// Orbit controls
const setupOrbitControls = () => {
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  camera.position.set(0, 5, 20);
};

// Initial controls setup
setupOrbitControls();

// Stats.js for performance monitoring
const stats = new Stats();
document.body.appendChild(stats.dom);

// GUI for controls
const gui = new dat.GUI({ width: 300 });

// Controls switcher
const controlsFolder = gui.addFolder('Controls');
controlsFolder.add({ type: controlsType }, 'type', ['orbit', 'first-person']).name('Control Type').onChange((value) => {
  controlsType = value;
  // Save camera position and direction for smooth transition
  const cameraPos = camera.position.clone();
  
  if (value === 'first-person') {
    setupFirstPersonControls();
    // Set position for first person (inside the house)
    camera.position.set(0, 2, 1);
  } else {
    setupOrbitControls();
    // Return to outside view
    camera.position.copy(cameraPos);
  }
});
controlsFolder.open();

// Texture loader
const textureLoader = new THREE.TextureLoader();

// Load textures (including POV-Ray generated textures)
// Note: Replace these paths with your actual texture paths
const doorTexture = textureLoader.load('./textures/door/color.jpg');
const doorAlphaTexture = textureLoader.load('./textures/door/alpha.jpg');
const doorNormalTexture = textureLoader.load('./textures/door/normal.jpg');

const bricksTexture = textureLoader.load('./textures/bricks/color.jpg');
const bricksNormalTexture = textureLoader.load('./textures/bricks/normal.jpg');

// POV-Ray generated textures (must be created by you)
const floorTexture = textureLoader.load('./textures/floor/floor_povray.jpg'); // POV-Ray generated
const woodTexture = textureLoader.load('./textures/wood/wood_povray.jpg'); // POV-Ray generated
const carpetTexture = textureLoader.load('./textures/carpet/carpet.jpg');
const paintingTexture = textureLoader.load('./textures/painting/painting.jpg');
const bookshelfTexture = textureLoader.load('./textures/bookshelf/bookshelf.jpg');

// Set texture repeating and wrapping
floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping;
floorTexture.repeat.set(4, 4);

carpetTexture.wrapS = carpetTexture.wrapT = THREE.RepeatWrapping;
carpetTexture.repeat.set(2, 2);

// Skybox
const skyboxTexture = textureLoader.load('./textures/skybox/sky.jpg');
scene.background = skyboxTexture;

// Water shader for animation (small waterfall in garden)
const waterGeometry = new THREE.PlaneGeometry(10, 10);
const water = new Water(
  waterGeometry,
  {
    textureWidth: 512,
    textureHeight: 512,
    waterNormals: new THREE.TextureLoader().load('./textures/waternormals.jpg', function(texture) {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    }),
    sunDirection: new THREE.Vector3(),
    sunColor: 0xffffff,
    waterColor: 0x001e0f,
    distortionScale: 3.7,
    fog: scene.fog !== undefined
  }
);
water.rotation.x = -Math.PI / 2;
water.position.set(15, 0.5, 15);
scene.add(water);

// Sky
const sky = new Sky();
sky.scale.setScalar(10000);
scene.add(sky);

const skyUniforms = sky.material.uniforms;
skyUniforms['turbidity'].value = 10;
skyUniforms['rayleigh'].value = 2;
skyUniforms['mieCoefficient'].value = 0.005;
skyUniforms['mieDirectionalG'].value = 0.8;

// Sun
const sun = new THREE.Vector3();
const sunParams = {
  elevation: 2,
  azimuth: 180
};

function updateSun() {
  const phi = THREE.MathUtils.degToRad(90 - sunParams.elevation);
  const theta = THREE.MathUtils.degToRad(sunParams.azimuth);
  sun.setFromSphericalCoords(1, phi, theta);
  skyUniforms['sunPosition'].value.copy(sun);
  water.material.uniforms['sunDirection'].value.copy(sun).normalize();
}
updateSun();

// GUI for sun controls
const skyFolder = gui.addFolder('Sky & Sun');
skyFolder.add(sunParams, 'elevation', 0, 90, 0.1).name('Sun Elevation').onChange(updateSun);
skyFolder.add(sunParams, 'azimuth', -180, 180, 0.1).name('Sun Azimuth').onChange(updateSun);
skyFolder.open();

// Custom shader material for windows
const windowShaderMaterial = new THREE.ShaderMaterial({
  uniforms: {
    time: { value: 0 },
    resolution: { value: new THREE.Vector2() }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float time;
    varying vec2 vUv;
    
    void main() {
      vec2 uv = vUv * 2.0 - 1.0;
      float radius = length(uv);
      float intensity = 0.5 + 0.5 * sin(time) * (1.0 - radius);
      gl_FragColor = vec4(0.8, 0.9, 1.0, 0.7) * intensity;
    }
  `,
  transparent: true,
  side: THREE.DoubleSide
});

// House construction
const house = new THREE.Group();
scene.add(house);

// Floor
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(30, 30),
  new THREE.MeshStandardMaterial({
    map: floorTexture,
    roughness: 0.3,
    metalness: 0.1
  })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// Walls
const walls = new THREE.Mesh(
  new THREE.BoxGeometry(6, 4, 6),
  new THREE.MeshStandardMaterial({
    map: bricksTexture,
    normalMap: bricksNormalTexture,
    roughness: 0.3
  })
);
walls.position.y = 2;
walls.castShadow = true;
house.add(walls);

// Interior walls (room dividers)
const interiorWall = new THREE.Mesh(
  new THREE.BoxGeometry(6, 4, 0.2),
  new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.2
  })
);
interiorWall.position.set(0, 2, 0);
house.add(interiorWall);

// Door in interior wall
const interiorDoor = new THREE.Mesh(
  new THREE.PlaneGeometry(1.2, 2.5),
  new THREE.MeshStandardMaterial({
    color: 0x8B4513,
    roughness: 0.3
  })
);
interiorDoor.position.set(1.5, 1.25, 0.11);
house.add(interiorDoor);

// Roof
const roof = new THREE.Mesh(
  new THREE.ConeGeometry(4.5, 1.5, 4),
  new THREE.MeshStandardMaterial({ 
    color: 0x8B4513,
    roughness: 0.6
  })
);
roof.position.y = 4.75;
roof.rotation.y = Math.PI / 4;
house.add(roof);

// Door
const door = new THREE.Mesh(
  new THREE.PlaneGeometry(2, 3, 10, 10),
  new THREE.MeshStandardMaterial({
    map: doorTexture,
    alphaMap: doorAlphaTexture,
    normalMap: doorNormalTexture,
    transparent: true,
    roughness: 0.2
  })
);
door.position.set(0, 1.5, 3.01);
house.add(door);

// Windows with shader material
const windowGeometry = new THREE.PlaneGeometry(1.5, 1.5);
const window1 = new THREE.Mesh(windowGeometry, windowShaderMaterial);
window1.position.set(-2, 2.5, 3.01);
house.add(window1);

const window2 = new THREE.Mesh(windowGeometry, windowShaderMaterial);
window2.position.set(2, 2.5, 3.01);
house.add(window2);

// INTERIOR DESIGN ELEMENTS

// Living room area (front of house)
const livingRoom = new THREE.Group();
house.add(livingRoom);
livingRoom.position.set(0, 0, 1.5);

// Carpet
const carpet = new THREE.Mesh(
  new THREE.PlaneGeometry(3, 3),
  new THREE.MeshStandardMaterial({
    map: carpetTexture,
    roughness: 0.5
  })
);
carpet.rotation.x = -Math.PI / 2;
carpet.position.y = 0.01; // Slightly above floor to prevent z-fighting
livingRoom.add(carpet);

// Coffee table
const coffeeTable = new THREE.Mesh(
  new THREE.BoxGeometry(1.2, 0.4, 0.8),
  new THREE.MeshStandardMaterial({ 
    map: woodTexture,
    roughness: 0.3
  })
);
coffeeTable.position.set(0, 0.2, 0);
coffeeTable.castShadow = true;
livingRoom.add(coffeeTable);

// Sofa
const createSofa = () => {
  const sofa = new THREE.Group();
  
  // Base
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(2, 0.5, 0.8),
    new THREE.MeshStandardMaterial({ color: 0x6B8E23, roughness: 0.7 })
  );
  base.position.y = 0.25;
  sofa.add(base);
  
  // Back
  const back = new THREE.Mesh(
    new THREE.BoxGeometry(2, 0.8, 0.2),
    new THREE.MeshStandardMaterial({ color: 0x6B8E23, roughness: 0.7 })
  );
  back.position.set(0, 0.75, -0.3);
  sofa.add(back);
  
  // Armrests
  const armrest1 = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.7, 0.8),
    new THREE.MeshStandardMaterial({ color: 0x6B8E23, roughness: 0.7 })
  );
  armrest1.position.set(-1.1, 0.35, 0);
  sofa.add(armrest1);
  
  const armrest2 = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.7, 0.8),
    new THREE.MeshStandardMaterial({ color: 0x6B8E23, roughness: 0.7 })
  );
  armrest2.position.set(1.1, 0.35, 0);
  sofa.add(armrest2);
  
  // Cushions
  for (let i = 0; i < 3; i++) {
    const cushion = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.1, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.8 })
    );
    cushion.position.set((i - 1) * 0.65, 0.55, 0);
    sofa.add(cushion);
  }
  
  return sofa;
};

const sofa = createSofa();
sofa.position.set(0, 0, -1);
sofa.rotation.y = Math.PI;
livingRoom.add(sofa);

// TV stand
const tvStand = new THREE.Mesh(
  new THREE.BoxGeometry(1.8, 0.6, 0.4),
  new THREE.MeshStandardMaterial({ 
    map: woodTexture,
    roughness: 0.3
  })
);
tvStand.position.set(0, 0.3, -2);
livingRoom.add(tvStand);

// TV
const tv = new THREE.Mesh(
  new THREE.BoxGeometry(1.6, 0.9, 0.1),
  new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1, metalness: 0.5 })
);
tv.position.set(0, 1.1, -2);
livingRoom.add(tv);

// TV screen
const tvScreen = new THREE.Mesh(
  new THREE.PlaneGeometry(1.5, 0.8),
  new THREE.MeshBasicMaterial({ color: 0x3366cc })
);
tvScreen.position.set(0, 1.1, -1.95);
livingRoom.add(tvScreen);

// Kitchen/dining area (back of house)
const kitchen = new THREE.Group();
house.add(kitchen);
kitchen.position.set(0, 0, -1.5);

// Dining table
const diningTable = new THREE.Mesh(
  new THREE.BoxGeometry(1.8, 0.1, 1.2),
  new THREE.MeshStandardMaterial({ 
    map: woodTexture,
    roughness: 0.2
  })
);
diningTable.position.set(0, 0.75, 0);
diningTable.castShadow = true;
kitchen.add(diningTable);

// Table legs
for (let x = -0.8; x <= 0.8; x += 1.6) {
  for (let z = -0.5; z <= 0.5; z += 1) {
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.7, 8),
      new THREE.MeshStandardMaterial({ map: woodTexture })
    );
    leg.position.set(x, 0.35, z);
    diningTable.add(leg);
  }
}

// Chairs
const chairLegGeometry = new THREE.BoxGeometry(0.1, 0.5, 0.1);
const chairSeatGeometry = new THREE.BoxGeometry(0.5, 0.1, 0.5);
const chairMaterial = new THREE.MeshStandardMaterial({ map: woodTexture });

function createChair(x, z, rotation) {
  const chair = new THREE.Group();
  
  // Legs
  const leg1 = new THREE.Mesh(chairLegGeometry, chairMaterial);
  leg1.position.set(-0.2, 0.25, -0.2);
  
  const leg2 = new THREE.Mesh(chairLegGeometry, chairMaterial);
  leg2.position.set(0.2, 0.25, -0.2);
  
  const leg3 = new THREE.Mesh(chairLegGeometry, chairMaterial);
  leg3.position.set(-0.2, 0.25, 0.2);
  
  const leg4 = new THREE.Mesh(chairLegGeometry, chairMaterial);
  leg4.position.set(0.2, 0.25, 0.2);
  
  // Seat
  const seat = new THREE.Mesh(chairSeatGeometry, chairMaterial);
  seat.position.y = 0.5;
  
  // Back
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.1), chairMaterial);
  back.position.set(0, 0.75, -0.25);
  
  chair.add(leg1, leg2, leg3, leg4, seat, back);
  chair.position.set(x, 0, z);
  chair.rotation.y = rotation;
  
  return chair;
}

// Add chairs around dining table
kitchen.add(createChair(-0.7, 0, Math.PI / 2));
kitchen.add(createChair(0.7, 0, -Math.PI / 2));
kitchen.add(createChair(0, 0.7, Math.PI));
kitchen.add(createChair(0, -0.7, 0));

// Kitchen counter
const counter = new THREE.Mesh(
  new THREE.BoxGeometry(2.5, 0.8, 0.6),
  new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.3 })
);
counter.position.set(1.5, 0.4, -2);
kitchen.add(counter);

// Kitchen sink
const sink = new THREE.Mesh(
  new THREE.BoxGeometry(0.6, 0.1, 0.4),
  new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.7, roughness: 0.2 })
);
sink.position.set(1.5, 0.85, -2);
kitchen.add(sink);

// Faucet
const faucet = new THREE.Mesh(
  new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8),
  new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.7, roughness: 0.1 })
);
faucet.position.set(1.5, 1.0, -2.15);
faucet.rotation.x = Math.PI / 2;
kitchen.add(faucet);

// Cabinets
const cabinet = new THREE.Mesh(
  new THREE.BoxGeometry(2.5, 1.2, 0.5),
  new THREE.MeshStandardMaterial({ map: woodTexture, roughness: 0.4 })
);
cabinet.position.set(1.5, 1.9, -2.2);
kitchen.add(cabinet);

// Decorative Elements
// Picture frame on wall
const pictureFrame = new THREE.Mesh(
  new THREE.BoxGeometry(1, 0.8, 0.05),
  new THREE.MeshStandardMaterial({ color: 0x8B4513 })
);
pictureFrame.position.set(-2, 2.5, -2.9);
house.add(pictureFrame);

// Painting inside frame
const painting = new THREE.Mesh(
  new THREE.PlaneGeometry(0.9, 0.7),
  new THREE.MeshBasicMaterial({ map: paintingTexture })
);
painting.position.set(-2, 2.5, -2.87);
house.add(painting);

// Bookshelf
const bookshelf = new THREE.Mesh(
  new THREE.BoxGeometry(1.2, 2, 0.4),
  new THREE.MeshStandardMaterial({ map: bookshelfTexture })
);
bookshelf.position.set(-2, 1, -2.7);
house.add(bookshelf);

// Create books on shelves
const createBooks = (x, y, z) => {
  const bookGroup = new THREE.Group();
  const bookColors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff];
  
  for (let i = 0; i < 6; i++) {
    const book = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.3, 0.2),
      new THREE.MeshStandardMaterial({ color: bookColors[i % bookColors.length], roughness: 0.5 })
    );
    book.position.set(x + i * 0.12 - 0.3, y, z);
    bookGroup.add(book);
  }
  
  return bookGroup;
};

// Add books to bookshelf
house.add(createBooks(-2, 0.3, -2.7));
house.add(createBooks(-2, 0.8, -2.7));
house.add(createBooks(-2, 1.3, -2.7));
house.add(createBooks(-2, 1.8, -2.7));

// Add a plant
const plantPot = new THREE.Mesh(
  new THREE.CylinderGeometry(0.2, 0.15, 0.3, 16),
  new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.7 })
);
plantPot.position.set(2.5, 0.15, -2.7);
house.add(plantPot);

const plantFoliage = new THREE.Mesh(
  new THREE.SphereGeometry(0.3, 8, 8),
  new THREE.MeshStandardMaterial({ color: 0x3a5f0b, roughness: 0.8 })
);
plantFoliage.position.set(2.5, 0.5, -2.7);
house.add(plantFoliage);

// Lighting
// Sun light (main directional light)
const sunLight = new THREE.DirectionalLight(0xffffff, 1);
sunLight.position.copy(sun);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 500;
scene.add(sunLight);

// Ambient light
const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
scene.add(ambientLight);

// Interior lights
// Living room light
const livingRoomLight = new THREE.PointLight(0xffccaa, 1, 10, 2);
livingRoomLight.position.set(0, 3, 1);
livingRoomLight.castShadow = true;
house.add(livingRoomLight);

// Kitchen light
const kitchenLight = new THREE.PointLight(0xffffff, 1, 8, 2);
kitchenLight.position.set(0, 3, -2);
kitchenLight.castShadow = true;
house.add(kitchenLight);

// Table lamp
const lampBase = new THREE.Mesh(
  new THREE.CylinderGeometry(0.1, 0.15, 0.5, 16),
  new THREE.MeshStandardMaterial({ color: 0xaaaaaa })
);
lampBase.position.set(-1.5, 0.9, -1.5);
house.add(lampBase);

const lampShade = new THREE.Mesh(
  new THREE.CylinderGeometry(0.2, 0.3, 0.3, 16, 1, true),
  new THREE.MeshStandardMaterial({ color: 0xffffcc, transparent: true, opacity: 0.8 })
);
lampShade.position.set(-1.5, 1.3, -1.5);
house.add(lampShade);

const lampLight = new THREE.PointLight(0xffffcc, 0.8, 5, 2);
lampLight.position.set(-1.5, 1.3, -1.5);
house.add(lampLight);

// GUI controls for lights
const lightFolder = gui.addFolder('Lights');
lightFolder.add(sunLight, 'intensity', 0, 2, 0.01).name('Sun Intensity');
lightFolder.add(ambientLight, 'intensity', 0, 1, 0.01).name('Ambient Light');
lightFolder.add(livingRoomLight, 'intensity', 0, 2, 0.01).name('Living Room Light');
lightFolder.add(kitchenLight, 'intensity', 0, 2, 0.01).name('Kitchen Light');
lightFolder.add(lampLight, 'intensity', 0, 2, 0.01).name('Table Lamp');
lightFolder.open();

// Garden with bushes
const garden = new THREE.Group();
scene.add(garden);

// Bushes
const bushGeometry = new THREE.SphereGeometry(0.5, 8, 8);
const bushMaterial = new THREE.MeshStandardMaterial({ color: 0x3a5f0b });
for (let i = 0; i < 10; i++) {
  const bush = new THREE.Mesh(bushGeometry, bushMaterial);
  bush.position.set(
    Math.random() * 20 - 10,
    0.5,
    Math.random() * 20 - 10
  );
  bush.scale.set(
    1 + Math.random(),
    1 + Math.random(),
    1 + Math.random()
  );
  bush.castShadow = true;
  garden.add(bush);
}

// Animation loop
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  
  const delta = clock.getDelta();
  const time = clock.getElapsedTime();
  
  // Update water animation
  water.material.uniforms['time'].value += delta;
  
  // Update window shader
  windowShaderMaterial.uniforms.time.value = time;
  
  // Animate lamp light slightly
  if (lampLight) {
    lampLight.intensity = 0.8 + 0.1 * Math.sin(time * 2);
  }
  
  // Update controls
  if (controlsType === 'first-person') {
    controls.update(delta);
  } else {
    controls.update();
  }
  
  // Render
  renderer.render(scene, camera);
  
  // Update stats
  stats.update();
}

animate();

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Instructions in HTML
const instructions = document.createElement('div');
instructions.style.position = 'absolute';
instructions.style.top = '10px';
instructions.style.left = '10px';
instructions.style.color = 'white';
instructions.style.backgroundColor = 'rgba(0,0,0,0.5)';
instructions.style.padding = '10px';
instructions.style.borderRadius = '5px';
instructions.innerHTML = `
  <h2>House Exploration</h2>
  <p>Toggle between orbit and first-person controls using the Controls panel.</p>
  <p>First-person controls: WASD to move, mouse to look</p>
  <p>Orbit controls: Left click + drag to rotate, right click + drag to pan, scroll to zoom</p>
`;
document.body.appendChild(instructions);