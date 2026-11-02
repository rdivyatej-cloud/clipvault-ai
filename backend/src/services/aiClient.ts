import http from 'node:http';

const AI_ENGINE_HOST = process.env.AI_ENGINE_HOST || '127.0.0.1';
const AI_ENGINE_PORT = parseInt(process.env.AI_ENGINE_PORT || '8000', 10);

async function postJson<T>(path: string, body: any, timeoutMs: number = 300000): Promise<T> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      {
        hostname: AI_ENGINE_HOST,
        port: AI_ENGINE_PORT,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
        timeout: timeoutMs,
      },
      (res) => {
        let responseBody = '';
        res.on('data', (chunk) => {
          responseBody += chunk;
        });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(responseBody));
            } catch (err) {
              reject(new Error(`Failed to parse AI response: ${responseBody}`));
            }
          } else {
            reject(new Error(`AI Engine error (${res.statusCode}): ${responseBody}`));
          }
        });
      }
    );

    req.on('error', (err) => {
      reject(new Error(`Failed to connect to AI engine at ${AI_ENGINE_HOST}:${AI_ENGINE_PORT} - ${err.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`AI Engine request to ${path} timed out after ${timeoutMs / 1000}s`));
    });

    req.write(data);
    req.end();
  });
}

export async function checkAiEngineHealth(): Promise<any> {
  return new Promise((resolve) => {
    const req = http.get(
      {
        hostname: AI_ENGINE_HOST,
        port: AI_ENGINE_PORT,
        path: '/health',
        timeout: 3000,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch {
            resolve({ status: 'offline', error: 'Invalid response' });
          }
        });
      }
    );
    req.on('error', (err) => resolve({ status: 'offline', error: err.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 'offline', error: 'Timeout' });
    });
  });
}

export async function transcribeAudio(audioPath: string, modelSize: string = 'base'): Promise<any> {
  return postJson('/transcribe', { audio_path: audioPath, model_size: modelSize });
}

export async function analyzeMoments(params: {
  video_path: string;
  audio_path: string;
  transcript_segments: any[];
  min_clip_duration: number;
  max_clip_duration: number;
  ollama_url?: string;
  ollama_model?: string;
}): Promise<any> {
  return postJson('/analyze-moments', params);
}

export async function renderClip(params: {
  video_path: string;
  start_time: number;
  end_time: number;
  output_path: string;
  thumbnail_path: string;
  transcript_segments: any[];
  framing_mode?: string;
  subtitle_style?: string;
  audio_norm?: boolean;
}): Promise<any> {
  return postJson('/render-clip', params);
}

