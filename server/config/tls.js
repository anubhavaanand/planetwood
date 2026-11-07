// TLS/WSS configuration for Planetwood relay server
// Dev: self-signed cert generation (using selfsigned package)
// Prod: cert/key loaded from TLS_CERT_PATH / TLS_KEY_PATH env vars

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const CERT_DIR = path.resolve(process.cwd(), 'certs');
const DEV_CERT_PATH = path.join(CERT_DIR, 'dev-cert.pem');
const DEV_KEY_PATH = path.join(CERT_DIR, 'dev-key.pem');
const DEFAULT_PORT = 3005;

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

export function getPort() {
  return parseInt(process.env.PORT || String(DEFAULT_PORT), 10);
}

function loadSelfsigned() {
  try {
    return require('selfsigned');
  } catch {
    return null;
  }
}

function generateDevCert() {
  const selfsigned = loadSelfsigned();
  if (!selfsigned) {
    throw new Error(
      'selfsigned package is required for dev TLS. Install it: npm install --save-dev selfsigned'
    );
  }
  const attrs = [{ name: 'commonName', value: 'planetwood-dev' }];
  const certs = selfsigned.generate(attrs, {
    days: 365,
    keySize: 2048,
    algorithm: 'sha256',
  });
  if (!fs.existsSync(CERT_DIR)) {
    fs.mkdirSync(CERT_DIR, { recursive: true });
  }
  fs.writeFileSync(DEV_CERT_PATH, certs.cert);
  fs.writeFileSync(DEV_KEY_PATH, certs.private);
  return { cert: certs.cert, key: certs.private };
}

function loadDevCert() {
  try {
    if (!fs.existsSync(DEV_CERT_PATH) || !fs.existsSync(DEV_KEY_PATH)) {
      return null;
    }
    return {
      cert: fs.readFileSync(DEV_CERT_PATH),
      key: fs.readFileSync(DEV_KEY_PATH),
    };
  } catch {
    return null;
  }
}

function loadProdCert() {
  const certPath = process.env.TLS_CERT_PATH;
  const keyPath = process.env.TLS_KEY_PATH;
  if (!certPath || !keyPath) {
    throw new Error(
      'Production TLS requires TLS_CERT_PATH and TLS_KEY_PATH environment variables'
    );
  }
  return {
    cert: fs.readFileSync(certPath),
    key: fs.readFileSync(keyPath),
  };
}

export function getTlsOptions() {
  if (isProduction()) {
    return loadProdCert();
  }
  // Dev: load existing or generate self-signed cert; return null if unavailable (WS fallback)
  let options = loadDevCert();
  if (!options) {
    try {
      options = generateDevCert();
    } catch {
      return null;
    }
  }
  return options;
}

export function getScheme(tlsOptions) {
  return tlsOptions ? 'wss' : 'ws';
}

export function getWsUrl(tlsOptions) {
  const port = getPort();
  return `${getScheme(tlsOptions)}://localhost:${port}`;
}

export function isTlsAvailable() {
  if (isProduction()) {
    return Boolean(process.env.TLS_CERT_PATH) && Boolean(process.env.TLS_KEY_PATH);
  }
  return true;
}

export { CERT_DIR, DEV_CERT_PATH, DEV_KEY_PATH, isProduction };
