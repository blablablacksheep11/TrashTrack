import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import {socketSetup} from './services/socket.js';
import { connectRedis } from './services/redis.js';

const app = express();
const server = createServer(app); // The default express doesn't support WebSocket
const PORT = process.env.PORT || 3000;

socketSetup(server); // Connect to WebSocket
await connectRedis(); // Connect to Redis

// __dirname replacement in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors()); // Use cors to allow cross-origin requests
app.use(express.json()); // Parse JSON request body
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded request body, for POST CRUD operation
app.use(express.static(path.join(__dirname, '../client'))); // Serve static files

// Automatically load all route files
const routesPath = path.join(__dirname, 'routes');
const routeFiles = fs.readdirSync(routesPath);

for (const file of routeFiles) {
  if (!file.endsWith('.js')) continue;

  const routeName = file.replace('.js', '');
  const routePath = '/' + routeName;

  const fullPath = path.join(routesPath, file);
  const routeModule = await import(pathToFileURL(fullPath).href);
  app.use(routePath, routeModule.default);
}

// Serve the navbar
app.get('/loadNavbar', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/navbar.html'));
})

// Serve the footer
app.get('/loadFooter', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/footer.html'));
})

server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
