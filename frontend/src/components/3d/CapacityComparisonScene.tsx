import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { CapacityAnalysisResult } from '../../types';

interface CapacityComparisonSceneProps {
  result: CapacityAnalysisResult;
  onSelectComponent?: (info: { title: string; subtitle: string; specs: string[] }) => void;
}

export const CapacityComparisonScene: React.FC<CapacityComparisonSceneProps> = ({
  result,
  onSelectComponent,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);

  const isHybrid = result.setup === 'hybrid';
  const classification = result.classification;

  // Track mouse coordinates for gentle parallax
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      50
    );
    camera.position.set(0, 1.5, 8.5);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 2. Lights
    const ambientLight = new THREE.AmbientLight(0x0f172a, 2.5);
    scene.add(ambientLight);

    // Color tones based on classification
    const mainAccentColor =
      classification === 'UNDER_PROVISIONED'
        ? 0xf59e0b // Amber warning
        : classification === 'POTENTIALLY_OVER_PROVISIONED'
        ? 0x38bdf8 // Cyan/sky blue
        : 0x00f5ff; // Vibrant electric cyan

    const spotLight = new THREE.SpotLight(mainAccentColor, 5, 25, Math.PI / 4, 0.4);
    spotLight.position.set(4, 7, 7);
    spotLight.castShadow = true;
    scene.add(spotLight);

    const backLight = new THREE.PointLight(0x2dd4bf, 3, 15);
    backLight.position.set(-5, -2, -3);
    scene.add(backLight);

    // 3. Interactive Object Registry for Raycasting
    const interactables: {
      mesh: THREE.Object3D;
      id: string;
      title: string;
      subtitle: string;
      specs: string[];
    }[] = [];

    // Root Group
    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    // Ground reflective grid disc
    const discGeo = new THREE.CylinderGeometry(4.2, 4.2, 0.08, 48);
    const discMat = new THREE.MeshStandardMaterial({
      color: 0x071120,
      metalness: 0.9,
      roughness: 0.25,
    });
    const groundDisc = new THREE.Mesh(discGeo, discMat);
    groundDisc.position.y = -2.1;
    groundDisc.receiveShadow = true;
    rootGroup.add(groundDisc);

    // Outer cyber ring
    const ringGeo = new THREE.RingGeometry(4.25, 4.35, 48);
    const ringMat = new THREE.MeshBasicMaterial({
      color: mainAccentColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.5,
    });
    const cyberRing = new THREE.Mesh(ringGeo, ringMat);
    cyberRing.rotation.x = Math.PI / 2;
    cyberRing.position.y = -2.05;
    rootGroup.add(cyberRing);

    // Dynamic LED storage for animation
    const dynamicLeds: THREE.Mesh[] = [];

    // HELPER: Build Server Rack
    const createServerRack = (
      xPos: number,
      rackColor: number,
      accentColor: number,
      id: string,
      title: string,
      subtitle: string,
      specs: string[]
    ) => {
      const rack = new THREE.Group();
      rack.position.set(xPos, -0.2, 0);

      // Chassis
      const chassisGeo = new THREE.BoxGeometry(1.6, 3.4, 1.2);
      const chassisMat = new THREE.MeshStandardMaterial({
        color: rackColor,
        metalness: 0.85,
        roughness: 0.35,
      });
      const chassis = new THREE.Mesh(chassisGeo, chassisMat);
      chassis.castShadow = true;
      chassis.receiveShadow = true;
      rack.add(chassis);

      // Glass front
      const glassGeo = new THREE.BoxGeometry(1.5, 3.25, 0.05);
      const glassMat = new THREE.MeshPhysicalMaterial({
        color: accentColor,
        transparent: true,
        opacity: 0.25,
        transmission: 0.7,
        roughness: 0.1,
      });
      const glass = new THREE.Mesh(glassGeo, glassMat);
      glass.position.z = 0.62;
      rack.add(glass);

      // Server blades and LEDs
      const bladeRows = 5;
      for (let i = 0; i < bladeRows; i++) {
        const y = 1.2 - i * 0.6;

        // Blade faceplate
        const bladeGeo = new THREE.BoxGeometry(1.4, 0.45, 0.05);
        const bladeMat = new THREE.MeshStandardMaterial({
          color: 0x1e293b,
          metalness: 0.9,
          roughness: 0.4,
        });
        const blade = new THREE.Mesh(bladeGeo, bladeMat);
        blade.position.set(0, y, 0.58);
        rack.add(blade);

        // Blinking LEDs
        for (let j = 0; j < 3; j++) {
          const ledGeo = new THREE.BoxGeometry(0.08, 0.08, 0.02);
          const ledMat = new THREE.MeshBasicMaterial({
            color: accentColor,
          });
          const led = new THREE.Mesh(ledGeo, ledMat);
          led.position.set(-0.5 + j * 0.2, y, 0.61);
          rack.add(led);
          dynamicLeds.push(led);
        }
      }

      rootGroup.add(rack);

      interactables.push({
        mesh: rack,
        id,
        title,
        subtitle,
        specs,
      });

      return rack;
    };

    // Build Infrastructure Racks based on setup
    if (isHybrid) {
      // Local Server Rack (Left)
      createServerRack(
        -1.8,
        0x0d3b37, // Teal dark
        0x2dd4bf, // Teal glow
        'local-rack',
        'Local Server (On-Premises Private DC)',
        'Self-hosted compute capacity in Karnataka DC',
        [
          `CPU: ${result.localAvailableCpu} Cores`,
          `RAM: ${result.localAvailableRamGb} GB`,
          `Residency: Strict Local DC`,
        ]
      );

      // Rented Cloud Server Rack (Right)
      createServerRack(
        1.8,
        0x0c2540, // Navy dark
        0x00f5ff, // Cyan glow
        'rented-rack',
        'Hired Server Fleet (Cloud Infrastructure)',
        'Rented sovereign cloud compute instances',
        [
          `CPU: ${result.rentedAvailableCpu} Cores`,
          `RAM: ${result.rentedAvailableRamGb} GB`,
          `Monthly Lease: ${result.monthlyEstimatedCost ? `₹ ${result.monthlyEstimatedCost.toLocaleString('en-IN')}` : 'Unknown'}`,
        ]
      );

      // Optical Bridge connecting local and rented
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(-1.8, 1.2, 0),
        new THREE.Vector3(0, 2.4, 0.5),
        new THREE.Vector3(1.8, 1.2, 0)
      );
      const tubeGeo = new THREE.TubeGeometry(curve, 32, 0.04, 8, false);
      const tubeMat = new THREE.MeshBasicMaterial({
        color: 0x2dd4bf,
        transparent: true,
        opacity: 0.7,
      });
      const tube = new THREE.Mesh(tubeGeo, tubeMat);
      rootGroup.add(tube);
    } else {
      // Single / Double Rented Server Rack (Center)
      createServerRack(
        0,
        0x0f172a, // Metallic slate
        mainAccentColor,
        'hired-fleet',
        'Hired Server Fleet (Rented Cloud Compute)',
        'Evaluated cloud server capacity against workload demand',
        [
          `Total CPU: ${result.totalAvailableCpu} Cores`,
          `Total RAM: ${result.totalAvailableRamGb} GB`,
          `Status: ${result.classificationLabel}`,
        ]
      );
    }

    // 4. WORKLOAD DEMAND POD (Holographic representation)
    const demandCpu = result.demandCpu;
    const demandRam = result.demandRamGb;

    const workloadGroup = new THREE.Group();
    // Position workload pod: center high or slightly forward
    workloadGroup.position.set(0, isHybrid ? 1.8 : 2.2, 1.4);

    // Compute scale relative to total capacity
    const ratio =
      demandCpu && result.totalAvailableCpu > 0
        ? demandCpu / result.totalAvailableCpu
        : 0.8;

    const podSize = Math.max(0.7, Math.min(1.8, 0.8 * ratio));

    // Outer translucent cube
    const podGeo = new THREE.BoxGeometry(podSize * 1.4, podSize * 1.0, podSize * 1.2);
    const podMat = new THREE.MeshPhysicalMaterial({
      color: mainAccentColor,
      transparent: true,
      opacity: 0.35,
      roughness: 0.2,
      metalness: 0.3,
      transmission: 0.6,
    });
    const podMesh = new THREE.Mesh(podGeo, podMat);
    podMesh.castShadow = true;
    workloadGroup.add(podMesh);

    // Inner wireframe cluster
    const wireGeo = new THREE.BoxGeometry(podSize * 1.45, podSize * 1.05, podSize * 1.25);
    const wireMat = new THREE.MeshBasicMaterial({
      color: mainAccentColor,
      wireframe: true,
      transparent: true,
      opacity: 0.75,
    });
    const wireMesh = new THREE.Mesh(wireGeo, wireMat);
    workloadGroup.add(wireMesh);

    // Small data particles orbiting the workload pod
    const particleCount = 20;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      particlePositions[i * 3] = (Math.random() - 0.5) * 2;
      particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 1.5;
      particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 2;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: mainAccentColor,
      size: 0.07,
      transparent: true,
      opacity: 0.8,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    workloadGroup.add(particles);

    rootGroup.add(workloadGroup);

    interactables.push({
      mesh: workloadGroup,
      id: 'workload-pod',
      title: 'Workload Requirements (Target Demand)',
      subtitle: 'Estimated compute and memory demands submitted for evaluation',
      specs: [
        `Demand CPU: ${demandCpu !== null ? `${demandCpu} Cores` : 'Not specified'}`,
        `Demand RAM: ${demandRam !== null ? `${demandRam} GB` : 'Not specified'}`,
        `Balance: ${result.cpuDelta !== null ? `${result.cpuDelta >= 0 ? `+${result.cpuDelta} cores headroom` : `${result.cpuDelta} cores deficit`}` : 'Utilization based'}`,
      ],
    });

    // 5. Mouse Parallax and Raycasting Interactivity
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

      // Check intersections with all registered meshes
      for (const item of interactables) {
        const hits = raycaster.intersectObjects(item.mesh.children, true);
        if (hits.length > 0) {
          setSelectedLabel(item.title);
          if (onSelectComponent) {
            onSelectComponent({
              title: item.title,
              subtitle: item.subtitle,
              specs: item.specs,
            });
          }
          break;
        }
      }
    };

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('click', handleClick);

    // 6. Animation Loop
    let animId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Smooth camera interpolation
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.05;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.05;

      rootGroup.rotation.y = mouseRef.current.x * 0.25;
      rootGroup.rotation.x = -mouseRef.current.y * 0.12;

      // Gentle floating animation for workload pod
      workloadGroup.position.y = (isHybrid ? 1.8 : 2.2) + Math.sin(elapsedTime * 2.2) * 0.12;
      wireMesh.rotation.y = elapsedTime * 0.4;
      wireMesh.rotation.x = elapsedTime * 0.2;

      // Blinking LEDs
      dynamicLeds.forEach((led, idx) => {
        const mat = led.material as THREE.MeshBasicMaterial;
        const blink = Math.sin(elapsedTime * 6 + idx);
        mat.opacity = blink > 0.2 ? 1 : 0.25;
      });

      // Ground cyber ring pulse
      ringMat.opacity = 0.4 + Math.sin(elapsedTime * 3) * 0.25;

      renderer.render(scene, camera);
    };

    animate();

    // 7. Resize Observer
    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // Clean up
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
  }, [result, isHybrid, classification, onSelectComponent]);

  return (
    <div className="capacity-3d-scene-wrapper">
      <div className="capacity-canvas-container" ref={containerRef} />
      <div className="scene-hint-badge">
        <span>⟲ Click any 3D server rack or workload block to inspect specifications</span>
      </div>
      {selectedLabel && (
        <div className="selected-object-toast">
          <span>Active Focus: <strong>{selectedLabel}</strong></span>
        </div>
      )}
    </div>
  );
};
