import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export default function ProductViewer({
  selectedPartId,
  onSelectPart,
  cameraView,
}) {
  const containerRef = useRef(null);
  const assemblyRef = useRef(null);
  const requestViewRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;

    // The scene holds our lights and 3D objects.
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#152033");

    // Perspective cameras make distant objects appear smaller.
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(4, 3, 5);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.setAttribute("role", "img");
    renderer.domElement.setAttribute(
      "aria-label",
      "3D cutaway filter assembly with housing, cartridge, top cap, and outlet",
    );
    container.appendChild(renderer.domElement);

    // Drag to orbit; scroll or pinch to zoom.
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 3;
    controls.maxDistance = 10;
    controls.target.set(0, 0.2, 0);
    controls.update();

    // Soft overall lighting plus a brighter directional light.
    const ambientLight = new THREE.HemisphereLight("#ffffff", "#475569", 2);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight("#ffffff", 3);
    keyLight.position.set(3, 5, 4);
    scene.add(keyLight);

    // Grouping lets us move the whole product together later.
    const assembly = new THREE.Group();
    assembly.name = "filter-assembly";
    scene.add(assembly);
    assemblyRef.current = assembly;

    const housingMaterial = new THREE.MeshStandardMaterial({
      color: "#64748b",
      metalness: 0.5,
      roughness: 0.4,
      side: THREE.DoubleSide,
    });

    const cartridgeMaterial = new THREE.MeshStandardMaterial({
      color: "#f59e0b",
      metalness: 0.1,
      roughness: 0.65,
    });

    const capMaterial = new THREE.MeshStandardMaterial({
      color: "#cbd5e1",
      metalness: 0.6,
      roughness: 0.3,
    });

    const outletMaterial = new THREE.MeshStandardMaterial({
      color: "#38bdf8",
      metalness: 0.4,
      roughness: 0.35,
    });

    // Partial cylinder: a 90-degree opening reveals the cartridge.
    const housing = new THREE.Mesh(
      new THREE.CylinderGeometry(
        0.85,
        0.85,
        2,
        48,
        1,
        true,
        Math.PI / 2,
        Math.PI * 1.5,
      ),
      housingMaterial,
    );
    housing.name = "housing";
    assembly.add(housing);

    const cartridge = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.55, 1.75, 32),
      cartridgeMaterial,
    );
    cartridge.name = "cartridge";
    assembly.add(cartridge);

    const topCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.95, 0.95, 0.22, 48),
      capMaterial,
    );
    topCap.name = "top-cap";
    topCap.position.y = 1.11;
    assembly.add(topCap);

    const outlet = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 0.8, 24),
      outletMaterial,
    );
    outlet.name = "outlet";
    outlet.rotation.z = Math.PI / 2;
    outlet.position.set(1.15, -0.55, 0);
    assembly.add(outlet);
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const canvas = renderer.domElement;

    let pointerStart = null;

    function handlePointerDown(event) {
      // Ignore secondary buttons and cancel selection during multitouch.
      if (!event.isPrimary || event.button !== 0) {
        pointerStart = null;
        return;
      }

      pointerStart = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        dragged: false,
      };
    }

    function handlePointerMove(event) {
      if (!pointerStart || event.pointerId !== pointerStart.id) return;

      const distance = Math.hypot(
        event.clientX - pointerStart.x,
        event.clientY - pointerStart.y,
      );

      // Once a gesture becomes a drag, it stays a drag.
      if (distance > 5) {
        pointerStart.dragged = true;
      }
    }

    function handlePointerUp(event) {
      if (!pointerStart || event.pointerId !== pointerStart.id) return;

      const gesture = pointerStart;
      pointerStart = null;

      const distance = Math.hypot(
        event.clientX - gesture.x,
        event.clientY - gesture.y,
      );

      if (gesture.dragged || distance > 5) return;

      const bounds = canvas.getBoundingClientRect();

      if (
        event.clientX < bounds.left ||
        event.clientX > bounds.right ||
        event.clientY < bounds.top ||
        event.clientY > bounds.bottom
      ) {
        return;
      }

      // Convert browser coordinates to Three.js coordinates: -1 to +1.
      pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;

      camera.updateMatrixWorld();
      assembly.updateWorldMatrix(true, true);
      raycaster.setFromCamera(pointer, camera);

      const [hit] = raycaster.intersectObjects(assembly.children, true);

      onSelectPart(hit ? hit.object.name : null);
    }

    function handlePointerCancel() {
      pointerStart = null;
    }

    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerup", handlePointerUp);
    canvas.addEventListener("pointercancel", handlePointerCancel);
    canvas.addEventListener("lostpointercapture", handlePointerCancel);

    // Match the canvas to its container, including layout changes.
    function resize() {
      const width = container.clientWidth;
      const height = container.clientHeight;

      if (!width || !height) return;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    renderer.setAnimationLoop(() => {
      if (cameraTransition) {
        const {
          fromPosition,
          fromTarget,
          toPosition,
          toTarget,
          startedAt,
          duration,
        } = cameraTransition;

        const progress =
          duration === 0
            ? 1
            : Math.min((performance.now() - startedAt) / duration, 1);

        // Smoothstep: start gently, speed up, then ease to a stop.
        const eased = progress * progress * (3 - 2 * progress);

        camera.position.lerpVectors(fromPosition, toPosition, eased);
        controls.target.lerpVectors(fromTarget, toTarget, eased);

        if (progress === 1) {
          cameraTransition = null;
          controls.enableDamping = true;
        }
      }

      controls.update();
      renderer.render(scene, camera);
    });

    // React may mount, clean up, and mount again in development.
    // Release everything this effect created.
    return () => {
      renderer.setAnimationLoop(null);
      resizeObserver.disconnect();
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerup", handlePointerUp);
      canvas.removeEventListener("pointercancel", handlePointerCancel);
      canvas.removeEventListener("lostpointercapture", handlePointerCancel);

      assemblyRef.current = null;
      controls.removeEventListener("start", cancelCameraTransition);
      requestViewRef.current = null;
      cameraTransition = null;
      controls.dispose();

      assembly.traverse((object) => {
        if (object.isMesh) {
          object.geometry.dispose();
        }
      });

      housingMaterial.dispose();
      cartridgeMaterial.dispose();
      capMaterial.dispose();
      outletMaterial.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [onSelectPart]);

  useEffect(() => {
    const assembly = assemblyRef.current;
    if (!assembly) return;

    assembly.traverse((object) => {
      if (!object.isMesh) return;

      const isSelected = object.name === selectedPartId;

      object.material.emissive.set(isSelected ? "#38bdf8" : "#000000");
      object.material.emissiveIntensity = isSelected ? 0.45 : 0;
    });
  }, [selectedPartId, onSelectPart]);
  useEffect(() => {
    if (cameraView) {
      requestViewRef.current?.(cameraView);
    }
  }, [cameraView, onSelectPart]);
  return <div ref={containerRef} className="product-viewer" />;
}
