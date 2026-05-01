import type { AxiosResponse } from 'axios';
import axios from 'axios';

import type {
  AuthPayload,
  AuthResponse,
  BotDescriptors,
  AuthStorage,
  AuthStorageMulti,
  BotDescriptor,
} from '@/types';

const AUTH_LOGIN_INFO = 'ftAuthLoginInfo';
const APIBASE = '/api/v1';

// Global state for all login infos
const allLoginInfos = useStorage<AuthStorageMulti>(AUTH_LOGIN_INFO, {});

/**
 * Get available bots with their descriptors
 */
export const loggedInBots = computed<BotDescriptors>(() => {
  const allInfo = allLoginInfos.value;
  const response: BotDescriptors = {};
  Object.keys(allInfo)
    .sort((a, b) => (allInfo[a]?.sortId ?? 0) - (allInfo[b]?.sortId ?? 0))
    .forEach((k, idx) => {
      const bot = allInfo[k];
      if (!bot) return;
      response[k] = {
        botId: k,
        botName: bot.botName,
        botUrl: bot.apiUrl,
        sortId: bot.sortId ?? idx,
      };
    });

  return response;
});

export function useLoginInfo(botId: string) {
  // console.log('botId', botId);

  const currentInfo = computed({
    get: () => allLoginInfos.value[botId]!,
    set: (val) => (allLoginInfos.value[botId] = val),
  });

  const autoRefresh = computed({
    get: () => currentInfo.value.autoRefresh,
    set: (val) => (currentInfo.value.autoRefresh = val),
  });
  const accessToken = computed(() => currentInfo.value.accessToken);

  const baseUrl = computed<string>(() => {
    const baseURL = currentInfo.value.apiUrl;
    if (baseURL === null) {
      return APIBASE;
    }
    if (!baseURL.endsWith(APIBASE)) {
      return `${baseURL}${APIBASE}`;
    }
    return `${baseURL}${APIBASE}`;
  });

  const baseWsUrl = computed<string>(() => {
    const baseURL = baseUrl.value;
    if (baseURL.startsWith('http://')) {
      return baseURL.replace('http://', 'ws://');
    }
    if (baseURL.startsWith('https://')) {
      return baseURL.replace('https://', 'wss://');
    }
    return '';
  });

  /**
   * Get login info for current bot
   */
  function getLoginInfo(): AuthStorage {
    const allLoginBot = allLoginInfos.value[botId];
    if (allLoginBot && 'apiUrl' in allLoginBot && 'refreshToken' in allLoginBot) {
      return allLoginBot;
    }
    return {
      botName: '',
      apiUrl: '',
      username: '',
      refreshToken: '',
      accessToken: '',
      autoRefresh: false,
    };
  }

  function updateBot(newValues: Partial<BotDescriptor>): void {
    Object.assign(currentInfo.value, newValues);
  }

  function setRefreshTokenExpired(): void {
    currentInfo.value.refreshToken = '';
    currentInfo.value.accessToken = '';
  }

  function logout(): void {
    console.log('Logging out');
    delete allLoginInfos.value[botId];
  }

  async function loginCall(auth: AuthPayload): Promise<AuthStorage> {
    const cfHeaders: Record<string, string> = {};
    const cfClientId = import.meta.env.VITE_CF_ACCESS_CLIENT_ID;
    const cfClientSecret = import.meta.env.VITE_CF_ACCESS_CLIENT_SECRET;
    if (cfClientId) cfHeaders['CF-Access-Client-Id'] = cfClientId;
    if (cfClientSecret) cfHeaders['CF-Access-Client-Secret'] = cfClientSecret;

    const { data } = await axios.post<Record<string, never>, AxiosResponse<AuthResponse>>(
      `${auth.url}/api/v1/token/login`,
      {},
      {
        auth: { ...auth },
        headers: cfHeaders,
      },
    );
    if (data.access_token && data.refresh_token) {
      const obj: AuthStorage = {
        botName: auth.botName,
        apiUrl: auth.url,
        username: auth.username,
        accessToken: data.access_token || '',
        refreshToken: data.refresh_token || '',
        autoRefresh: true,
      };
      return Promise.resolve(obj);
    }
    return Promise.reject('login failed');
  }

  async function login(auth: AuthPayload) {
    const loginInfo = await loginCall(auth);
    currentInfo.value = loginInfo;
  }

  // Holds the in-flight refresh promise to deduplicate concurrent 401s
  let refreshTokenPromise: Promise<string> | null = null;

  function refreshToken(): Promise<string> {
    // If a refresh is already in progress, return the same promise instead of firing another request
    if (refreshTokenPromise) {
      // console.log('Token refresh already in progress, reusing existing promise...');
      return refreshTokenPromise;
    }

    // console.log('Refreshing token...');
    const token = currentInfo.value.refreshToken;
    refreshTokenPromise = new Promise((resolve, reject) => {
      axios
        .post<Record<string, never>, AxiosResponse<AuthResponse>>(
          `${currentInfo.value.apiUrl}${APIBASE}/token/refresh`,
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
              ...(import.meta.env.VITE_CF_ACCESS_CLIENT_ID && {
                'CF-Access-Client-Id': import.meta.env.VITE_CF_ACCESS_CLIENT_ID,
              }),
              ...(import.meta.env.VITE_CF_ACCESS_CLIENT_SECRET && {
                'CF-Access-Client-Secret': import.meta.env.VITE_CF_ACCESS_CLIENT_SECRET,
              }),
            },
          },
        )
        .then((response) => {
          if (response.data.access_token) {
            currentInfo.value.accessToken = response.data.access_token;
            resolve(response.data.access_token);
          } else {
            // Reject explicitly so the promise does not hang indefinitely
            reject(new Error('No access token received in refresh response'));
          }
        })
        .catch((err) => {
          console.error(err);
          if (err.response && err.response.status === 401) {
            console.log('Refresh token expired or invalid.');
            setRefreshTokenExpired();
          } else if (err.response && (err.response.status === 500 || err.response.status === 404)) {
            console.log('Bot seems to be offline... - retrying later');
          }
          reject(err);
        })
        .finally(() => {
          // Always reset so the next call can start a fresh refresh
          refreshTokenPromise = null;
        });
    });

    return refreshTokenPromise;
  }

  return {
    updateBot,
    getLoginInfo,
    autoRefresh,
    accessToken,
    logout,
    login,
    refreshToken,
    baseUrl,
    baseWsUrl,
  };
}
