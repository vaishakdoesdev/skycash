import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface Screen2BackdropSceneProps {
  setup: 'hired' | 'hybrid';
}

/**
 * Screen 2 3D Infrastructure Backdrop
 * Provides an immersive, restrained 3D server environment behind the configuration form.
 * Designed with deep midnight navy (#07111F), electric teal (#48D9D0), and blue (#648CFF).
 */
export const Screen2BackdropScene: React.FC<Screen2BackdropSceneProps> = ({ setup }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  const isHybrid = setup === 'hybrid';

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
      60
    );
    camera.position.set(0, 1.8, 12);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 2. Lights
    const ambientLight = new THREE.AmbientLight(0x07111f, 2.0);
    scene.add(ambientLight);

    const tealSpot = new THREE.SpotLight(0x48d9d0, 3.5, 30, Math.PI / 4, 0.5);
    tealSpot.position.set(-8, 10, 8);
    tealSpot.castShadow = true;
    scene.add(tealSpot);

    const blueSpot = new THREE.SpotLight(0x648cff, 3.5, 30, Math.PI / 4, 0.5);
    blueSpot.position.set(8, 10, 8);
    blueSpot.castShadow = true;
    scene.add(blueSpot);

    const rimLight = new THREE.PointLight(0x48d9d0, 1.5, 20);
    rimLight.position.set(0, -3, -5);
    scene.add(rimLight);

    // 3. 3D Elements Group
    const backdropGroup = new THREE.Group();
    scene.add(backdropGroup);

    // Subtle Ground Perspective Grid
    const gridHelper = new THREE.GridHelper(40, 40, 0x1e314b, 0x0f1f33);
    gridHelper.position.y = -3.5;
    backdropGroup.add(gridHelper);

    const dynamicLeds: { mesh: THREE.Mesh; rate: number; offset: number }[] = [];
    const movingPackets: { mesh: THREE.Mesh; progress: number; speed: number; curve: THREE.QuadraticBezierCurve3 }[] = [];

    // Helper: Build Server Chassis
    const createChassis = (x: number, y: number, z: number, accentColor: number, scale = 1.0) => {
      const rack = new THREE.Group();
      rack.position.set(x, y, z);
      rack.scale.set(scale, scale, scale);

      // Main Outer Frame
      const frameGeo = new THREE.BoxGeometry(1.8, 3.8, 1.4);
      const frameMat = new THREE.MeshStandardMaterial({
        color: 0x0b1728,
        roughness: 0.4,
        metalness: 0.85,
      });
      const frame = new THREE.Mesh(frameGeo, frameMat);
      frame.castShadow = true;
      frame.receiveShadow = true;
      rack.add(frame);

      // Glass Front Bezel
      const glassGeo = new THREE.BoxGeometry(1.65, 3.65, 0.05);
      const glassMat = new THREE.MeshPhysicalMaterial({
        color: accentColor,
        transparent: true,
        opacity: 0.18,
        transmission: 0.7,
        roughness: 0.1,
      });
      const glass = new THREE.Mesh(glassGeo, glassMat);
      glass.position.z = 0.72;
      rack.add(glass);

      // Blades
      const bladeRows = 5;
      for (let i = 0; i < bladeRows; i++) {
        const rowY = 1.3 - i * 0.65;
        const bladeGeo = new THREE.BoxGeometry(1.5, 0.5, 0.04);
        const bladeMat = new THREE.MeshStandardMaterial({
          color: 0x101f33,
          roughness: 0.5,
          metalness: 0.8,
        });
        const blade = new THREE.Mesh(bladeGeo, bladeMat);
        blade.position.set(0, rowY, 0.68);
        rack.add(blade);

        // Blinking LEDs
        for (let j = 0; j < 3; j++) {
          const ledGeo = new THREE.BoxGeometry(0.08, 0.08, 0.02);
          const ledMat = new THREE.MeshBasicMaterial({ color: accentColor });
          const led = new THREE.Mesh(ledGeo, ledMat);
          led.position.set(-0.5 + j * 0.22, rowY, 0.71);
          rack.add(led);
          dynamicLeds.push({ mesh: led, rate: 3 + Math.random() * 4, offset: Math.random() * 10 });
        }
      }

      backdropGroup.add(rack);
      return rack;
    };

    // Construct Scene based on Setup
    let floatingElements: THREE.Object3D[] = [];

    if (!isHybrid) {
      // HIRED SERVER: Floating cluster of cloud server racks & cloud halo
      const leftRack = createChassis(-5.5, 0.5, -2, 0x48d9d0, 0.95);
      const rightRack = createChassis(5.5, 0.8, -2.5, 0x648cff, 0.95);
      const centerBackRack = createChassis(0, 3.2, -6, 0x48d9d0, 0.8);

      leftRack.rotation.y = 0.35;
      rightRack.rotation.y = -0.35;

      // Cloud Halo Ring
      const torusGeo = new THREE.TorusGeometry(3.5, 0.05, 16, 100);
      const torusMat = new THREE.MeshBasicMaterial({
        color: 0x48d9d0,
        transparent: true,
        opacity: 0.35,
      });
      const cloudHalo = new THREE.Mesh(torusGeo, torusMat);
      cloudHalo.rotation.x = Math.PI / 2.2;
      cloudHalo.position.set(0, 2.5, -5.5);
      backdropGroup.add(cloudHalo);

      floatingElements = [leftRack, rightRack, centerBackRack, cloudHalo];
    } else {
      // LOCAL + HIRED SERVER: Local server connected to cloud servers via optical bridge
      // Local Server (Left Side)
      const localRack = createChassis(-5.2, 0.2, -1.5, 0x48d9d0, 1.0);
      localRack.rotation.y = 0.4;

      // Beacon on local server
      const beaconGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.8, 16);
      const beaconMat = new THREE.MeshBasicMaterial({ color: 0x48d9d0 });
      const beacon = new THREE.Mesh(beaconGeo, beaconMat);
      beacon.position.set(0, 2.3, 0);
      localRack.add(beacon);

      // Cloud Server Racks (Right Side)
      const cloudRack1 = createChassis(4.8, 0.5, -2, 0x648cff, 0.95);
      const cloudRack2 = createChassis(6.5, -0.2, -3.5, 0x648cff, 0.85);
      cloudRack1.rotation.y = -0.38;
      cloudRack2.rotation.y = -0.45;

      // Optical Network Link Arc connecting Local to Cloud
      const bridgeCurve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(-4.8, 1.5, -1.5),
        new THREE.Vector3(0, 3.8, -4.5),
        new THREE.Vector3(4.8, 1.5, -2)
      );

      const tubeGeo = new THREE.TubeGeometry(bridgeCurve, 40, 0.035, 8, false);
      const tubeMat = new THREE.MeshBasicMaterial({
        color: 0x48d9d0,
        transparent: true,
        opacity: 0.45,
      });
      const opticalTube = new THREE.Mesh(tubeGeo, tubeMat);
      backdropGroup.add(opticalTube);

      // Animated glowing data packets
      for (let p = 0; p < 4; p++) {
        const packetGeo = new THREE.SphereGeometry(0.1, 12, 12);
        const packetMat = new THREE.MeshBasicMaterial({ color: 0x648cff });
        const packet = new THREE.Mesh(packetGeo, packetMat);
        backdropGroup.add(packet);
        movingPackets.push({
          mesh: packet,
          progress: p * 0.25,
          speed: 0.0035 + Math.random() * 0.002,
          curve: bridgeCurve,
        });
      }

      floatingElements = [localRack, cloudRack1, cloudRack2];
    }

    // 4. Mouse Tracking for Parallax
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.targetX = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseRef.current.targetY = -(e.clientY / window.innerHeight - 0.5) * 2;
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    // 5. Animation Loop
    let animId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Smooth Parallax Interpolation
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.04;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.04;

      backdropGroup.rotation.y = mouseRef.current.x * 0.06;
      backdropGroup.rotation.x = -mouseRef.current.y * 0.03;

      // Gentle floating animation
      floatingElements.forEach((el, index) => {
        el.position.y += Math.sin(elapsed * 0.9 + index * 1.5) * 0.0012;
      });

      // LED Blinking
      dynamicLeds.forEach((item) => {
        const mat = item.mesh.material as THREE.MeshBasicMaterial;
        const val = Math.sin(elapsed * item.rate + item.offset);
        mat.opacity = val > 0.1 ? 0.95 : 0.2;
      });

      // Data Packets moving on Bridge
      movingPackets.forEach((item) => {
        item.progress = (item.progress + item.speed) % 1.0;
        const pos = item.curve.getPointAt(item.progress);
        item.mesh.position.copy(pos);
      });

      renderer.render(scene, camera);
    };

    animate();

    // 6. Resize Handler
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
      window.removeEventListener('mousemove', handleMouseMove);
      resizeObserver.disconnect();
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [setup, isHybrid]);

  return (
    <div className="screen2-backdrop-wrapper" aria-hidden="true">
      <div className="screen2-3d-canvas" ref={containerRef} />
      <div className="screen2-vignette-overlay" />
    </div>
  );
};
