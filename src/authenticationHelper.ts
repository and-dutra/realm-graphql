import { setTimeout } from 'timers';
import * as URI from 'urijs';
import { Credentials } from './credentials';
import { User } from './user';

interface AccessToken {
  token: string;
  expires: Date;
}

export class AuthenticationHelper {
  public static async authenticate(server: string, credentials: Credentials): Promise<User> {
    const authUri = new URI(server).path('/auth');
    if (authUri.scheme() !== 'http' && authUri.scheme() !== 'https') {
      throw new Error(`The server scheme must be 'http(s)'. Got: ${authUri.scheme()} `);
    }

    (credentials as any).app_id = '';
    const options = {
      method: 'POST',
      body: JSON.stringify(credentials),
      headers: AuthenticationHelper.postHeaders,
      open_timeout: 5000
    };

    const response = await AuthenticationHelper.performFetch(authUri.toString(), options);
    const body = await response.json();
    if (response.status !== 200) {
      throw {
        name: 'AuthError',
        status: response.status,
        statusText: response.statusText,
        body
      };
    } else {
      return {
        identity: body.refresh_token.token_data.identity,
        isAdmin: body.refresh_token.token_data.is_admin,
        server,
        token: body.refresh_token.token
      };
    }
  }

  public static async refreshAccessToken(user: User, realmPath: string) {
    if (!user.server) {
      throw new Error('Server for user must be specified');
    }

    const options = {
      method: 'POST',
      body: JSON.stringify({
        data: user.token,
        path: realmPath,
        provider: 'realm',
        app_id: ''
      }),
      headers: AuthenticationHelper.postHeaders,
      // FIXME: This timeout appears to be necessary in order for some requests to be sent at all.
      // See https://github.com/realm/realm-js-private/issues/338 for details.
      timeout: 1000.0
    };

    const authUri = new URI(user.server).path('/auth');

    const response = await AuthenticationHelper.performFetch(authUri, options);
    const body = await response.json();

    if (response.status !== 200) {
      throw {
        name: 'AuthError',
        status: response.status,
        statusText: response.statusText,
        body
      };
    }

    return {
      token: body.access_token.token,
      expires: new Date(body.access_token.token_data.expires * 1000)
    };
  }

  private static requireMethod = require;
  private static performFetch = typeof fetch === 'undefined' ? AuthenticationHelper.nodeRequire('node-fetch') : fetch;
  private static postHeaders = {
    'content-type': 'application/json;charset=utf-8',
    'accept': 'application/json'
  };

  private static nodeRequire(module) {
    return AuthenticationHelper.requireMethod(module);
  }
}
