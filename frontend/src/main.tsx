import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, Outlet, RouterProvider } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import Dialogos from "./components/Dialogos";
import { rotas } from "./navegacao/rotas";

const router = createBrowserRouter([
  {
    element: (
      <Dialogos>
        <Outlet />
      </Dialogos>
    ),
    children: rotas.map(({ path, tela, perfilTutor }) => ({
      path,
      element: <App tela={tela} perfilTutor={perfilTutor} />,
    })),
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
