import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import * as faceapi from 'face-api.js';
import canvas from 'canvas';

dotenv.config();

const { Canvas, Image, ImageData } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let prisma;
try {
  const dbModule = await import('./db.js').catch(() => null) 
    || await import('./prisma.js').catch(() => null)
    || await import('./config/db.js').catch(() => null);

  if (dbModule && (dbModule.default || dbModule.prisma)) {
    prisma = dbModule.default?.prisma || dbModule.prisma || dbModule.default;
  }
} catch {}

if (!prisma) {
  const { PrismaClient } = await import('@prisma/client');
  const { PrismaPg } = await import('@prisma/adapter-pg').catch(() => ({ PrismaPg: null }));
  const pg = await import('pg').catch(() => null);

  if (PrismaPg && pg) {
    const pool = new pg.default.Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    prisma = new PrismaClient({ adapter });
  } else {
    prisma = new PrismaClient();
  }
}

const FACES_DIR = path.join(__dirname, 'employee_faces');
const MODELS_DIR = path.join(__dirname, '../frontend/public/models');

async function loadModels() {
  console.log('⏳ Loading Face-API models from disk...');
  await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODELS_DIR);
  await faceapi.nets.faceLandmark68Net.loadFromDisk(MODELS_DIR);
  await faceapi.nets.faceRecognitionNet.loadFromDisk(MODELS_DIR);
  console.log('✅ AI Models loaded successfully!\n');
}

async function enrollAll() {
  await loadModels();

  if (!fs.existsSync(FACES_DIR)) {
    console.error(`❌ Folder not found: ${FACES_DIR}`);
    return;
  }

  const files = fs.readdirSync(FACES_DIR);
  console.log(`🔍 Found ${files.length} items in employee_faces/`);

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (!['.jpg', '.jpeg', '.png'].includes(ext)) continue;

    const email = path.basename(file, ext).trim();
    const filePath = path.join(FACES_DIR, file);

    console.log(`\n--------------------------------------------`);
    console.log(`Processing: ${email}...`);

    try {
      const img = await canvas.loadImage(filePath);
      const detection = await faceapi
        .detectSingleFace(img)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        console.error(`❌ No face detected in ${file}! Check lighting & angle.`);
        continue;
      }

      const descriptorArray = Array.from(detection.descriptor);
      const jsonDescriptor = JSON.stringify(descriptorArray);

      // Direct PostgreSQL query: bypasses Prisma schema validation
      await prisma.$executeRawUnsafe(
        `UPDATE "public"."User" SET "faceDescriptor" = $1::jsonb WHERE "email" = $2`,
        jsonDescriptor,
        email
      );

      console.log(`✅ Biometrics enrolled successfully for ${email}!`);
      console.log(`   Dimensions: ${descriptorArray.length} points stored.`);
    } catch (err) {
      console.error(`❌ Error analyzing ${file}:`, err.message);
    }
  }

  console.log(`\n🎉 Facial recognition enrollment complete!`);
  await prisma.$disconnect();
}

enrollAll().catch(async (err) => {
  console.error('Fatal execution error:', err);
  if (prisma) await prisma.$disconnect();
});