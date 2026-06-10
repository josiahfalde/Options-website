import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { StoreProvider } from "./data/store";
import { AuthProvider } from "./auth/AuthProvider";
import { AuthUIProvider } from "./auth/AuthUI";
import { ThemeProvider } from "./lib/theme";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <HashRouter>
        <AuthProvider>
          <StoreProvider>
            <AuthUIProvider>
              <App />
            </AuthUIProvider>
          </StoreProvider>
        </AuthProvider>
      </HashRouter>
    </ThemeProvider>
  </React.StrictMode>
);
