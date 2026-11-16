import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import Dialogos from "./components/Dialogos";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Dialogos>
      <App />
    </Dialogos>
  </StrictMode>,
);
