import { Router, Request, Response } from 'express';
import { dbQuery, isFallback, memoryDb } from '../db.js';
import { authenticateToken, formatPhotoUrl } from './auth.routes.js';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';

const router = Router();
const UPLOADS_DIR = process.env.UPLOADS_DIR || join(process.cwd(), 'uploads');

const extensionMap: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp'
};

const getVehiclePhotoFilePath = (url: string | null): string | null => {
  if (!url) return null;
  const match = url.match(/(?:\/api)?\/uploads\/vehicle-photos\/([^/?#]+)$/);
  return match ? join(UPLOADS_DIR, 'vehicle-photos', match[1]) : null;
};

async function getVehicleAndCheckOwner(vehicleId: string, userId: string) {
  if (isFallback) {
    const veh = memoryDb.vehicles.find(v => v.id === vehicleId);
    if (!veh) return { notFound: true };
    const ownerId = veh.user_id || veh.userId;
    if (ownerId !== userId) return { forbidden: true };
    return { vehicle: veh };
  } else {
    const res = await dbQuery('SELECT * FROM vehicles WHERE id = $1', [vehicleId]);
    if (res.rows.length === 0) return { notFound: true };
    if (res.rows[0].user_id !== userId) return { forbidden: true };
    return { vehicle: res.rows[0] };
  }
}

export async function getVehiclePhotosList(vehicleId: string): Promise<{ id: string; photoUrl: string }[]> {
  if (isFallback) {
    return (memoryDb.vehiclePhotos || [])
      .filter(p => p.vehicle_id === vehicleId)
      .map(p => ({ id: p.id, photoUrl: formatPhotoUrl(p.photo_url) || '' }));
  } else {
    const res = await dbQuery('SELECT id, photo_url FROM vehicle_photos WHERE vehicle_id = $1 ORDER BY created_at ASC', [vehicleId]);
    return res.rows.map((r: any) => ({ id: r.id, photoUrl: formatPhotoUrl(r.photo_url) || '' }));
  }
}

// 0. POST /api/vehicles (Create a registered vehicle for the authenticated user)
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  const decoded = (req as any).user;
  const userId = decoded.userId || decoded.id;
  const { model, numberPlate, type, color } = req.body;

  if (!model || !numberPlate) {
    return res.status(400).json({ error: 'Model and number plate are required' });
  }

  const id = `veh_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const vehType = type || 'Sedan';
  const vehColor = color || 'Silver';

  try {
    if (isFallback) {
      const newVeh = {
        id,
        user_id: userId,
        model,
        number_plate: numberPlate,
        type: vehType,
        color: vehColor,
        created_at: new Date().toISOString()
      };
      memoryDb.vehicles.push(newVeh);
      return res.status(201).json({
        vehicle: {
          id: newVeh.id,
          model: newVeh.model,
          type: newVeh.type,
          color: newVeh.color,
          numberPlate: newVeh.number_plate,
          photos: [],
          photoDetails: []
        }
      });
    } else {
      const resVeh = await dbQuery(
        `INSERT INTO vehicles (id, user_id, model, number_plate, type, color, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *`,
        [id, userId, model, numberPlate, vehType, vehColor]
      );
      const row = resVeh.rows[0];
      return res.status(201).json({
        vehicle: {
          id: row.id,
          model: row.model,
          type: row.type,
          color: row.color,
          numberPlate: row.number_plate,
          photos: [],
          photoDetails: []
        }
      });
    }
  } catch (err: any) {
    console.error('Create Vehicle Error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// 1. GET /api/vehicles/:vehicleId/photos (List vehicle photos)
router.get('/:vehicleId/photos', async (req: Request, res: Response) => {
  const { vehicleId } = req.params;
  try {
    const photos = await getVehiclePhotosList(vehicleId);
    return res.json({ photos });
  } catch (err: any) {
    console.error('Fetch Vehicle Photos Error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// 2. POST /api/vehicles/:vehicleId/photos (Upload a vehicle photo, max 3)
router.post('/:vehicleId/photos', authenticateToken, async (req: Request, res: Response) => {
  const decoded = (req as any).user;
  const userId = decoded.userId || decoded.id;
  const { vehicleId } = req.params;
  const { photo } = req.body;

  try {
    const check = await getVehicleAndCheckOwner(vehicleId, userId);
    if (check.notFound) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    if (check.forbidden) {
      return res.status(403).json({ error: 'You do not have permission to modify this vehicle' });
    }

    const currentPhotos = await getVehiclePhotosList(vehicleId);
    if (currentPhotos.length >= 3) {
      return res.status(400).json({ error: 'Maximum 3 photos allowed per vehicle' });
    }

    if (!photo || typeof photo !== 'string') {
      return res.status(400).json({ error: 'Photo data is required' });
    }

    const match = photo.match(/^data:(image\/(jpeg|png|webp));base64,(.+)$/);
    if (!match) {
      return res.status(400).json({ error: 'Invalid image format. Allowed formats: JPEG, PNG, WEBP.' });
    }

    const mimeType = match[1];
    const ext = extensionMap[mimeType] || '.jpg';
    const base64Data = match[3];
    const buffer = Buffer.from(base64Data, 'base64');

    // 5 MB limit
    if (buffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'Image file size exceeds maximum limit of 5 MB.' });
    }

    const fileName = `veh_${vehicleId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}${ext}`;
    const dirPath = join(UPLOADS_DIR, 'vehicle-photos');
    await mkdir(dirPath, { recursive: true });
    await writeFile(join(dirPath, fileName), buffer);
    const relativePhotoUrl = `/api/uploads/vehicle-photos/${fileName}`;

    const photoId = `vp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    if (isFallback) {
      if (!memoryDb.vehiclePhotos) memoryDb.vehiclePhotos = [];
      memoryDb.vehiclePhotos.push({
        id: photoId,
        vehicle_id: vehicleId,
        photo_url: relativePhotoUrl,
        created_at: new Date().toISOString()
      });
    } else {
      await dbQuery(
        'INSERT INTO vehicle_photos (id, vehicle_id, photo_url, created_at) VALUES ($1, $2, $3, NOW())',
        [photoId, vehicleId, relativePhotoUrl]
      );
    }

    const updatedPhotos = await getVehiclePhotosList(vehicleId);
    return res.json({
      success: true,
      photo: { id: photoId, photoUrl: relativePhotoUrl },
      photos: updatedPhotos
    });
  } catch (err: any) {
    console.error('Upload Vehicle Photo Error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// 3. PUT /api/vehicles/:vehicleId/photos/:photoId (Replace a vehicle photo)
router.put('/:vehicleId/photos/:photoId', authenticateToken, async (req: Request, res: Response) => {
  const decoded = (req as any).user;
  const userId = decoded.userId || decoded.id;
  const { vehicleId, photoId } = req.params;
  const { photo } = req.body;

  try {
    const check = await getVehicleAndCheckOwner(vehicleId, userId);
    if (check.notFound) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    if (check.forbidden) {
      return res.status(403).json({ error: 'You do not have permission to modify this vehicle' });
    }

    let existingPhotoUrl: string | null = null;
    if (isFallback) {
      const p = (memoryDb.vehiclePhotos || []).find(ph => ph.id === photoId && ph.vehicle_id === vehicleId);
      if (!p) return res.status(404).json({ error: 'Photo not found' });
      existingPhotoUrl = p.photo_url;
    } else {
      const pRes = await dbQuery('SELECT photo_url FROM vehicle_photos WHERE id = $1 AND vehicle_id = $2', [photoId, vehicleId]);
      if (pRes.rows.length === 0) return res.status(404).json({ error: 'Photo not found' });
      existingPhotoUrl = pRes.rows[0].photo_url;
    }

    if (!photo || typeof photo !== 'string') {
      return res.status(400).json({ error: 'Photo data is required' });
    }

    const match = photo.match(/^data:(image\/(jpeg|png|webp));base64,(.+)$/);
    if (!match) {
      return res.status(400).json({ error: 'Invalid image format. Allowed formats: JPEG, PNG, WEBP.' });
    }

    const mimeType = match[1];
    const ext = extensionMap[mimeType] || '.jpg';
    const buffer = Buffer.from(match[3], 'base64');

    if (buffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'Image file size exceeds maximum limit of 5 MB.' });
    }

    const fileName = `veh_${vehicleId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}${ext}`;
    const dirPath = join(UPLOADS_DIR, 'vehicle-photos');
    await mkdir(dirPath, { recursive: true });
    await writeFile(join(dirPath, fileName), buffer);
    const newRelativeUrl = `/api/uploads/vehicle-photos/${fileName}`;

    if (isFallback) {
      const p = memoryDb.vehiclePhotos.find(ph => ph.id === photoId && ph.vehicle_id === vehicleId);
      if (p) p.photo_url = newRelativeUrl;
    } else {
      await dbQuery('UPDATE vehicle_photos SET photo_url = $1 WHERE id = $2 AND vehicle_id = $3', [newRelativeUrl, photoId, vehicleId]);
    }

    // Unlink old photo
    const oldPath = getVehiclePhotoFilePath(existingPhotoUrl);
    if (oldPath) {
      try {
        await unlink(oldPath);
      } catch (e) {
        // ignore missing old file
      }
    }

    const updatedPhotos = await getVehiclePhotosList(vehicleId);
    return res.json({
      success: true,
      photo: { id: photoId, photoUrl: newRelativeUrl },
      photos: updatedPhotos
    });
  } catch (err: any) {
    console.error('Replace Vehicle Photo Error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// 4. DELETE /api/vehicles/:vehicleId/photos/:photoId (Delete a vehicle photo)
router.delete('/:vehicleId/photos/:photoId', authenticateToken, async (req: Request, res: Response) => {
  const decoded = (req as any).user;
  const userId = decoded.userId || decoded.id;
  const { vehicleId, photoId } = req.params;

  try {
    const check = await getVehicleAndCheckOwner(vehicleId, userId);
    if (check.notFound) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    if (check.forbidden) {
      return res.status(403).json({ error: 'You do not have permission to modify this vehicle' });
    }

    let existingPhotoUrl: string | null = null;
    if (isFallback) {
      const idx = (memoryDb.vehiclePhotos || []).findIndex(ph => ph.id === photoId && ph.vehicle_id === vehicleId);
      if (idx === -1) return res.status(404).json({ error: 'Photo not found' });
      existingPhotoUrl = memoryDb.vehiclePhotos[idx].photo_url;
      memoryDb.vehiclePhotos.splice(idx, 1);
    } else {
      const pRes = await dbQuery('SELECT photo_url FROM vehicle_photos WHERE id = $1 AND vehicle_id = $2', [photoId, vehicleId]);
      if (pRes.rows.length === 0) return res.status(404).json({ error: 'Photo not found' });
      existingPhotoUrl = pRes.rows[0].photo_url;
      await dbQuery('DELETE FROM vehicle_photos WHERE id = $1 AND vehicle_id = $2', [photoId, vehicleId]);
    }

    const filePath = getVehiclePhotoFilePath(existingPhotoUrl);
    if (filePath) {
      try {
        await unlink(filePath);
      } catch (e) {
        // ignore missing file
      }
    }

    const updatedPhotos = await getVehiclePhotosList(vehicleId);
    return res.json({
      success: true,
      message: 'Photo deleted successfully',
      photos: updatedPhotos
    });
  } catch (err: any) {
    console.error('Delete Vehicle Photo Error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;
