// Original Xinhuo red-panda character. Copyright (c) 2026 liuli-cc. MIT License.
// Geometry, palette, expressions, and rig are authored here; no external character assets.
import * as THREE from "three";

export type LiuliRig = {
  root: THREE.Group;
  head: THREE.Group;
  arms: THREE.Group[];
  forearms: THREE.Group[];
  feet: THREE.Group[];
  ears: THREE.Group[];
  eyes: THREE.Group[];
  brows: THREE.Mesh[];
  mouth: THREE.Mesh;
  smile: THREE.Group;
  tail: THREE.Group;
};

export function createLiuliRig(): LiuliRig {
  const root = new THREE.Group();
  root.name = "LiuliOriginalRedPanda";
  // Reuse geometry and materials: all rounded body details share one sphere buffer.
  const sphere = new THREE.SphereGeometry(1, 24, 16);
  const material = (color: number, roughness = 0.76) => new THREE.MeshStandardMaterial({ color, roughness });
  const fur = material(0xd27648);
  const amber = material(0xe2915b);
  const cream = material(0xffead0);
  const dark = material(0x4b3337);
  const cocoa = material(0x713f39);
  const pink = material(0xe4a296);
  const vest = material(0x656eac);
  const vestLight = material(0x929bc9);
  const ink = material(0x211f2b, 0.3);
  const white = material(0xffffff, 0.4);

  const ball = (parent: THREE.Object3D, mat: THREE.Material, position: number[], scale: number[]) => {
    const mesh = new THREE.Mesh(sphere, mat);
    mesh.position.set(position[0], position[1], position[2]);
    mesh.scale.set(scale[0], scale[1], scale[2]);
    parent.add(mesh);
    return mesh;
  };

  // A softly tailored vest keeps the playful mascot grounded in the interview setting.
  ball(root, dark, [0, -0.48, 0], [0.46, 0.64, 0.34]);
  ball(root, vest, [0, -0.14, 0.015], [0.52, 0.59, 0.36]);
  ball(root, cream, [0, 0.11, 0.31], [0.27, 0.3, 0.08]);
  [-1, 1].forEach(side => {
    const lapel = ball(root, vestLight, [side * 0.13, 0.14, 0.345], [0.075, 0.23, 0.025]);
    lapel.rotation.z = side * -0.4;
  });
  ball(root, cream, [0, -0.18, 0.38], [0.032, 0.032, 0.016]);
  ball(root, cream, [0, -0.37, 0.36], [0.032, 0.032, 0.016]);
  const badge = ball(root, cream, [-0.27, 0.02, 0.335], [0.085, 0.085, 0.02]);
  badge.rotation.y = -0.2;
  ball(root, amber, [-0.27, 0.02, 0.358], [0.041, 0.048, 0.011]);

  const head = new THREE.Group();
  head.position.set(0, 0.81, 0.035);
  root.add(head);
  ball(head, fur, [0, 0.08, 0], [0.7, 0.6, 0.46]);
  ball(head, amber, [0, 0.31, 0.025], [0.51, 0.37, 0.44]);
  // Cream cheek ruffs and a compact muzzle make the silhouette recognisably a red panda.
  [-1, 1].forEach(side => {
    const cheek = ball(head, cream, [side * 0.45, -0.15, 0.26], [0.28, 0.27, 0.25]);
    cheek.rotation.z = side * -0.38;
    ball(head, cream, [side * 0.22, -0.2, 0.405], [0.29, 0.235, 0.17]);
    ball(head, pink, [side * 0.44, -0.165, 0.493], [0.09, 0.038, 0.015]);
  });
  ball(head, cream, [0, -0.22, 0.43], [0.26, 0.22, 0.14]);

  const ears: THREE.Group[] = [];
  const eyes: THREE.Group[] = [];
  const brows: THREE.Mesh[] = [];
  [-1, 1].forEach(side => {
    const ear = new THREE.Group();
    ear.position.set(side * 0.48, 0.53, -0.01);
    ear.rotation.z = side * -0.26;
    head.add(ear);
    ball(ear, dark, [0, 0.09, 0], [0.25, 0.31, 0.15]);
    ball(ear, cream, [0, 0.09, 0.07], [0.2, 0.26, 0.11]);
    ball(ear, pink, [0, 0.075, 0.15], [0.115, 0.16, 0.025]);
    ears.push(ear);

    const eyePatch = ball(head, cocoa, [side * 0.26, 0.047, 0.424], [0.165, 0.21, 0.062]);
    eyePatch.rotation.z = side * 0.25;
    const eye = new THREE.Group();
    eye.position.set(side * 0.255, 0.09, 0.473);
    head.add(eye);
    ball(eye, ink, [0, 0, 0], [0.083, 0.105, 0.049]);
    ball(eye, white, [-0.025, 0.035, 0.041], [0.025, 0.03, 0.012]);
    ball(eye, white, [0.022, -0.025, 0.044], [0.012, 0.014, 0.008]);
    eyes.push(eye);
    const brow = ball(head, cream, [side * 0.255, 0.31, 0.426], [0.14, 0.059, 0.04]);
    brow.rotation.z = side * -0.2;
    brows.push(brow);
  });

  ball(head, ink, [0, -0.09, 0.578], [0.084, 0.057, 0.046]);
  ball(head, white, [-0.02, -0.073, 0.615], [0.022, 0.01, 0.004]);
  const mouth = ball(head, dark, [0, -0.245, 0.575], [0.085, 0.075, 0.018]);
  const tongue = ball(mouth, pink, [0, -0.4, 0.9], [0.61, 0.36, 0.22]);
  tongue.name = "tongue";
  const smile = new THREE.Group();
  smile.position.set(0, -0.2, 0.576);
  head.add(smile);
  [-1, 1].forEach(side => {
    const line = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.008, 6, 14, Math.PI * 0.83), dark);
    line.rotation.z = Math.PI * 1.09;
    line.position.x = side * 0.047;
    smile.add(line);
  });

  const arms: THREE.Group[] = [];
  const forearms: THREE.Group[] = [];
  const feet: THREE.Group[] = [];
  [-1, 1].forEach(side => {
    const arm = new THREE.Group();
    arm.position.set(side * 0.45, 0.14, 0);
    root.add(arm);
    ball(arm, fur, [0, -0.2, 0], [0.165, 0.31, 0.16]);
    const forearm = new THREE.Group();
    forearm.position.y = -0.4;
    arm.add(forearm);
    ball(forearm, dark, [0, -0.15, 0.04], [0.16, 0.26, 0.165]);
    ball(forearm, cocoa, [0, -0.25, 0.182], [0.088, 0.097, 0.016]);
    [-1, 0, 1].forEach(toe => ball(forearm, cocoa, [toe * 0.066, -0.13, 0.185], [0.027, 0.035, 0.012]));
    ball(forearm, dark, [side * -0.12, -0.17, 0.1], [0.073, 0.12, 0.09]);
    arms.push(arm);
    forearms.push(forearm);
    const foot = new THREE.Group();
    foot.position.set(side * 0.235, -0.85, 0.01);
    root.add(foot);
    ball(foot, dark, [0, -0.2, 0], [0.185, 0.29, 0.19]);
    ball(foot, dark, [0, -0.4, 0.1], [0.23, 0.145, 0.285]);
    [-1, 0, 1].forEach(toe => ball(foot, cocoa, [toe * 0.085, -0.405, 0.36], [0.02, 0.025, 0.012]));
    feet.push(foot);
  });

  const tail = new THREE.Group();
  tail.position.set(0.31, -0.65, -0.2);
  root.add(tail);
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.37, -0.05, -0.11),
    new THREE.Vector3(0.72, 0.08, -0.13), new THREE.Vector3(0.87, 0.42, -0.04),
    new THREE.Vector3(0.84, 0.77, 0.04),
  ]);
  const geometry = new THREE.TubeGeometry(curve, 40, 0.19, 12, false);
  const positions = geometry.getAttribute("position");
  const colors = new Float32Array(positions.count * 3);
  const orangeColor = new THREE.Color(0xd27648);
  const creamColor = new THREE.Color(0xf4bc83);
  for (let i = 0; i < positions.count; i += 1) {
    const segment = Math.floor(i / 13);
    const color = Math.floor(segment / 5) % 2 === 0 ? orangeColor : creamColor;
    color.toArray(colors, i * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  tail.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 })));
  ball(tail, cream, [0.84, 0.77, 0.04], [0.187, 0.2, 0.187]);
  // Batch stationary repeated details within each joint. Animated eyes/ears still move as a group.
  const independentlyAnimated = new Set<THREE.Object3D>([mouth, ...brows]);
  const batchDetails = (parent: THREE.Object3D) => {
    [...parent.children].forEach(child => { if (child instanceof THREE.Group) batchDetails(child); });
    const byMaterial = new Map<THREE.Material, THREE.Mesh[]>();
    [...parent.children].forEach(child => {
      if (!(child instanceof THREE.Mesh) || child.geometry !== sphere || child.children.length || independentlyAnimated.has(child) || Array.isArray(child.material)) return;
      const group = byMaterial.get(child.material) ?? [];
      group.push(child);
      byMaterial.set(child.material, group);
    });
    byMaterial.forEach((meshes, mat) => {
      if (meshes.length < 2) return;
      const instances = new THREE.InstancedMesh(sphere, mat, meshes.length);
      meshes.forEach((mesh, index) => {
        mesh.updateMatrix();
        instances.setMatrixAt(index, mesh.matrix);
        parent.remove(mesh);
      });
      instances.instanceMatrix.needsUpdate = true;
      parent.add(instances);
    });
  };
  batchDetails(root);
  return { root, head, arms, forearms, feet, ears, eyes, brows, mouth, smile, tail };
}

export function disposeLiuliScene(scene: THREE.Scene) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  scene.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => materials.add(material));
    if (object instanceof THREE.InstancedMesh) object.dispose();
  });
  geometries.forEach(geometry => geometry.dispose());
  materials.forEach(material => material.dispose());
}
