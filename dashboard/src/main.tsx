import React from "react";
import ReactDOM from "react-dom/client";
import { Amplify } from "aws-amplify";

import awsConfig from "./aws-exports";
import App from "./App";

import "./index.css";

console.log("AWS Config:", awsConfig);

Amplify.configure(awsConfig);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);