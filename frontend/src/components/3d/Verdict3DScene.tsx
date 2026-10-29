import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface Verdict3DSceneProps {
  setup: 'hired' | 'hybrid';
  verdictType:
    | 'UNDER_PROVISIONED'
    | 'SUFFICIENT'
    | 'OVER_PROVISIONED'
    | 'HYBRID_SUITABLE'
    | 'INSUFFICIENT_INFO';
  totalCpu: number;
  totalRam: number;
}

/**
 * 3D Verdict Visualization for Step 5
 * Renders the evaluated infrastructure with an orbital status halo and metallic server chassis.
 * The aura color reflects the primary verdict:
 * - Sufficient: Electric Emerald / Teal (#48D9D0 / #10B981)
 * - Hybrid: Cyan / Royal Blue (#648CFF)
 * - Under-provisioned: Amber / Crimson (#F59E0B / #EF4444)
 * - Over-provisioned: Deep Violet / Blue (#8B5CF6)
 */
export const Verdict3DScene: React.FC<Verdict3DSceneProps> = ({
  setup,
  verdictType,
  totalCpu,
  totalRam,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

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
    camera.position.set(0, 1.6, 8.8);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 2. Lights
    const ambientLight = new THREE.AmbientLight(0x0b1728, 2.4);
    scene.add(ambientLight);

    // Dynamic accent color based on verdict
    let verdictHex = 0x48d9d0; // Default Teal
    if (verdictType === 'UNDER_PROVISIONED') verdictHex = 0xef4444; // Crimson
    if (verdictType === 'SUFFICIENT') verdictHex = 0x10b981; // Emerald
    if (verdictType === 'OVER_PROVISIONED') verdictHex = 0x8b5cf6; // Purple
    if (verdictType === 'HYBRID_SUITABLE') verdictHex = 0x648cff; // Cyan Blue
    if (verdictType === 'INSUFFICIENT_INFO') verdictHex = 0xf59e0b; // Amber

    const spotLight = new THREE.SpotLight(verdictHex, 4.0, 20, Math.PI / 4, 0.3);
    spotLight.position.set(0, 7, 5);
    spotLight.castShadow = true;
    scene.add(spotLight);

    const fillLight = new THREE.PointLight(0x648cff, 2.0, 15);
    fillLight.position.set(-4, -2, 3);
    scene.add(fillLight);

    // 3. 3D Infrastructure Geometry
    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    // Ground platform with subtle reflection grid
    const floorGeo = new THREE.CylinderGeometry(4.2, 4.5, 0.25, 32);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x07111f,
      roughness: 0.3,
      metalness: 0.8,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.position.y = -1.8;
    floorMesh.receiveShadow = true;
    rootGroup.add(floorMesh);

    // Glowing rim around platform
    const rimGeo = new THREE.RingGeometry(4.2, 4.35, 32);
    const rimMat = new THREE.MeshBasicMaterial({
      color: verdictHex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7,
    });
    const rimMesh = new THREE.Mesh(rimGeo, rimMat);
    rimMesh.rotation.x = -Math.PI / 2;
    rimMesh.position.y = -1.67;
    rootGroup.add(rimMesh);

    // Server Chassis Construction
    const isHybrid = setup === 'hybrid';
    const serverCount = isHybrid ? 2 : 1;
    const racks: THREE.Group[] = [];

    const rackMat = new THREE.MeshStandardMaterial({
      color: 0x0f1c30,
      metalness: 0.85,
      roughness: 0.25,
    });

    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0x182a47,
      metalness: 0.6,
      roughness: 0.4,
    });

    const createChassis = (xPos: number, labelColor: number) => {
      const chassisGroup = new THREE.Group();
      chassisGroup.position.set(xPos, -0.4, 0);

      // Main frame
      const frameGeo = new THREE.BoxGeometry(1.6, 2.5, 1.2);
      const frame = new THREE.Mesh(frameGeo, rackMat);
      frame.castShadow = true;
      frame.receiveShadow = true;
      chassisGroup.add(frame);

      // Stacked server blades with blinking LEDs
      for (let i = 0; i < 6; i++) {
        const yOffset = -0.9 + i * 0.36;
        const bladeGeo = new THREE.BoxGeometry(1.45, 0.25, 1.22);
        const blade = new THREE.Mesh(bladeGeo, bladeMat);
        blade.position.y = yOffset;
        chassisGroup.add(blade);

        // LED Indicator
        const ledGeo = new THREE.BoxGeometry(0.08, 0.08, 0.02);
        const ledMat = new THREE.MeshBasicMaterial({ color: labelColor });
        const led = new THREE.Mesh(ledGeo, ledMat);
        led.position.set(0.6, yOffset, 0.62);
        chassisGroup.add(led);
      }

      rootGroup.add(chassisGroup);
      racks.push(chassisGroup);
    };

    if (isHybrid) {
      createChassis(-1.8, 0x48d9d0); // Local DC rack (teal)
      createChassis(1.8, 0x648cff); // Cloud cluster rack (cyan blue)

      // Optical Bridge between racks
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(-1.8, 0.4, 0),
        new THREE.Vector3(0, 1.4, 0.6),
        new THREE.Vector3(1.8, 0.4, 0)
      );
      const tubeGeo = new THREE.TubeGeometry(curve, 32, 0.04, 8, false);
      const tubeMat = new THREE.MeshBasicMaterial({
        color: 0x48d9d0,
        transparent: true,
        opacity: 0.7,
      });
      const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
      rootGroup.add(tubeMesh);
    } else {
      createChassis(0, verdictHex);
    }

    // Floating Orbital Halo around the setup
    const haloGeo = new THREE.TorusGeometry(2.8, 0.03, 16, 64);
    const haloMat = new THREE.MeshBasicMaterial({
      color: verdictHex,
      transparent: true,
      opacity: 0.65,
    });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.position.y = 0.4;
    halo.rotation.x = Math.PI / 3;
    rootGroup.add(halo);

    // Secondary orbital ring
    const halo2Geo = new THREE.TorusGeometry(3.3, 0.02, 16, 64);
    const halo2Mat = new THREE.MeshBasicMaterial({
      color: 0x648cff,
      transparent: true,
      opacity: 0.45,
    });
    const halo2 = new THREE.Mesh(halo2Geo, halo2Mat);
    halo2.position.y = 0.4;
    halo2.rotation.x = -Math.PI / 4;
    rootGroup.add(halo2);

    // Floating Data Particle Cloud
    const particleCount = 40;
    const particleGeo = new THREE.BufferGeometry();
    const particlePos = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      particlePos[i] = (Math.random() - 0.5) * 6;
      particlePos[i + 1] = Math.random() * 3 - 0.5;
      particlePos[i + 2] = (Math.random() - 0.5) * 4;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3));
    const particleMat = new THREE.PointsMaterial({
      size: 0.06,
      color: verdictHex,
      transparent: true,
      opacity: 0.8,
    });
    const particleSystem = new THREE.Points(particleGeo, particleMat);
    rootGroup.add(particleSystem);

    // Mouse Interaction
    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      mouseRef.current.targetX = x * 0.4;
      mouseRef.current.targetY = y * 0.25;
    };
    container.addEventListener('mousemove', handleMouseMove);

    // Resize Handler
    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // Animation Loop
    let animId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Smooth camera parallax
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.05;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.05;
      camera.position.x = mouseRef.current.x * 2.5;
      camera.position.y = 1.6 + mouseRef.current.y * 1.5;
      camera.lookAt(0, 0.4, 0);

      // Subtle rotation of halos
      halo.rotation.z = elapsedTime * 0.15;
      halo2.rotation.z = -elapsedTime * 0.12;

      // Gentle floating animation of server racks
      racks.forEach((rack, idx) => {
        rack.position.y = -0.4 + Math.sin(elapsedTime * 1.5 + idx * 1.2) * 0.06;
      });

      // Slowly rotate particle field
      particleSystem.rotation.y = elapsedTime * 0.05;

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('mousemove', handleMouseMove);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [setup, verdictType, totalCpu, totalRam]);

  return <div ref={containerRef} className="verdict-3d-canvas-container" />;
};
