/**
 * Caching Middleware
 * Adds appropriate cache control headers to responses
 */

const cacheControl = (options = {}) => {
  const {
    public = false,
    maxAge = 0,
    sMaxAge = 0,
    noCache = false,
    noStore = false,
    mustRevalidate = true,
  } = options;

  return (req, res, next) => {
    if (noCache) {
      // No caching
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
    } else if (noStore) {
      // No storing
      res.set('Cache-Control', 'no-store');
    } else {
      // Configure caching
      let cacheHeader = public ? 'public' : 'private';

      if (maxAge > 0) {
        cacheHeader += `, max-age=${maxAge}`;
      }

      if (sMaxAge > 0) {
        cacheHeader += `, s-maxage=${sMaxAge}`;
      }

      if (mustRevalidate) {
        cacheHeader += ', must-revalidate';
      }

      res.set('Cache-Control', cacheHeader);
    }

    next();
  };
};

// Presets for common cases
const cachePresets = {
  // For static resources that can be cached for a long time
  staticAssets: cacheControl({
    public: true,
    maxAge: 86400, // 1 day
    sMaxAge: 604800, // 1 week
    mustRevalidate: false,
  }),

  // For dynamic data that changes occasionally
  dynamicContent: cacheControl({
    public: true,
    maxAge: 300, // 5 minutes
    mustRevalidate: true,
  }),

  // For user-specific data
  userContent: cacheControl({
    public: false,
    maxAge: 60, // 1 minute
    mustRevalidate: true,
  }),

  // For sensitive data that shouldn't be cached
  noCache: cacheControl({
    noCache: true,
  }),

  // For sensitive data that shouldn't even be stored
  noStore: cacheControl({
    noStore: true,
  }),
};

// Helper function to directly apply no-store headers to a response
const applyNoStore = (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
};

module.exports = {
  cacheControl,
  ...cachePresets,
  applyNoStore,
};
