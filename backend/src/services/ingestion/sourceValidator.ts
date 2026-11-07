import dns from 'node:dns/promises';
import path from 'node:path';

export interface ValidationResult {
  valid: boolean;
  error?: string;
  normalizedUrl?: string;
  resolvedIp?: string;
  contentLength?: number;
  contentType?: string;
  suggestedFilename?: string;
}

const SUPPORTED_EXTENSIONS = new Set(['.mp4', '.mov', '.mkv', '.webm', '.avi']);
const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024 * 1024; // 4 GB limit

/**
 * Checks whether an IPv4 or IPv6 address is private, loopback, or link-local.
 * Protects against Server-Side Request Forgery (SSRF).
 */
export function isPrivateOrReservedIp(ip: string): boolean {
  if (!ip || typeof ip !== 'string') return true;

  // Handle IPv4 mapped IPv6 (e.g. ::ffff:127.0.0.1)
  if (ip.startsWith('::ffff:')) {
    ip = ip.replace('::ffff:', '');
  }

  // IPv6 checks
  if (ip === '::1' || ip === '::' || ip.toLowerCase().startsWith('fe80:') || ip.toLowerCase().startsWith('fc') || ip.toLowerCase().startsWith('fd')) {
    return true;
  }

  // IPv4 checks
  const parts = ip.split('.').map(Number);
  if (parts.length === 4 && parts.every(p => !isNaN(p) && p >= 0 && p <= 255)) {
    const [b0, b1] = parts;
    if (b0 === 0) return true;                                // 0.0.0.0/8
    if (b0 === 10) return true;                               // 10.0.0.0/8
    if (b0 === 127) return true;                              // 127.0.0.0/8 (Loopback)
    if (b0 === 169 && b1 === 254) return true;                // 169.254.0.0/16 (Link-local / Cloud metadata)
    if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;      // 172.16.0.0/12
    if (b0 === 192 && b1 === 168) return true;               // 192.168.0.0/16
    if (b0 >= 224) return true;                               // 224.0.0.0/4 (Multicast/Broadcast)
  }

  return false;
}

/**
 * Validates direct media URLs with strict SSRF protection and head verification.
 */
export async function validateDirectMediaUrl(inputUrl: string): Promise<ValidationResult> {
  if (!inputUrl || typeof inputUrl !== 'string') {
    return { valid: false, error: 'URL is required.' };
  }

  let parsed: URL;
  try {
    parsed = new URL(inputUrl.trim());
  } catch {
    return { valid: false, error: 'Invalid URL format.' };
  }

  // 1. Only allow HTTP and HTTPS protocols
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, error: `Protocol "${parsed.protocol}" is not supported. Use HTTP or HTTPS.` };
  }

  const hostname = parsed.hostname.toLowerCase();

  // 2. Reject obvious localhost or private keywords
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname === '127.0.0.1' ||
    hostname === '::1'
  ) {
    return { valid: false, error: 'Requests to localhost or local domains are prohibited for security.' };
  }

  // 3. DNS resolution & IP check (SSRF prevention)
  let resolvedIp = '';
  try {
    const lookup = await dns.lookup(hostname, { all: false });
    resolvedIp = lookup.address;

    if (isPrivateOrReservedIp(resolvedIp)) {
      return {
        valid: false,
        error: `URL resolves to private or loopback IP (${resolvedIp}). Access denied.`,
      };
    }
  } catch (err: any) {
    return {
      valid: false,
      error: `Could not resolve hostname "${hostname}": ${err.message || 'DNS resolution failed'}`,
    };
  }

  // 4. Verify file extension from URL pathname
  const ext = path.extname(parsed.pathname).toLowerCase();

  // 5. Query HEAD / Range to verify content without downloading entire file
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const headRes = await fetch(parsed.toString(), {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent': 'ClipVault-AI-Ingestion/2.0 (+https://github.com/rdivyatej-cloud/clipvault-ai)',
      },
    });
    clearTimeout(timeout);

    // If HEAD is not allowed (some servers return 405), fallback to minimal GET range
    let contentLength = parseInt(headRes.headers.get('content-length') || '0', 10);
    let contentType = headRes.headers.get('content-type') || '';
    const contentDisposition = headRes.headers.get('content-disposition') || '';

    if (!headRes.ok && headRes.status === 405) {
      // Try GET with Range 0-0
      const rangeController = new AbortController();
      const rangeTimeout = setTimeout(() => rangeController.abort(), 8000);
      const rangeRes = await fetch(parsed.toString(), {
        method: 'GET',
        headers: {
          Range: 'bytes=0-0',
          'User-Agent': 'ClipVault-AI-Ingestion/2.0',
        },
        signal: rangeController.signal,
      });
      clearTimeout(rangeTimeout);

      if (rangeRes.ok || rangeRes.status === 206) {
        const contentRange = rangeRes.headers.get('content-range') || '';
        const match = contentRange.match(/\/(\d+)$/);
        if (match) {
          contentLength = parseInt(match[1], 10);
        }
        contentType = rangeRes.headers.get('content-type') || '';
      }
    }

    // Enforce size limit
    if (contentLength > MAX_FILE_SIZE_BYTES) {
      return {
        valid: false,
        error: `File size (${(contentLength / (1024 * 1024 * 1024)).toFixed(2)} GB) exceeds maximum limit of 4 GB.`,
      };
    }

    // Check media type
    const isVideoMime = contentType.toLowerCase().includes('video/') ||
      contentType.toLowerCase().includes('application/mp4') ||
      contentType.toLowerCase().includes('application/octet-stream');

    if (!SUPPORTED_EXTENSIONS.has(ext) && !isVideoMime && contentType) {
      return {
        valid: false,
        error: `Unsupported content type "${contentType}". Supported video formats: MP4, MOV, MKV, WEBM.`,
      };
    }

    // Extract suggested filename
    let suggestedFilename = '';
    if (contentDisposition) {
      const match = contentDisposition.match(/filename\*?=['"]?(?:UTF-\d['"]*)?([^;\r\n"']*)['"]?/i);
      if (match && match[1]) {
        suggestedFilename = path.basename(decodeURIComponent(match[1]));
      }
    }
    if (!suggestedFilename) {
      suggestedFilename = path.basename(parsed.pathname) || `media_${Date.now()}${ext || '.mp4'}`;
    }

    return {
      valid: true,
      normalizedUrl: parsed.toString(),
      resolvedIp,
      contentLength,
      contentType,
      suggestedFilename,
    };
  } catch (err: any) {
    // If HEAD failed with network error
    if (err.name === 'AbortError') {
      return { valid: false, error: 'Connection to media URL timed out.' };
    }
    // If the server doesn't support HEAD but URL has a known video extension, allow proceeding
    if (SUPPORTED_EXTENSIONS.has(ext)) {
      return {
        valid: true,
        normalizedUrl: parsed.toString(),
        resolvedIp,
        suggestedFilename: path.basename(parsed.pathname),
      };
    }
    return { valid: false, error: `Failed to connect to media URL: ${err.message}` };
  }
}

