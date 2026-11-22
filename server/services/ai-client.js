/**
 * MindRush — Node.js AI Service Client
 * Loopback HTTP client communicating with the stateless Python FastAPI service.
 */

import http from 'http';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:5050';
const AI_SERVICE_SECRET = process.env.AI_SERVICE_SECRET || 'dev_internal_secret_key_change_in_production';

export class AiClient {
  constructor(baseUrl = AI_SERVICE_URL, secret = AI_SERVICE_SECRET) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.secret = secret;
  }

  async healthCheck() {
    return this._request('GET', '/health', null, false);
  }

  async ping() {
    return this._request('GET', '/internal/ping');
  }

  async generateQuestions(params) {
    return this._request('POST', '/internal/generation/generate', params);
  }

  async validateQuestion(params) {
    return this._request('POST', '/internal/validation/validate', params);
  }

  async extractDocument(params) {
    return this._request('POST', '/internal/documents/extract', params);
  }

  async _request(method, endpoint, body = null, requireAuth = true) {
    const url = new URL(this.baseUrl + endpoint);
    const headers = {
      'Content-Type': 'application/json'
    };

    if (requireAuth) {
      headers['X-Internal-Secret'] = this.secret;
    }

    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: url.hostname,
          port: url.port || 5050,
          path: url.pathname + url.search,
          method,
          headers,
          timeout: 130000 // 130s to accommodate 120s Ollama timeout
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            let parsed = null;
            try {
              parsed = data ? JSON.parse(data) : {};
            } catch (err) {
              return reject(new Error(`Failed to parse AI service JSON response: ${data.slice(0, 100)}`));
            }

            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed);
            } else {
              const errorMsg = parsed.message || parsed.error || `AI service returned HTTP ${res.statusCode}`;
              const error = new Error(errorMsg);
              error.status = res.statusCode;
              error.details = parsed;
              reject(error);
            }
          });
        }
      );

      req.on('error', (err) => {
        reject(new Error(`AI service connection error at ${this.baseUrl}: ${err.message}`));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('AI service request timed out'));
      });

      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  }
}

export const aiClient = new AiClient();
