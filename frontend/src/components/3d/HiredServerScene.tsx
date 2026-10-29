import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface HiredServerSceneProps {
  isHovered: boolean;
  isSelected: boolean;
}

export const HiredServerScene: React.FC<HiredServerSceneProps> = ({
  isHovered,
  isSelected,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const hoverRef = useRef(isHovered);
  const selectedRef = useRef(isSelected);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  // Update refs on prop changes
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
    camera.position.set(0, 1.2, 7.5);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 2. Lights
    const ambientLight = new THREE.AmbientLight(0x0f172a, 2.5);
    scene.add(ambientLight);

    const cyanSpot = new THREE.SpotLight(0x00f5ff, 5, 20, Math.PI / 4, 0.4);
    cyanSpot.position.set(4, 6, 6);
    cyanSpot.castShadow = true;
    scene.add(cyanSpot);

    const blueBacklight = new THREE.PointLight(0x38bdf8, 3, 15);
    blueBacklight.position.set(-4, -1, -3);
    scene.add(blueBacklight);

    const activeRimLight = new THREE.PointLight(0x00f5ff, 0, 10);
    activeRimLight.position.set(0, 2, 2);
    scene.add(activeRimLight);

    // 3. Server Rack Group
    const rackGroup = new THREE.Group();
    scene.add(rackGroup);

    // Chassis Outer Frame (Dark Metallic)
    const chassisGeo = new THREE.BoxGeometry(2.3, 4.0, 1.6);
    const chassisMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.35,
      metalness: 0.85,
    });
    const chassis = new THREE.Mesh(chassisGeo, chassisMat);
    chassis.castShadow = true;
    chassis.receiveShadow = true;
    rackGroup.add(chassis);

    // Glass Door / Front Bezel
    const glassGeo = new THREE.BoxGeometry(2.2, 3.85, 0.08);
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.18,
      roughness: 0.1,
      metalness: 0.1,
      transmission: 0.8,
      ior: 1.5,
    });
    const glass = new THREE.Mesh(glassGeo, glassMat);
    glass.position.z = 0.82;
    rackGroup.add(glass);

    // Server Blades (Stacked Units)
    const bladeCount = 5;
    const bladeHeight = 0.65;
    const leds: THREE.Mesh[] = [];

    for (let i = 0; i < bladeCount; i++) {
      const yPos = 1.3 - i * 0.72;

      // Blade faceplate
      const bladeGeo = new THREE.BoxGeometry(2.1, bladeHeight, 1.45);
      const bladeMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        metalness: 0.8,
        roughness: 0.4,
      });
      const blade = new THREE.Mesh(bladeGeo, bladeMat);
      blade.position.set(0, yPos, 0.05);
      rackGroup.add(blade);

      // Horizontal Drive Slots
      const slotGeo = new THREE.BoxGeometry(1.3, 0.12, 0.05);
      const slotMat = new THREE.MeshBasicMaterial({ color: 0x090d16 });
      const slot = new THREE.Mesh(slotGeo, slotMat);
      slot.position.set(-0.25, yPos, 0.8);
      rackGroup.add(slot);

      // Blinking Status LEDs Array (Cyan & Emerald)
      for (let j = 0; j < 4; j++) {
        const ledGeo = new THREE.BoxGeometry(0.06, 0.06, 0.03);
        const isEmerald = j % 2 === 0;
        const ledMat = new THREE.MeshBasicMaterial({
          color: isEmerald ? 0x10b981 : 0x00f5ff,
        });
        const led = new THREE.Mesh(ledGeo, ledMat);
        led.position.set(0.6 + j * 0.12, yPos, 0.8);
        rackGroup.add(led);
        leds.push(led);
      }
    }

    // Floating Holographic Cloud Rings (Above Rack)
    const ringGeo = new THREE.TorusGeometry(1.6, 0.03, 16, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f5ff,
      transparent: true,
      opacity: 0.45,
      wireframe: true,
    });
    const cloudRing = new THREE.Mesh(ringGeo, ringMat);
    cloudRing.rotation.x = Math.PI / 2.2;
    cloudRing.position.y = 2.4;
    rackGroup.add(cloudRing);

    const ringGeo2 = new THREE.TorusGeometry(1.2, 0.02, 16, 64);
    const ringMat2 = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.35,
    });
    const cloudRing2 = new THREE.Mesh(ringGeo2, ringMat2);
    cloudRing2.rotation.x = Math.PI / 2.4;
    cloudRing2.position.y = 2.6;
    rackGroup.add(cloudRing2);

    // Glowing Platform Pedestal (Base Ring)
    const baseGeo = new THREE.CylinderGeometry(2.0, 2.2, 0.25, 32);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.9,
      roughness: 0.3,
    });
    const pedestal = new THREE.Mesh(baseGeo, baseMat);
    pedestal.position.y = -2.15;
    rackGroup.add(pedestal);

    // Active Selection Neon Ring
    const activeRingGeo = new THREE.RingGeometry(1.9, 2.1, 32);
    const activeRingMat = new THREE.MeshBasicMaterial({
      color: 0x00f5ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.0,
    });
    const activeRing = new THREE.Mesh(activeRingGeo, activeRingMat);
    activeRing.rotation.x = Math.PI / 2;
    activeRing.position.y = -2.01;
    rackGroup.add(activeRing);

    // Mouse Move Interaction Handler
    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      mouseRef.current.targetX = x * 0.8;
      mouseRef.current.targetY = y * 0.5;
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

      // Base floating animation
      const hoverElevate = hoverRef.current ? 0.35 : 0;
      const targetY = Math.sin(elapsedTime * 1.8) * 0.12 + hoverElevate;
      rackGroup.position.y += (targetY - rackGroup.position.y) * 0.08;

      // Gentle rotation & mouse parallax
      const baseRotationY = 0.35 + Math.sin(elapsedTime * 0.6) * 0.08;
      rackGroup.rotation.y = baseRotationY + mouseRef.current.x;
      rackGroup.rotation.x = -mouseRef.current.y;

      // Rotate cloud rings
      cloudRing.rotation.z = elapsedTime * 0.5;
      cloudRing2.rotation.z = -elapsedTime * 0.7;

      // Selection state highlights
      if (selectedRef.current) {
        activeRing.material.opacity = 0.85 + Math.sin(elapsedTime * 4) * 0.15;
        activeRimLight.intensity = 4.5;
        chassisMat.emissive.setHex(0x003355);
      } else if (hoverRef.current) {
        activeRing.material.opacity = 0.35;
        activeRimLight.intensity = 2.0;
        chassisMat.emissive.setHex(0x001a2b);
      } else {
        activeRing.material.opacity = 0.0;
        activeRimLight.intensity = 0.0;
        chassisMat.emissive.setHex(0x000000);
      }

      // LED Blinking Effect
      leds.forEach((led, idx) => {
        const speed = (idx % 3) + 2;
        const blink = Math.sin(elapsedTime * speed * 2 + idx);
        led.visible = blink > -0.2;
      });

      renderer.render(scene, camera);
    };

    animate();

    // Resize Handler
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
      chassisGeo.dispose();
      chassisMat.dispose();
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={containerRef} className="three-scene-wrapper" />;
};
