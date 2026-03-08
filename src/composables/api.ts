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
      // console.log(err);
      if (err.response && err.response.status === 401) {
        return userService
          .refreshToken()
          .catch((error) => {
            console.log('No new token received');
            console.log(error);
            const botStore = useBotStore();
            if (botStore.botStores[botId]) {
              botStore.botStores[botId].setIsBotOnline(false);
              botStore.botStores[botId].isBotLoggedIn = false;
            }
          })
          .then((token) => {
            // Retry original request with new token
            const { config } = err;
            config.headers.Authorization = `Bearer ${token}`;

            return new Promise((resolve, reject) => {
              axios
                .request(config)
                .then((response) => {
                  resolve(response);
                })
                .catch((error) => {
                  reject(error);
                });
            });
          })
          .catch((error) => {
            console.log(error);
          });

        // maybe redirect to /login if needed !
      }
      if ((err.response && err.response.status === 500) || err.message === 'Network Error') {
        console.log('Bot not running...');
        const botStore = useBotStore();
        botStore.botStores[botId]?.setIsBotOnline(false);
      }

      return new Promise((resolve, reject) => {
        reject(err);
      });
    },
  );

  return {
    api,
  };
}
