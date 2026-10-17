import { Request, Response, NextFunction } from 'express';

// Provider-controlled module flags. INSTANCE_FEATURES is a JSON object of
// overrides on an all-enabled default, e.g. '{"map":false,"reports":false}'.
// Set at provisioning time — deliberately not editable via PUT /api/instance.
export const ALL_FEATURES = ['publicPortal', 'map', 'analytics', 'reports', 'progress'] as const;
export type FeatureKey = (typeof ALL_FEATURES)[number];

export const getFeatures = (): Record<string, boolean> => {
  const features: Record<string, boolean> = Object.fromEntries(ALL_FEATURES.map((f) => [f, true]));
  try {
    const overrides = JSON.parse(process.env.INSTANCE_FEATURES || '{}');
    for (const k of Object.keys(features)) {
      if (typeof overrides[k] === 'boolean') features[k] = overrides[k];
    }
  } catch {
    console.error('INSTANCE_FEATURES is not valid JSON — using defaults');
  }
  return features;
};

export const isEnabled = (key: FeatureKey): boolean => getFeatures()[key] !== false;

export const requireFeature = (key: FeatureKey) =>
  (_req: Request, res: Response, next: NextFunction) => {
    if (!isEnabled(key)) {
      return res.status(403).json({ success: false, message: `Feature '${key}' is not enabled on this deployment` });
    }
    return next();
  };
