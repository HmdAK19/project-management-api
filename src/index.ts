import app from "./app.js";
import { config } from "./config/index.js";

// Vercel imports the application; local execution starts the HTTP listener.
if (!process.env.VERCEL) {
  app.listen(config.port, () => {
    console.log(`Project Management API: http://localhost:${config.port}/api`);
  });
}

export default app;
