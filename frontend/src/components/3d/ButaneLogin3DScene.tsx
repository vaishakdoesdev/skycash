import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export const ButaneLogin3DScene: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07111f);
    scene.fog = new THREE.FogExp2(0x07111f, 0.04);

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    camera.position.set(0, 1.8, 11);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x0a1c33, 2.5);
    scene.add(ambientLight);

    const cyanPoint = new THREE.PointLight(0x48d9d0, 4, 25);
    cyanPoint.position.set(-5, 4, 3);
    scene.add(cyanPoint);

    const bluePoint = new THREE.PointLight(0x648cff, 5, 30);
    bluePoint.position.set(5, -2, 4);
    scene.add(bluePoint);

    const topSpot = new THREE.SpotLight(0xa5f3fc, 3);
    topSpot.position.set(0, 10, 5);
    topSpot.angle = Math.PI / 4;
    topSpot.penumbra = 0.8;
    scene.add(topSpot);

    // Root cluster group
    const cluster = new THREE.Group();
    scene.add(cluster);

    // Helper: Create a metallic server rack chassis with glowing blade units
    const createServerRack = (x: number, y: number, z: number, accentColor: number, rotY: number) => {
      const rackGroup = new THREE.Group();
      rackGroup.position.set(x, y, z);
      rackGroup.rotation.y = rotY;

      // Outer metal frame
      const frameGeo = new THREE.BoxGeometry(1.6, 3.4, 1.4);
      const frameMat = new THREE.MeshStandardMaterial({
        color: 0x0c1e34,
        metalness: 0.85,
        roughness: 0.25,
      });
      const frame = new THREE.Mesh(frameGeo, frameMat);
      rackGroup.add(frame);

      // Frame edge glow
      const edges = new THREE.EdgesGeometry(frameGeo);
      const edgeMat = new THREE.LineBasicMaterial({ color: accentColor, transparent: true, opacity: 0.35 });
      const edgeLine = new THREE.LineSegments(edges, edgeMat);
      rackGroup.add(edgeLine);

      // Server blades inside
      const bladeCount = 7;
      const bladeGeo = new THREE.BoxGeometry(1.36, 0.32, 1.25);
      const bladeMat = new THREE.MeshStandardMaterial({
        color: 0x050c18,
        metalness: 0.9,
        roughness: 0.3,
      });

      for (let i = 0; i < bladeCount; i++) {
        const blade = new THREE.Mesh(bladeGeo, bladeMat);
        const bladeY = -1.3 + i * 0.44;
        blade.position.set(0, bladeY, 0.05);
        rackGroup.add(blade);

        // Blinking LED status strips
        const ledGeo = new THREE.BoxGeometry(0.08, 0.08, 0.02);
        const isTeal = (i % 2 === 0);
        const ledMat = new THREE.MeshBasicMaterial({
          color: isTeal ? 0x48d9d0 : 0x648cff,
        });
        const led1 = new THREE.Mesh(ledGeo, ledMat);
        led1.position.set(-0.55, bladeY, 0.69);
        rackGroup.add(led1);

        const led2 = new THREE.Mesh(ledGeo, ledMat);
        led2.position.set(-0.4, bladeY, 0.69);
        rackGroup.add(led2);
      }

      return rackGroup;
    };

    // Left Server Cluster (On-Premises / Private Infrastructure)
    const rackLeft = createServerRack(-4.2, 0.2, -2, 0x48d9d0, 0.38);
    cluster.add(rackLeft);

    // Right Server Cluster (Cloud Elastic Infrastructure)
    const rackRight = createServerRack(4.2, 0.4, -2.5, 0x648cff, -0.42);
    cluster.add(rackRight);

    // Central Floating Sovereign Cloud Ring / Base
    const ringGeo = new THREE.TorusGeometry(3.6, 0.03, 16, 100);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x48d9d0,
      transparent: true,
      opacity: 0.4,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2.2;
    ring.position.set(0, -2.2, -1);
    cluster.add(ring);

    const outerRingGeo = new THREE.TorusGeometry(5.2, 0.02, 16, 120);
    const outerRingMat = new THREE.MeshBasicMaterial({
      color: 0x648cff,
      transparent: true,
      opacity: 0.25,
    });
    const outerRing = new THREE.Mesh(outerRingGeo, outerRingMat);
    outerRing.rotation.x = Math.PI / 2.2;
    outerRing.position.set(0, -2.2, -1);
    cluster.add(outerRing);

    // Optical network fiber curves bridging left rack, center ring, and right rack
    const curve1 = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-4.2, 0.2, -2),
      new THREE.Vector3(0, 1.8, -1.2),
      new THREE.Vector3(4.2, 0.4, -2.5)
    );
    const tubeGeo1 = new THREE.TubeGeometry(curve1, 64, 0.02, 8, false);
    const tubeMat1 = new THREE.MeshBasicMaterial({
      color: 0x48d9d0,
      transparent: true,
      opacity: 0.45,
    });
    const tube1 = new THREE.Mesh(tubeGeo1, tubeMat1);
    cluster.add(tube1);

    const curve2 = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-4.2, -1.0, -2),
      new THREE.Vector3(0, -1.6, -1.0),
      new THREE.Vector3(4.2, -0.8, -2.5)
    );
    const tubeGeo2 = new THREE.TubeGeometry(curve2, 64, 0.02, 8, false);
    const tubeMat2 = new THREE.MeshBasicMaterial({
      color: 0x648cff,
      transparent: true,
      opacity: 0.4,
    });
    const tube2 = new THREE.Mesh(tubeGeo2, tubeMat2);
    cluster.add(tube2);

    // Flowing photon data packets traveling along the optical tubes
    const packetCount = 8;
    const packetGeo = new THREE.SphereGeometry(0.08, 12, 12);
    const packetMat = new THREE.MeshBasicMaterial({ color: 0xa5f3fc });
    const packets: THREE.Mesh[] = [];

    for (let i = 0; i < packetCount; i++) {
      const p = new THREE.Mesh(packetGeo, packetMat);
      scene.add(p);
      packets.push(p);
    }

    // Floating particle field
    const particleCount = 200;
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      particlePositions[i * 3] = (Math.random() - 0.5) * 22;
      particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 14;
      particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 14 - 3;
    }
    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x648cff,
      size: 0.06,
      transparent: true,
      opacity: 0.6,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // Mouse parallax tracking
    let targetX = 0;
    let targetY = 0;
    const handleMouseMove = (e: MouseEvent) => {
      const { innerWidth, innerHeight } = window;
      targetX = ((e.clientX / innerWidth) - 0.5) * 1.2;
      targetY = -((e.clientY / innerHeight) - 0.5) * 0.8;
    };
    window.addEventListener('mousemove', handleMouseMove);

    // Animation Loop
    let animId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Gentle floating elevation
      rackLeft.position.y = 0.2 + Math.sin(elapsed * 1.1) * 0.15;
      rackRight.position.y = 0.4 + Math.sin(elapsed * 1.2 + 1.5) * 0.18;

      // Rotation of holographic base rings
      ring.rotation.z = elapsed * 0.08;
      outerRing.rotation.z = -elapsed * 0.05;

      // Animate photon packets along curve 1
      for (let i = 0; i < packetCount; i++) {
        const t = (elapsed * 0.25 + i / packetCount) % 1;
        const pt = curve1.getPoint(t);
        packets[i].position.copy(pt);
      }

      // Smooth camera parallax
      camera.position.x += (targetX - camera.position.x) * 0.04;
      camera.position.y += (1.8 + targetY - camera.position.y) * 0.04;
      camera.lookAt(0, 0, -1);

      renderer.render(scene, camera);
    };

    animate();

    // Resize handler
    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
      renderer.dispose();
      if (container && renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="butane-login-3d-canvas"
      aria-hidden="true"
    />
  );
};
