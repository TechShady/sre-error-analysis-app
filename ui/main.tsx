/**
 * App entry point
 */

import React from "react";
import ReactDOM from "react-dom/client";
import { SREErrorAnalysisApp } from "../src/App";

const root = ReactDOM.createRoot(
  document.getElementById("root") || document.body
);

root.render(
  <React.StrictMode>
    <SREErrorAnalysisApp />
  </React.StrictMode>
);
