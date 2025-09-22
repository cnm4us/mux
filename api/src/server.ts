import { buildApp } from "./app.js";
import { config } from "./config/index.js";

const app = buildApp();
app.listen(config.PORT, config.HOST, () => {
  console.log(`API listening on ${config.HOST}:${config.PORT} (ESM)`);
});