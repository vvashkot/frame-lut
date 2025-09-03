import axios, { AxiosInstance } from 'axios';
import { config, isS2SOAuthConfigured, isUserOAuthConfigured } from '../config.js';
import { frameioLogger as logger } from '../logger.js';
import { OAuthTokenResponse, OAuthTokenResponseSchema } from '../types/frameio.js';

interface TokenCache {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  tokenType: string;
}

export class FrameIOAuth {
  private static instance: FrameIOAuth;
  private tokenCache: Map<string, TokenCache> = new Map();
  private axiosInstance: AxiosInstance;

  private constructor() {
    this.axiosInstance = axios.create({
      baseURL: 'https://ims-na1.adobelogin.com',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
  }

  static getInstance(): FrameIOAuth {
    if (!FrameIOAuth.instance) {
      FrameIOAuth.instance = new FrameIOAuth();
    }
    return FrameIOAuth.instance;
  }

  /**
   * Get access token for user-delegated OAuth
   */
  async getUserAccessToken(userId: string, refreshToken?: string): Promise<string> {
    if (!isUserOAuthConfigured) {
      throw new Error('User OAuth is not configured');
    }

    const cacheKey = `user:${userId}`;
    const cached = this.tokenCache.get(cacheKey);

    // Check if cached token is still valid (with 5 minute buffer)
    if (cached && cached.expiresAt > new Date(Date.now() + 5 * 60 * 1000)) {
      logger.debug({ userId }, 'Using cached user access token');
      return cached.accessToken;
    }

    // Refresh the token
    if (refreshToken || cached?.refreshToken) {
      logger.info({ userId }, 'Refreshing user access token');
      const token = await this.refreshUserToken(refreshToken || cached?.refreshToken!);
      this.tokenCache.set(cacheKey, {
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresAt: new Date(Date.now() + token.expires_in * 1000),
        tokenType: token.token_type,
      });
      return token.access_token;
    }

    throw new Error('No refresh token available for user');
  }

  /**
   * Get access token for server-to-server OAuth
   */
  async getS2SAccessToken(): Promise<string> {
    if (!isS2SOAuthConfigured) {
      throw new Error('S2S OAuth is not configured');
    }

    const cacheKey = 's2s:default';
    const cached = this.tokenCache.get(cacheKey);

    // Check if cached token is still valid (with 5 minute buffer)
    if (cached && cached.expiresAt > new Date(Date.now() + 5 * 60 * 1000)) {
      logger.debug('Using cached S2S access token');
      return cached.accessToken;
    }

    logger.info('Fetching new S2S access token');
    const token = await this.fetchS2SToken();
    this.tokenCache.set(cacheKey, {
      accessToken: token.access_token,
      expiresAt: new Date(Date.now() + token.expires_in * 1000),
      tokenType: token.token_type,
    });
    return token.access_token;
  }

  /**
   * Exchange authorization code for tokens (user OAuth flow)
   */
  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<OAuthTokenResponse> {
    if (!isUserOAuthConfigured) {
      throw new Error('User OAuth is not configured');
    }

    try {
      const response = await this.axiosInstance.post(
        '/ims/token/v3',
        new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: config.FRAMEIO_CLIENT_ID!,
          client_secret: config.FRAMEIO_CLIENT_SECRET!,
          code,
          redirect_uri: redirectUri,
        }),
      );

      const validated = OAuthTokenResponseSchema.parse(response.data);
      logger.info('Successfully exchanged authorization code for tokens');
      return validated;
    } catch (error) {
      logger.error({ error }, 'Failed to exchange authorization code');
      throw error;
    }
  }

  /**
   * Refresh user access token
   */
  private async refreshUserToken(refreshToken: string): Promise<OAuthTokenResponse> {
    try {
      const response = await this.axiosInstance.post(
        '/ims/token/v3',
        new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: config.FRAMEIO_CLIENT_ID!,
          client_secret: config.FRAMEIO_CLIENT_SECRET!,
          refresh_token: refreshToken,
        }),
      );

