/*
 Copyright 2022 Google LLC
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

     https://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
*/

export interface PendingPostBeaconOpts {
  /**
   * Amount of time (in milliseconds) after which the beacon will be sent,
   * even if the page has not been unloaded.
   *
   * This option is useful for pages that want to batch all data into a single
   * beacon within a given time frame. This strikes a balance between
   * ensuring data is somewhat "real-time", while still minimizing the total
   * number of beacons sent and ensuring any pending data is still reliably
   * sent when the page is unloaded.
   *
   * Note: this option has limited support in the polyfill. See "Limitations
   * of the polyfill" in the README for more details.
   */
  timeout?: number;

  /**
   * The amount of time (in milliseconds) after a page has been backgrounded
   * (i.e. its `visibilityState` is "hidden") when the beacon will be
   * automatically sent.
   *
   * This option is useful for pages that the user is likely to keep open for
   * days or even weeks at a time without closing, and where you want to treat
   * the user backgrounding the page as an end-of-session signal while also
   * minimizing false negatives from cases where a user switches tabs and then
   * quickly switches back.
   *
   * A background timeout of a few seconds to a few minutes will help strike
   * a good balance between these cases, and it still offers the reliability
   * that the data will be sent if the page is unloaded while in the
   * background.
   *
   * Note: this options is not supported at all in the polyfill. See
   * "Limitations of the polyfill" in the README for more details.
   */
  backgroundTimeout?: number;
}

interface PendingPostBeaconPrototype {
  /**
   * Return the URL the instance was created with.
   */
  readonly url: string;

  /**
   * Returns the send method of the beacon.
   * This is always "POST" for `PendingPostBeacon` instances.
   */
  readonly method: string;

  /**
   * Returns `true` if the beacon has not been sent (or deactivated),
   * `false` otherwise.
   */
  readonly pending: boolean;

  /**
   * Accepts any `data` value that can be used with
   * `navigator.sendBeacon(url, data)`. The `data` value is stored internally
   * and used as the beacon payload whenever it is sent.
   *
   * Calling this method multiple times will overwrite the previously-stored
   * `data` value.
   */
  setData(data: BodyInit): void;

  /**
   * Sends the beacon (along with the currently-stored `data` payload)
   * immediately.
   */
  sendNow(): void;

  /**
   * Prevents the beacon from ever being sent. Clears any pending timers as
   * well as any stored `data`.
   */
  deactivate(): void;
}

interface PendingPostBeacon extends PendingPostBeaconPrototype {
  /**
   * Creates a new `PendingPostBeacon` instance.
   * See `PendingPostBeaconOpts` for more details.
   */
  new (url: string, opts?: PendingPostBeaconOpts): PendingPostBeacon;
}

declare global {
  var PendingPostBeacon: PendingPostBeacon;
}

export var PendingPostBeacon =
  globalThis.PendingPostBeacon ||
  (function (url: string, opts: PendingPostBeaconOpts) {
    let _pending = true;
    let _timeoutHandle: ReturnType<typeof setTimeout>;
    let _data: BodyInit | undefined | null;

    const _beacon: PendingPostBeaconPrototype = {
      get url() {
        return url;
      },
      get method() {
        return 'POST';
      },
      get pending() {
        return _pending;
      },
      sendNow() {
        if (
          _pending &&
          navigator.sendBeacon &&
          navigator.sendBeacon(url, _data)
        ) {
          _beacon.deactivate();
        }
      },
      setData(data) {
        _data = data;
      },
      deactivate() {
        document.removeEventListener('visibilitychange', _beacon.sendNow);
        clearTimeout(_timeoutHandle);
        _pending = false;
        _data = null;
      },
    };

    if (document.visibilityState === 'hidden') {
      // If the beacon was created while the page is already hidden, send data
      // ASAP but wait until the next microtask to allow all sync code to run.
      Promise.resolve().then(_beacon.sendNow);
    } else {
      document.addEventListener('visibilitychange', _beacon.sendNow);

      if (opts && (opts.timeout as number) > -1) {
        _timeoutHandle = setTimeout(_beacon.sendNow, opts.timeout);
      }
    }

    return _beacon;
  } as unknown as PendingPostBeacon);
