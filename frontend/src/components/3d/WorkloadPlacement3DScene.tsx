import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Workload } from '../../types';

interface WorkloadPlacement3DSceneProps {
  workloads: Workload[];
  selectedWorkloadId: string | null;
  onSelectWorkload: (id: string) => void;
}

/**
 * 3D Workload Placement Visualizer
 * Renders an interactive 3D spatial representation showing where workloads are hosted:
 * - Left: On-Premises Karnataka Private DC Chassis (Deep Teal)
 * - Right: Approved Public / Sovereign Cloud Cluster (Electric Cyan / Blue)
 * - Workload Nodes: Glowing data orbs positioned at their respective placement rack.
 */
export const WorkloadPlacement3DScene: React.FC<WorkloadPlacement3DSceneProps> = ({
  workloads,
  selectedWorkloadId,
  onSelectWorkload,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef(selectedWorkloadId);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  useEffect(() => {
    selectedRef.current = selectedWorkloadId;
  }, [selectedWorkloadId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x07111f, 0.07);

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      50
    );
    camera.position.set(0, 1.6, 9.5);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 2. Lights
    const ambientLight = new THREE.AmbientLight(0x0b1728, 2.2);
    scene.add(ambientLight);

    const tealSpot = new THREE.SpotLight(0x48d9d0, 4.5, 25, Math.PI / 4, 0.4);
    tealSpot.position.set(-6, 8, 6);
    tealSpot.castShadow = true;
    scene.add(tealSpot);

    const blueSpot = new THREE.SpotLight(0x648cff, 4.5, 25, Math.PI / 4, 0.4);
    blueSpot.position.set(6, 8, 6);
    blueSpot.castShadow = true;
    scene.add(blueSpot);

    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    // Ground Perspective Disc
    const groundGeo = new THREE.CylinderGeometry(5.2, 5.2, 0.08, 48);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x081322,
      roughness: 0.3,
      metalness: 0.9,
    });
    const groundDisc = new THREE.Mesh(groundGeo, groundMat);
    groundDisc.position.y = -2.2;
    groundDisc.receiveShadow = true;
    rootGroup.add(groundDisc);

    // 3. Left Rack: On-Premises Karnataka DC
    const localRackGroup = new THREE.Group();
    localRackGroup.position.set(-2.5, -0.2, 0);

    const localChassisGeo = new THREE.BoxGeometry(2.0, 3.8, 1.4);
    const localChassisMat = new THREE.MeshStandardMaterial({
      color: 0x0b1e22,
      roughness: 0.35,
      metalness: 0.85,
    });
    const localChassis = new THREE.Mesh(localChassisGeo, localChassisMat);
    localChassis.castShadow = true;
    localChassis.receiveShadow = true;
    localRackGroup.add(localChassis);

    // Glass panel
    const localGlassGeo = new THREE.BoxGeometry(1.9, 3.6, 0.05);
    const localGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0x48d9d0,
      transparent: true,
      opacity: 0.25,
      roughness: 0.1,
      transmission: 0.7,
    });
    const localGlass = new THREE.Mesh(localGlassGeo, localGlassMat);
    localGlass.position.z = 0.72;
    localRackGroup.add(localGlass);

    // Beacon
    const beaconGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.6, 16);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0x48d9d0 });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.set(0, 2.2, 0);
    localRackGroup.add(beacon);

    rootGroup.add(localRackGroup);

    // 4. Right Rack: Public / Sovereign Cloud Cluster
    const cloudRackGroup = new THREE.Group();
    cloudRackGroup.position.set(2.5, -0.2, 0);

    const cloudChassisGeo = new THREE.BoxGeometry(2.0, 3.8, 1.4);
    const cloudChassisMat = new THREE.MeshStandardMaterial({
      color: 0x0c1e34,
      roughness: 0.35,
      metalness: 0.85,
    });
    const cloudChassis = new THREE.Mesh(cloudChassisGeo, cloudChassisMat);
    cloudChassis.castShadow = true;
    cloudChassis.receiveShadow = true;
    cloudRackGroup.add(cloudChassis);

    // Glass panel
    const cloudGlassGeo = new THREE.BoxGeometry(1.9, 3.6, 0.05);
    const cloudGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0x648cff,
      transparent: true,
      opacity: 0.25,
      roughness: 0.1,
      transmission: 0.7,
    });
    const cloudGlass = new THREE.Mesh(cloudGlassGeo, cloudGlassMat);
    cloudGlass.position.z = 0.72;
    cloudRackGroup.add(cloudGlass);

    // Cloud Halo Ring
    const haloGeo = new THREE.TorusGeometry(1.4, 0.04, 16, 48);
    const haloMat = new THREE.MeshBasicMaterial({ color: 0x648cff, transparent: true, opacity: 0.4 });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.rotation.x = Math.PI / 2.2;
    halo.position.set(0, 2.3, 0);
    cloudRackGroup.add(halo);

    rootGroup.add(cloudRackGroup);

    // Optical Bridge connecting DC and Cloud
    const bridgeCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-2.5, 1.8, 0),
      new THREE.Vector3(0, 3.2, -1.0),
      new THREE.Vector3(2.5, 1.8, 0)
    );
    const bridgeGeo = new THREE.TubeGeometry(bridgeCurve, 32, 0.03, 8, false);
    const bridgeMat = new THREE.MeshBasicMaterial({ color: 0x48d9d0, transparent: true, opacity: 0.4 });
    const bridge = new THREE.Mesh(bridgeGeo, bridgeMat);
    rootGroup.add(bridge);

    // 5. Workload Nodes Floating around the respective racks
    const workloadInteractables: {
      id: string;
      mesh: THREE.Mesh;
      basePos: THREE.Vector3;
      pulseOffset: number;
    }[] = [];

    // Distribute workloads based on their hosting location
    const localWorkloads = workloads.filter(
      (w) => w.current_placement.includes('karnataka') || w.current_placement.includes('dc')
    );
    const cloudWorkloads = workloads.filter(
      (w) => !w.current_placement.includes('karnataka') && !w.current_placement.includes('dc')
    );

    // Helper to spawn workload node
    const spawnWorkloadNode = (w: Workload, xCenter: number, idx: number, total: number, color: number) => {
      const angle = (idx / Math.max(total, 1)) * Math.PI * 1.6 - Math.PI * 0.8;
      const radius = 1.6 + (idx % 2) * 0.35;
      const x = xCenter + Math.sin(angle) * radius;
      const y = -0.5 + (idx % 4) * 0.7;
      const z = Math.cos(angle) * 0.9;

      const nodeGeo = new THREE.SphereGeometry(0.18, 16, 16);
      const nodeMat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.6,
        roughness: 0.2,
        metalness: 0.5,
      });
      const nodeMesh = new THREE.Mesh(nodeGeo, nodeMat);
      nodeMesh.position.set(x, y, z);
      nodeMesh.castShadow = true;
      rootGroup.add(nodeMesh);

      // Outer glowing halo
      const outerRingGeo = new THREE.RingGeometry(0.24, 0.28, 16);
      const outerRingMat = new THREE.MeshBasicMaterial({
        color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.6,
      });
      const outerRing = new THREE.Mesh(outerRingGeo, outerRingMat);
      outerRing.rotation.x = Math.PI / 2;
      nodeMesh.add(outerRing);

      workloadInteractables.push({
        id: w.id,
        mesh: nodeMesh,
        basePos: new THREE.Vector3(x, y, z),
        pulseOffset: idx * 1.2,
      });
    };

    localWorkloads.forEach((w, i) => spawnWorkloadNode(w, -2.5, i, localWorkloads.length, 0x48d9d0));
    cloudWorkloads.forEach((w, i) => spawnWorkloadNode(w, 2.5, i, cloudWorkloads.length, 0x648cff));

    // 6. Raycaster for clicking 3D workload nodes
    const raycaster = new THREE.Raycaster();
    const mouseVector = new THREE.Vector2();

    const handleMouseMove = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const clientX = event.clientX - rect.left;
      const clientY = event.clientY - rect.top;

      mouseRef.current.targetX = (clientX / container.clientWidth - 0.5) * 2;
      mouseRef.current.targetY = -(clientY / container.clientHeight - 0.5) * 2;

      mouseVector.x = (clientX / container.clientWidth) * 2 - 1;
      mouseVector.y = -(clientY / container.clientHeight) * 2 + 1;
    };

    const handleClick = () => {
      raycaster.setFromCamera(mouseVector, camera);
      const meshes = workloadInteractables.map((item) => item.mesh);
      const hits = raycaster.intersectObjects(meshes, false);

      if (hits.length > 0) {
        const hitMesh = hits[0].object as THREE.Mesh;
        const matched = workloadInteractables.find((item) => item.mesh === hitMesh);
        if (matched) {
          onSelectWorkload(matched.id);
        }
      }
    };

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('click', handleClick);

    // 7. Animation Loop
    let animId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Mouse Parallax
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.05;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.05;

      rootGroup.rotation.y = mouseRef.current.x * 0.22;
      rootGroup.rotation.x = -mouseRef.current.y * 0.1;

      // Pulse and highlight selected workload node
      workloadInteractables.forEach((item) => {
        const isSelected = item.id === selectedRef.current;
        const floatY = Math.sin(elapsed * 2.0 + item.pulseOffset) * 0.08;
        item.mesh.position.y = item.basePos.y + floatY;

        const mat = item.mesh.material as THREE.MeshStandardMaterial;
        if (isSelected) {
          item.mesh.scale.set(1.5, 1.5, 1.5);
          mat.emissiveIntensity = 1.0 + Math.sin(elapsed * 6) * 0.3;
        } else {
          item.mesh.scale.set(1.0, 1.0, 1.0);
          mat.emissiveIntensity = 0.5;
        }
      });

      // Halo rotation
      halo.rotation.z = elapsed * 0.3;

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animId);
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('click', handleClick);
      resizeObserver.disconnect();
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [workloads, onSelectWorkload]);

  return (
    <div className="workload-3d-scene-container">
      <div className="workload-canvas-ref" ref={containerRef} />
      <div className="workload-3d-legend">
        <div className="legend-tag local">
          <span className="dot teal" />
          <span>Karnataka Private DC</span>
        </div>
        <div className="legend-tag cloud">
          <span className="dot blue" />
          <span>Sovereign Cloud Regions</span>
        </div>
        <div className="legend-hint">
          <span>Click any 3D node to inspect workload</span>
        </div>
      </div>
    </div>
  );
};
