import { useState } from "react";
import ProductViewer from "./components/ProductViewer";
import { productParts } from "./data/productParts";
import "./App.css";

function App() {
  const [selectedPartId, setSelectedPartId] = useState(null);

  // guided camera views and a Reset View button
  const [cameraView, setCameraView] = useState(null);

  function showView(partId, position, target) {
    setSelectedPartId(partId);
    setCameraView({ position, target });
  }

  const selectedPart = productParts.find((part) => part.id === selectedPartId);

  return (
    <main className="explorer">
      <header className="explorer-header">
        <p className="eyebrow">Interactive product demo</p>
        <h1>Industrial Filter Explorer</h1>
        <p>Explore a simplified filter assembly in 3D.</p>
      </header>

      <div className="explorer-layout">
        <section className="viewer-panel" aria-label="Product explorer">
          <ProductViewer
            selectedPartId={selectedPartId}
            onSelectPart={setSelectedPartId}
          />

          <p className="viewer-help">
            Drag to rotate · Scroll to zoom · Click a part to inspect
          </p>
        </section>

        <aside className="details-panel" aria-labelledby="components-heading">
          <h2 id="components-heading">Components</h2>
          <p>Select a part in the model or choose one below.</p>

          <div className="part-list">
            {productParts.map((part) => (
              <button
                key={part.id}
                type="button"
                className="part-button"
                aria-pressed={selectedPartId === part.id}
                onClick={() => setSelectedPartId(part.id)}
              >
                {part.label}
              </button>
            ))}
          </div>

          <div className="part-description" aria-live="polite">
            <h3>
              {selectedPart ? selectedPart.label : "Explore the assembly"}
            </h3>
            <p>
              {selectedPart
                ? selectedPart.description
                : "Choose a component to learn about its purpose."}
            </p>
          </div>

          <button
            type="button"
            className="clear-button"
            disabled={selectedPartId === null}
            onClick={() => setSelectedPartId(null)}
          >
            Clear selection
          </button>
        </aside>
      </div>
    </main>
  );
}

export default App;
