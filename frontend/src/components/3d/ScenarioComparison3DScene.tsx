import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface ScenarioComparison3DSceneProps {
  baselineCpu: number;
  baselineRam: number;
  baselineCost: number | null;
  scenarioCpu: number;
  scenarioRam: number;
  scenarioCost: number | null;
  demandCpu: number | null;
  demandRam: number | null;
}

/**
 * 3D Scenario Comparison Scene for Screen 4
 * Compares the Baseline Server Configuration vs What-If Scenario in real-time.
 * Server chassis heights dynamically scale based on total available compute cores.
 */
export const ScenarioComparison3DScene: React.FC<ScenarioComparison3DSceneProps> = ({
  baselineCpu,
  baselineCost,
  scenarioCpu,
  scenarioCost,
  demandCpu,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  const baselineRef = useRef({ cpu: baselineCpu, cost: baselineCost });
  const scenarioRef = useRef({ cpu: scenarioCpu, cost: scenarioCost });

  useEffect(() => {
    baselineRef.current = { cpu: baselineCpu, cost: baselineCost };
    scenarioRef.current = { cpu: scenarioCpu, cost: scenarioCost };
  }, [baselineCpu, baselineCost, scenarioCpu, scenarioCost]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x07111f, 0.08);

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      50
    );
    camera.position.set(0, 1.8, 9.0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 2. Lights
    const ambientLight = new THREE.AmbientLight(0x0b1728, 2.4);
    scene.add(ambientLight);

    const leftSpot = new THREE.SpotLight(0x48d9d0, 4.0, 25, Math.PI / 4, 0.4);
    leftSpot.position.set(-5, 8, 6);
    leftSpot.castShadow = true;
    scene.add(leftSpot);

    const rightSpot = new THREE.SpotLight(0x648cff, 4.0, 25, Math.PI / 4, 0.4);
    rightSpot.position.set(5, 8, 6);
    rightSpot.castShadow = true;
    scene.add(rightSpot);

    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    // Reflective Base Disc
    const groundGeo = new THREE.CylinderGeometry(5.0, 5.0, 0.08, 48);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x081322,
      roughness: 0.25,
      metalness: 0.9,
    });
    const groundDisc = new THREE.Mesh(groundGeo, groundMat);
    groundDisc.position.y = -2.1;
    groundDisc.receiveShadow = true;
    rootGroup.add(groundDisc);

    // Helper: Build scalable comparison server rack
    const createComparisonRack = (xPos: number, accentColor: number, name: string) => {
      const group = new THREE.Group();
      group.position.set(xPos, -0.2, 0);

      // Chassis
      const chassisGeo = new THREE.BoxGeometry(1.8, 3.4, 1.3);
      const chassisMat = new THREE.MeshStandardMaterial({
        color: 0x0b1728,
        roughness: 0.4,
        metalness: 0.85,
      });
      const chassis = new THREE.Mesh(chassisGeo, chassisMat);
      chassis.castShadow = true;
      chassis.receiveShadow = true;
      group.add(chassis);

      // Acrylic Door
      const glassGeo = new THREE.BoxGeometry(1.7, 3.25, 0.05);
      const glassMat = new THREE.MeshPhysicalMaterial({
        color: accentColor,
        transparent: true,
        opacity: 0.22,
        roughness: 0.1,
        transmission: 0.7,
      });
      const glass = new THREE.Mesh(glassGeo, glassMat);
      glass.position.z = 0.68;
      group.add(glass);

      // Server blades
      const bladeCount = 5;
      const leds: THREE.Mesh[] = [];
      for (let i = 0; i < bladeCount; i++) {
        const y = 1.2 - i * 0.6;
        const bladeGeo = new THREE.BoxGeometry(1.5, 0.45, 0.04);
        const bladeMat = new THREE.MeshStandardMaterial({ color: 0x101f33, metalness: 0.8, roughness: 0.4 });
        const blade = new THREE.Mesh(bladeGeo, bladeMat);
        blade.position.set(0, y, 0.64);
        group.add(blade);

        // LED
        for (let j = 0; j < 3; j++) {
          const ledGeo = new THREE.BoxGeometry(0.08, 0.08, 0.02);
          const ledMat = new THREE.MeshBasicMaterial({ color: accentColor });
          const led = new THREE.Mesh(ledGeo, ledMat);
          led.position.set(-0.5 + j * 0.22, y, 0.67);
          group.add(led);
          leds.push(led);
        }
      }

      rootGroup.add(group);
      return { group, leds, name };
    };

    const baselineRack = createComparisonRack(-2.3, 0x48d9d0, 'Baseline Configuration');
    const scenarioRack = createComparisonRack(2.3, 0x648cff, 'What-If Scenario');

    // Holographic Demand Target Pod floating in center
    const demandGroup = new THREE.Group();
    demandGroup.position.set(0, 1.8, 0.8);

    const podGeo = new THREE.BoxGeometry(1.2, 0.9, 1.1);
    const podMat = new THREE.MeshPhysicalMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.35,
      roughness: 0.2,
      metalness: 0.3,
    });
    const podMesh = new THREE.Mesh(podGeo, podMat);
    demandGroup.add(podMesh);

    const wireGeo = new THREE.BoxGeometry(1.25, 0.95, 1.15);
    const wireMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, wireframe: true, transparent: true, opacity: 0.8 });
    const wireMesh = new THREE.Mesh(wireGeo, wireMat);
    demandGroup.add(wireMesh);

    rootGroup.add(demandGroup);

    // 3. Mouse Parallax
    const handleMouseMove = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const clientX = event.clientX - rect.left;
      const clientY = event.clientY - rect.top;

      mouseRef.current.targetX = (clientX / container.clientWidth - 0.5) * 2;
      mouseRef.current.targetY = -(clientY / container.clientHeight - 0.5) * 2;
    };

    container.addEventListener('mousemove', handleMouseMove);

    // 4. Animation Loop
    let animId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Mouse Parallax
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.05;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.05;

      rootGroup.rotation.y = mouseRef.current.x * 0.2;
      rootGroup.rotation.x = -mouseRef.current.y * 0.1;

      // Dynamically adjust scale of racks based on CPU capacity ratio
      const bCpu = Math.max(16, baselineRef.current.cpu);
      const sCpu = Math.max(16, scenarioRef.current.cpu);
      const maxCpu = Math.max(bCpu, sCpu, 32);

      const bScaleY = 0.7 + (bCpu / maxCpu) * 0.45;
      const sScaleY = 0.7 + (sCpu / maxCpu) * 0.45;

      baselineRack.group.scale.y += (bScaleY - baselineRack.group.scale.y) * 0.1;
      scenarioRack.group.scale.y += (sScaleY - scenarioRack.group.scale.y) * 0.1;

      // Demand Pod Floating
      demandGroup.position.y = 1.8 + Math.sin(elapsed * 2.2) * 0.1;
      wireMesh.rotation.y = elapsed * 0.4;

      // LEDs Blinking
      baselineRack.leds.forEach((led, i) => {
        const mat = led.material as THREE.MeshBasicMaterial;
        mat.opacity = Math.sin(elapsed * 4 + i) > 0.2 ? 1 : 0.25;
      });

      scenarioRack.leds.forEach((led, i) => {
        const mat = led.material as THREE.MeshBasicMaterial;
        mat.opacity = Math.sin(elapsed * 5 + i * 1.3) > 0.1 ? 1 : 0.25;
      });

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
      resizeObserver.disconnect();
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [baselineCpu, baselineCost, scenarioCpu, scenarioCost, demandCpu]);

  return (
    <div className="scenario-3d-scene-container">
      <div className="scenario-canvas-ref" ref={containerRef} />
      <div className="scenario-3d-labels-overlay">
        <div className="scenario-tag baseline">
          <span className="dot teal" />
          <span>Baseline Active Setup ({baselineCpu} Cores)</span>
        </div>
        <div className="scenario-tag demand">
          <span className="dot amber" />
          <span>Demand ({demandCpu ? `${demandCpu} Cores` : 'Baseline Target'})</span>
        </div>
        <div className="scenario-tag alternative">
          <span className="dot blue" />
          <span>What-If Scenario ({scenarioCpu} Cores)</span>
        </div>
      </div>
    </div>
  );
};
