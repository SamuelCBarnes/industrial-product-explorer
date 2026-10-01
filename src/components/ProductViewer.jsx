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

  // Create the scene, interactions, and animation loop.
  useEffect(() => {
    const container = containerRef.current;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#152033");

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(4, 3, 5);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const canvas = renderer.domElement;
    canvas.setAttribute("role", "img");
    canvas.setAttribute(
      "aria-label",
      "3D cutaway filter assembly with housing, cartridge, top cap, and outlet",
    );
    container.appendChild(canvas);

    // Orbit controls.
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 3;
    controls.maxDistance = 10;
    controls.target.set(0, 0.2, 0);
    controls.update();

    // Guided camera transitions.
    let cameraTransition = null;

    requestViewRef.current = (view) => {
      // Clear remaining orbit inertia before starting a transition.
      controls.enableDamping = false;
      controls.update();

      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      cameraTransition = {
        fromPosition: camera.position.clone(),
        fromTarget: controls.target.clone(),
        toPosition: new THREE.Vector3(...view.position),
        toTarget: new THREE.Vector3(...view.target),
        startedAt: performance.now(),
        duration: prefersReducedMotion ? 0 : 900,
      };
    };

    function cancelCameraTransition() {
      cameraTransition = null;
      controls.enableDamping = true;
    }

    controls.addEventListener("start", cancelCameraTransition);

    // Lighting.
    const ambientLight = new THREE.HemisphereLight(
      "#ffffff",
      "#475569",
      2,
    );
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight("#ffffff", 3);
    keyLight.position.set(3, 5, 4);
    scene.add(keyLight);

    // Product assembly.
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

    // Partial cylinder with a 90-degree cutaway.
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

    // Component selection.
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    let pointerStart = null;

    function handlePointerDown(event) {
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

      if (!bounds.width || !bounds.height) return;

      if (
        event.clientX < bounds.left ||
        event.clientX > bounds.right ||
        event.clientY < bounds.top ||
        event.clientY > bounds.bottom
      ) {
        return;
      }

      // Convert screen coordinates to normalized device coordinates.
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

    // Responsive canvas sizing.
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

    // Animate the camera and render the scene.
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

    // Release everything created by this effect.
    return () => {
      renderer.setAnimationLoop(null);
      resizeObserver.disconnect();

      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerup", handlePointerUp);
      canvas.removeEventListener("pointercancel", handlePointerCancel);
      canvas.removeEventListener("lostpointercapture", handlePointerCancel);

      controls.removeEventListener("start", cancelCameraTransition);
      controls.dispose();

      requestViewRef.current = null;
      assemblyRef.current = null;
      cameraTransition = null;

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
      canvas.remove();
    };
  }, [onSelectPart]);

  // Synchronize material highlighting with React selection state.
  useEffect(() => {
    const assembly = assemblyRef.current;
    if (!assembly) return;

    assembly.traverse((object) => {
      if (!object.isMesh) return;

      const isSelected = object.name === selectedPartId;

      object.material.emissive.set(
        isSelected ? "#38bdf8" : "#000000",
      );
      object.material.emissiveIntensity = isSelected ? 0.45 : 0;
    });
  }, [selectedPartId, onSelectPart]);

  // Forward React camera requests to the existing Three.js scene.
  useEffect(() => {
    if (cameraView) {
      requestViewRef.current?.(cameraView);
    }
  }, [cameraView, onSelectPart]);

  return <div ref={containerRef} className="product-viewer" />;
}