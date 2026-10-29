import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface HybridServerSceneProps {
  isHovered: boolean;
  isSelected: boolean;
}

export const HybridServerScene: React.FC<HybridServerSceneProps> = ({
  isHovered,
  isSelected,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const hoverRef = useRef(isHovered);
  const selectedRef = useRef(isSelected);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  useEffect(() => {
    hoverRef.current = isHovered;
  }, [isHovered]);

  useEffect(() => {
    selectedRef.current = isSelected;
  }, [isSelected]);

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
    camera.position.set(0, 1.0, 9.2);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // 2. Lighting
    const ambientLight = new THREE.AmbientLight(0x0f172a, 2.8);
    scene.add(ambientLight);

    const tealSpot = new THREE.SpotLight(0x2dd4bf, 5, 20, Math.PI / 3.5, 0.4);
    tealSpot.position.set(-4, 6, 6);
    scene.add(tealSpot);

    const cyanSpot = new THREE.SpotLight(0x00f5ff, 5, 20, Math.PI / 3.5, 0.4);
    cyanSpot.position.set(4, 6, 6);
    scene.add(cyanSpot);

    const activeRimLight = new THREE.PointLight(0x2dd4bf, 0, 12);
    activeRimLight.position.set(0, 1.5, 2);
    scene.add(activeRimLight);

    // Master Group
    const hybridGroup = new THREE.Group();
    scene.add(hybridGroup);

    // -------------------------------------------------------------------------
    // Left Node: Local On-Premise Data Centre Server
    // -------------------------------------------------------------------------
    const localGroup = new THREE.Group();
    localGroup.position.set(-2.1, 0, 0);
    hybridGroup.add(localGroup);

    // Local Chassis
    const localGeo = new THREE.BoxGeometry(1.6, 3.2, 1.4);
    const localMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.4,
      metalness: 0.8,
    });
    const localChassis = new THREE.Mesh(localGeo, localMat);
    localGroup.add(localChassis);

    // Local Gold/Amber Trim (representing Sovereign In-State DC)
    const trimGeo = new THREE.BoxGeometry(1.64, 0.08, 1.44);
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.9,
      roughness: 0.2,
      emissive: 0x78350f,
    });
    const localTrim1 = new THREE.Mesh(trimGeo, trimMat);
    localTrim1.position.y = 1.0;
    localGroup.add(localTrim1);

    const localTrim2 = new THREE.Mesh(trimGeo, trimMat);
    localTrim2.position.y = -0.8;
    localGroup.add(localTrim2);

    // Local LED Grid
    const localLeds: THREE.Mesh[] = [];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 2; c++) {
        const ledGeo = new THREE.BoxGeometry(0.08, 0.08, 0.02);
        const ledMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
        const led = new THREE.Mesh(ledGeo, ledMat);
        led.position.set(-0.35 + c * 0.7, 0.6 - r * 0.4, 0.71);
        localGroup.add(led);
        localLeds.push(led);
      }
    }

    // Local Base Pedestal
    const localBaseGeo = new THREE.CylinderGeometry(1.4, 1.5, 0.2, 24);
    const localBaseMat = new THREE.MeshStandardMaterial({
      color: 0x0a101f,
      metalness: 0.9,
    });
    const localPedestal = new THREE.Mesh(localBaseGeo, localBaseMat);
    localPedestal.position.y = -1.7;
    localGroup.add(localPedestal);

    // -------------------------------------------------------------------------
    // Right Node: Cloud-Hosted Server Node
    // -------------------------------------------------------------------------
    const cloudGroup = new THREE.Group();
    cloudGroup.position.set(2.1, 0.2, 0);
    hybridGroup.add(cloudGroup);

    // Cloud Chassis
    const cloudGeo = new THREE.BoxGeometry(1.6, 2.8, 1.4);
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.3,
      metalness: 0.85,
    });
    const cloudChassis = new THREE.Mesh(cloudGeo, cloudMat);
    cloudGroup.add(cloudChassis);

    // Cloud Cyan Trim
    const cloudTrimMat = new THREE.MeshStandardMaterial({
      color: 0x00f5ff,
      metalness: 0.9,
      emissive: 0x0369a1,
    });
    const cloudTrim1 = new THREE.Mesh(trimGeo, cloudTrimMat);
    cloudTrim1.position.y = 0.8;
    cloudGroup.add(cloudTrim1);

    // Cloud LEDs
    const cloudLeds: THREE.Mesh[] = [];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 2; c++) {
        const ledGeo = new THREE.BoxGeometry(0.08, 0.08, 0.02);
        const ledMat = new THREE.MeshBasicMaterial({ color: 0x00f5ff });
        const led = new THREE.Mesh(ledGeo, ledMat);
        led.position.set(-0.35 + c * 0.7, 0.4 - r * 0.4, 0.71);
        cloudGroup.add(led);
        cloudLeds.push(led);
      }
    }

    // Floating Holographic Cloud Rings on Cloud Node
    const cloudHaloGeo = new THREE.TorusGeometry(1.2, 0.025, 16, 48);
    const cloudHaloMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.5,
    });
    const cloudHalo = new THREE.Mesh(cloudHaloGeo, cloudHaloMat);
    cloudHalo.rotation.x = Math.PI / 2.3;
    cloudHalo.position.y = 1.8;
    cloudGroup.add(cloudHalo);

    // Cloud Base Pedestal
    const cloudPedestal = new THREE.Mesh(localBaseGeo, localBaseMat);
    cloudPedestal.position.y = -1.5;
    cloudGroup.add(cloudPedestal);

    // -------------------------------------------------------------------------
    // Animated Optical Fiber Bridge Between Local & Cloud
    // -------------------------------------------------------------------------
    // Curve Path
    const bridgeCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-1.3, 0.4, 0.5),
      new THREE.Vector3(0, 1.8, 1.2),
      new THREE.Vector3(1.3, 0.5, 0.5)
    );

    const tubeGeo = new THREE.TubeGeometry(bridgeCurve, 32, 0.04, 8, false);
    const tubeMat = new THREE.MeshBasicMaterial({
      color: 0x14b8a6,
      transparent: true,
      opacity: 0.45,
    });
    const fiberTube = new THREE.Mesh(tubeGeo, tubeMat);
    hybridGroup.add(fiberTube);

    // Secondary parallel fiber line
    const bridgeCurve2 = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-1.3, -0.4, 0.4),
      new THREE.Vector3(0, 0.8, 1.0),
      new THREE.Vector3(1.3, -0.3, 0.4)
    );
    const tubeGeo2 = new THREE.TubeGeometry(bridgeCurve2, 32, 0.03, 8, false);
    const tubeMat2 = new THREE.MeshBasicMaterial({
      color: 0x00f5ff,
      transparent: true,
      opacity: 0.35,
    });
    const fiberTube2 = new THREE.Mesh(tubeGeo2, tubeMat2);
    hybridGroup.add(fiberTube2);

    // Moving Data Energy Packets (Particles traversing the bridge)
    const packetCount = 8;
    const packetGeos = new THREE.SphereGeometry(0.08, 12, 12);
    const packetMat = new THREE.MeshBasicMaterial({
      color: 0x00f5ff,
    });
    const packets: THREE.Mesh[] = [];

    for (let i = 0; i < packetCount; i++) {
      const p = new THREE.Mesh(packetGeos, packetMat);
      hybridGroup.add(p);
      packets.push(p);
    }

    // Active Selection Dual Ring Underneath
    const activeRingGeo = new THREE.RingGeometry(3.6, 3.85, 32);
    const activeRingMat = new THREE.MeshBasicMaterial({
      color: 0x2dd4bf,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.0,
    });
    const activeRing = new THREE.Mesh(activeRingGeo, activeRingMat);
    activeRing.rotation.x = Math.PI / 2;
    activeRing.position.y = -1.65;
    hybridGroup.add(activeRing);

    // Mouse Move Interaction Handler
    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      mouseRef.current.targetX = x * 0.7;
      mouseRef.current.targetY = y * 0.4;
    };

    const handleMouseLeave = () => {
      mouseRef.current.targetX = 0;
      mouseRef.current.targetY = 0;
    };

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);

    // 4. Animation Loop
    let animationFrameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Smooth mouse damping
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.06;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.06;

      // Floating oscillation
      const hoverElevate = hoverRef.current ? 0.35 : 0;
      const targetY = Math.sin(elapsedTime * 1.6) * 0.1 + hoverElevate;
      hybridGroup.position.y += (targetY - hybridGroup.position.y) * 0.08;

      // Rotation & perspective tracking
      hybridGroup.rotation.y = mouseRef.current.x * 0.8;
      hybridGroup.rotation.x = -mouseRef.current.y * 0.6;

      // Rotate cloud halo
      cloudHalo.rotation.z = -elapsedTime * 0.8;

      // Traverse Data Packets along the optical bridge
      const speedMultiplier = hoverRef.current ? 1.6 : 0.9;
      packets.forEach((p, idx) => {
        // Offset each packet along the 0..1 interval
        const t = ((elapsedTime * 0.35 * speedMultiplier + idx / packetCount) % 1);
        const pt = bridgeCurve.getPoint(t);
        p.position.copy(pt);
      });

      // Selection state highlights
      if (selectedRef.current) {
        activeRing.material.opacity = 0.85 + Math.sin(elapsedTime * 4) * 0.15;
        activeRimLight.intensity = 4.5;
        localMat.emissive.setHex(0x042f2e);
        cloudMat.emissive.setHex(0x042f2e);
      } else if (hoverRef.current) {
        activeRing.material.opacity = 0.35;
        activeRimLight.intensity = 2.0;
        localMat.emissive.setHex(0x021f1e);
        cloudMat.emissive.setHex(0x021f1e);
      } else {
        activeRing.material.opacity = 0.0;
        activeRimLight.intensity = 0.0;
        localMat.emissive.setHex(0x000000);
        cloudMat.emissive.setHex(0x000000);
      }

      // LED Blinking
      localLeds.forEach((led, idx) => {
        led.visible = Math.sin(elapsedTime * 4 + idx) > -0.3;
      });
      cloudLeds.forEach((led, idx) => {
        led.visible = Math.sin(elapsedTime * 5 + idx * 1.5) > -0.2;
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

    window.addEventListener('resize', handleResize);

    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      renderer.dispose();
      localGeo.dispose();
      localMat.dispose();
      cloudGeo.dispose();
      cloudMat.dispose();
      tubeGeo.dispose();
      tubeMat.dispose();
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={containerRef} className="three-scene-wrapper" />;
};
