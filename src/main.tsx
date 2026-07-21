import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BeadgridApp } from "./BeadgridApp";
import "./globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BeadgridApp />
  </StrictMode>,
);