      const validated = OAuthTokenResponseSchema.parse(response.data);
      logger.info('Successfully refreshed user access token');
      return validated;
    } catch (error) {
      logger.error({ error }, 'Failed to refresh user token');
      throw error;
    }
  }

  /**
   * Fetch S2S access token
   */
  private async fetchS2SToken(): Promise<OAuthTokenResponse> {
    try {
      const response = await this.axiosInstance.post(
        '/ims/token/v3',
        new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: config.FRAMEIO_S2S_CLIENT_ID!,
          client_secret: config.FRAMEIO_S2S_CLIENT_SECRET!,
          scope: 'additional_info.roles profile email',
        }),
      );

      const validated = OAuthTokenResponseSchema.parse(response.data);
      logger.info('Successfully fetched S2S access token');
      return validated;
    } catch (error) {
      logger.error({ error }, 'Failed to fetch S2S token');
      throw error;
    }
  }

  /**
   * Clear token cache for a specific user or all tokens
   */
  clearTokenCache(userId?: string): void {
    if (userId) {
      this.tokenCache.delete(`user:${userId}`);
      logger.info({ userId }, 'Cleared token cache for user');
    } else {
      this.tokenCache.clear();
      logger.info('Cleared all token cache');
    }
  }

  /**
   * Get authorization URL for user OAuth flow
   */
  getAuthorizationUrl(redirectUri: string, state: string): string {
    if (!isUserOAuthConfigured) {
      throw new Error('User OAuth is not configured');
    }

    const params = new URLSearchParams({
      client_id: config.FRAMEIO_CLIENT_ID!,
      redirect_uri: redirectUri,
      response_type: 'code',
      state,
      scope: 'additional_info.roles offline_access profile email openid',
    });

    return `https://ims-na1.adobelogin.com/ims/authorize/v2?${params.toString()}`;
  }

  /**
   * Validate if a token is still valid
   */
  isTokenValid(token: TokenCache): boolean {
    return token.expiresAt > new Date(Date.now() + 5 * 60 * 1000);
  }

  /**
   * Get the appropriate access token based on configuration
   */
  async getAccessToken(userId?: string, refreshToken?: string): Promise<string> {
    // Prefer user token if available
    if (userId && refreshToken && isUserOAuthConfigured) {
      return this.getUserAccessToken(userId, refreshToken);
    }

    // Try to load token from file if no user token provided
    if (!userId && !refreshToken) {
      try {
        const fs = await import('fs/promises');
        const tokenData = await fs.readFile('.frameio-token', 'utf-8');
        const stored = JSON.parse(tokenData);
        
        // Check if token is still valid
        if (stored.access_token && stored.expires_at > Date.now()) {
          logger.info('Using access token from .frameio-token file');
          return stored.access_token;
        }
        
        // Try to refresh if we have a refresh token
        if (stored.refresh_token && isUserOAuthConfigured) {
          logger.info('Refreshing expired token from .frameio-token file');
          const newToken = await this.refreshUserToken(stored.refresh_token);
          
          // Save the new token
          await fs.writeFile('.frameio-token', JSON.stringify({
            access_token: newToken.access_token,
            refresh_token: newToken.refresh_token || stored.refresh_token,
            expires_in: newToken.expires_in,
            expires_at: Date.now() + (newToken.expires_in * 1000),
            created_at: new Date().toISOString(),
          }, null, 2));
          
          return newToken.access_token;
        }
      } catch (error) {
        logger.debug({ error }, 'Could not load token from .frameio-token file');
      }
    }

    // Fall back to S2S token
    if (isS2SOAuthConfigured) {
      return this.getS2SAccessToken();
    }

    throw new Error('No valid OAuth configuration available. Please authenticate first by running: npm run frameio:info');
  }
}

export const frameioAuth = FrameIOAuth.getInstance();