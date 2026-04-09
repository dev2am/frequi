import type { AxiosHeaders } from 'axios';
import axios from 'axios';

type UserServiceType = ReturnType<typeof useLoginInfo>;

export function useApi(userService: UserServiceType, botId: string) {
  const api = axios.create({
    baseURL: userService.baseUrl.value,
    timeout: 20000,
    withCredentials: true,
  });
  // Sent auth headers interceptor
  api.interceptors.request.use(
    (request) => {
      const token = userService.accessToken.value;
      try {
        request.headers = request.headers as AxiosHeaders;
        if (token) {
          // Append token to each request
          request.headers.set('Authorization', `Bearer ${token}`);
        }
        const cfClientId = import.meta.env.VITE_CF_ACCESS_CLIENT_ID;
        const cfClientSecret = import.meta.env.VITE_CF_ACCESS_CLIENT_SECRET;
        if (cfClientId) {
          request.headers.set('CF-Access-Client-Id', cfClientId);
        }
        if (cfClientSecret) {
          request.headers.set('CF-Access-Client-Secret', cfClientSecret);
        }
        console.log(`[api][${botId}] ${request.method?.toUpperCase()} ${request.url} | CF-Id: ${cfClientId ? cfClientId.slice(0, 8) + '...' : 'MISSING'} | Auth: ${token ? 'Bearer ***' : 'MISSING'}`);
      } catch (e) {
        console.log(e);
      }
      return request;
    },
    (error) => Promise.reject(error),
  );

  api.interceptors.response.use(
    (response) => response,
    (err) => {
      if (err.response && err.response.status === 401) {
        // Attempt to refresh the access token, then retry the original request.
        // .then() only runs on success; .catch() only runs on failure — no cross-contamination.
        return userService
          .refreshToken()
          .then((token) => {
            const { config } = err;
            config.headers.Authorization = `Bearer ${token}`;
            // Re-attach CF headers since global axios bypasses the request interceptor
            const cfClientId = import.meta.env.VITE_CF_ACCESS_CLIENT_ID;
            const cfClientSecret = import.meta.env.VITE_CF_ACCESS_CLIENT_SECRET;
            if (cfClientId) config.headers['CF-Access-Client-Id'] = cfClientId;
            if (cfClientSecret) config.headers['CF-Access-Client-Secret'] = cfClientSecret;
            // Use global axios to avoid re-triggering this interceptor on the retry
            return axios.request(config);
          })
          .catch((error) => {
            console.log('Token refresh failed, marking bot as offline.');
            console.log(error);
            const botStore = useBotStore();
            if (botStore.botStores[botId]) {
              botStore.botStores[botId].setIsBotOnline(false);
              botStore.botStores[botId].isBotLoggedIn = false;
            }
            return Promise.reject(error);
          });

        // maybe redirect to /login if needed !
      }
      if ((err.response && err.response.status === 500) || err.message === 'Network Error') {
        console.log('Bot not running...');
        const botStore = useBotStore();
        botStore.botStores[botId]?.setIsBotOnline(false);
      }

      return Promise.reject(err);
    },
  );

  return {
    api,
  };
}
