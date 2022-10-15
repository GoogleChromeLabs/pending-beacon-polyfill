# Pending Beacon Polyfill

- [Overview](#overview)
- [Background](#background)
  - [Why a polyfill?](#why-a-polyfill)
- [Installation and usage](#installation-and-usage)
- [API](#api)
  - [`PendingPostBeacon`](#pendingpostbeacon)
  - [`PendingPostBeaconOpts`](#pendingpostbeaconopts)
- [How the polyfill works](#how-the-polyfill-works)
- [Limitations of the polyfill](#limitations-of-the-polyfill)
- [Usage examples](#usage-examples)
  - [Basic usage](#basic-usage)
  - [Use with the `web-vitals` JS library](#use-with-the-web-vitals-js-library)
  - [Using the `timeout` options](#using-the-timeout-option)
- [Browser Support](#browser-support)
- [License](#license)

## Overview

A tiny polyfill (~250 bytes, brotli-d) for the experimental [Pending Beacon API](https://wicg.github.io/pending-beacon/). The goal of this new API is to make it significantly more reliable for sites to send data (i.e. ["beacons"](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon)) to a web server as a page is unloading.

**Important!** This API is in [Origin Trial](https://developer.chrome.com/origintrials/#/view_trial/1581889369113886721) in Chrome between version 107 and 109 (Oct. 25, 2022 – Mar. 9, 2023). Be aware that this API may change before ultimately shipping in browsers.

## Background

It's currently very difficult for web developers to reliably send data from a web page to a server **at the very end of a user visit.** Even with APIs like [navigator.sendBeacon()](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon) (that were specifically designed for this purpose), and even when following [all best practices](https://developer.chrome.com/blog/page-lifecycle-api/#developer-recommendations-for-each-state), you should still expect [5%-10% beacon loss](https://calendar.perfplanet.com/2020/beaconing-in-practice/#user-content-reliability).

Due to the current reliability challenges, developers often send data eagerly rather than in batches at the end of a page visit. The result is that more beacons are sent than necessary, which is wasteful to both users' network resources as well as developer server resources.

There are three primary reasons that beaconing is unreliable in browsers today:

1. **Performing the fetch is unreliable:** one thing all current beaconing APIs have in common is they're run in the tab's renderer process and not in the browser process. So once the tab's renderer process is gone, it's too late to send anything.
2. **Page-unload events are unreliable:** mobile browsers [do not fire page-unload events](https://developer.chrome.com/blog/page-lifecycle-api/#advice-hidden) in many situations where a user is leaving a page. The most reliable event available is `visibilitychange`, but that does not always correspond to the end of a user's visit.
3. **Developers are not aware that #1 and #2 are unreliable:** while some unreliability is expected due to #1 and #2, what makes matters worse is that these issues are not widely known. The result is developers frequently try to send data at times that are known to be unreliable (e.g. the `unload` event)—resulting in even greater beacon loss.

The [Pending Beacon API](https://wicg.github.io/pending-beacon/) was created to address all three of these issues.

### Why a polyfill?

While a polyfill cannot magically solve issues #1 and #2 outlined above, it *can* address issue #3 by codifying best practices in the polyfill itself.

When using the polyfill with the [Origin Trial](https://developer.chrome.com/origintrials/#/view_trial/1581889369113886721), the result should be significantly increased reliability in Chrome (via the native implementation) and slightly increased reliability in other browsers as well (due to codifying best practices in the polyfill itself).

In the worst case, the reliability in other browsers should be the same as it was without the polyfill.

Lastly, the polyfill should also make it easier for developers to try out the new API via the Origin Trial, since using the polyfill means developers won't have to maintain two different versions of their beaconing logic.

## Installation and usage

This polyfill can be install via npm by running the following command:

```sh
npm install --save-dev pending-beacon-polyfill
```

To use the library, import the `PendingPostBeacon` class, which will be either a reference to the native implementation (in supported browsers) or the polyfill version:


```js
import {PendingPostBeacon} from 'pending-beacon-polyfill';

// Create a beacon instance that will send data to the `/analytics`
// endpoint automatically when the current page is unloaded.
new PendingPostBeacon('/analytics').setData('my data...');
```

_Note: the above is a very simplified example. See [usage examples](#usage-examples) for more realistic examples._

Lastly, in order for the native version of the API to work, you have to [register your site for the Origin Trial](https://developer.chrome.com/origintrials/#/view_trial/1581889369113886721) and add the token to your pages:

You can add the token either via a meta tag:

```html
<meta http-equiv="origin-trial" content="TOKEN_GOES_HERE">
```

or an HTTP header:

```http
Origin-Trial: TOKEN_GOES_HERE
```

## API

### `PendingPostBeacon`

```ts
interface PendingPostBeacon {
  /**
   * Creates a new `PendingPostBeacon` instance.
   * See `PendingPostBeaconOpts` for more details.
   */
  new (url: string, opts?: PendingPostBeaconOpts): PendingPostBeacon;

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
```

### `PendingPostBeaconOpts`

```ts
interface PendingPostBeaconOpts {
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
   * Note: this option is not supported at all in the polyfill. See
   * "Limitations of the polyfill" in the README for more details.
   */
  backgroundTimeout?: number;
}
```

## How the polyfill works

The polyfill works by leveraging the [`navigator.sendBeacon()`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon) API, which is [supported](https://caniuse.com/beacon) in all modern browsers.

When a `PendingPostBeacon` instance is created, the polyfill registers a `visibilitychange` event listener that will send the beacon's current payload, whenever the page's visibility state changes to "hidden", which happens whenever a user backgrounds a tab, closes a tab, or navigates to a new page.

Note that with the polyfill **the data MUST be sent when the page's visibility state changes to hidden**, since there are [no guarantees](https://developer.chrome.com/blog/page-lifecycle-api/#advice-hidden) that the user will ever return to the page, and APIs like timeouts are not reliable when a tab is in the background.

If the user _does_ return to the page after previously backgrounding it, a new beacon will need to be created (since the previous one will have already been sent). As a result, the following best practices should always be followed:

* Always send a unique identifier for the current page along with your beacon payload, so multiple beacons sent from the same page can be merged or deduped on the server.
* Ensure your back-end systems are configured to handle multiple beacons received from the same page.

Note that none of these best practices are new with this API or polyfill, they have always been required on the web. If your existing analytics system is not currently following them, then you are most likely losing data.

However, in browsers that natively support the Pending Beacon API, beacons will not be sent on `visibilitychange` unless the user is always unloading the page. In these browsers you should expect to receive only one beacon per page (unless using one of the timeout options).

## Limitations of the polyfill

### Only works in browsers that support `navigator.sendBeacon()`

The primary use case for the Pending Beacon API is to defer sending any data to a server until the user leaves the page. This allows you to have the full visit context before sending data; it also allows you to minimize the number of beacons you send as well as the amount of data you send.

The only way to do this in browsers today is via `navigator.sendBeacon()`, which is [supported in all modern browsers](https://caniuse.com/beacon).

If you need to support legacy browsers, such as Internet Explorer, you will need to send data eagerly, as there are no APIs available to send data as the user is leaving the page (without hacks that significantly degrade performance).

_Note: another API that can be used to send data as the page is unloading is `fetch()` with the `keepalive` flag. However, this is supported in [even fewer browsers](https://caniuse.com/mdn-api_request_keepalive) and is thus not a good candidate for a polyfill._

### The `backgroundTimeout` options is ignored

The `backgroundTimeout` option is ignored and not supported by this polyfill because it would not be reliable in browsers. Browsers throttle timers when the tab is in the background, which means the user could close the tab (or the browser itself) before the timer callback has had a chance to run.

Despite this limitation, developers can (and perhaps should) still use the `backgroundTimeout` option, because it will work as expected in browsers that natively support this API.

### The `timeout` options is only partially supported

Similar to the limitations of the `backgroundTimeout` option, the `timeout` option cannot be reliably polyfilled for time when the page is in the background. Any beacons with pending timeouts will have their payloads sent immediately if the page's visibility state changes to hidden.

## Usage Examples

### Basic usage

The following code shows a simple way to measure a user's "time on page".

```js
import {PendingPostBeacon} from 'pending-beacon-polyfill';

// Define a single beacon reference.
let beacon;

// Create a unique ID for this page, so multiple beacons received
// from the same page can be de-duped on the server.
let pageId = crypto.randomUUID();

// Update the time on page value every minute. When the user leaves
// the page, the most recently-updated value will be sent.
setInterval(() => {
  // Create a new beacon if one does not yet exist or if it's has
  // already been sent.
  if (!beacon?.pending) {
    beacon = new PendingPostBeacon('/analytics');
  }

  // Set the current page time as well as the page ID on the beacon.
  // When the user leaves the page, the last set value will be sent.
  beacon.setData(JSON.stringify({
    timeOnPage: performance.now(),
    pageId: pageId,
  }));
}, 1000 * 60);
```

**Important!** The `pageId` variable above is necessary because, for browsers running the polyfill, it's possible that more than one beacon will be sent per page, and your analytics system will need a way to dedupe them on the server. See [how the polyfill works](#how-the-polyfill-works) for more details.

### Use with the `web-vitals` JS library

The following code examples show how this polyfill could be used with the [web-vitals](https://github.com/GoogleChrome/web-vitals) JS library to report Core Web Vitals metrics data to an analytics endpoint:

```js
import {PendingPostBeacon} from 'pending-beacon-polyfill';
import {onLCP, onFID, onCLS} from 'web-vitals';

const metrics = new Set();
let beacon;

function updateBeacon(metric) {
  // If the beacon does not exist or has already been sent (e.g. it's no longer
  // pending), create a new beacon and clear the list of metrics to send.
  if (!beacon?.pending) {
    beacon = new PendingPostBeacon('/analytics');
    metrics.clear();
  }

  // Add the metrics to the list (if not already present), then update the
  // beacon payload with the serialized metric data from the list.

  metrics.add(metric);
  beacon.setData(JSON.stringify([...metrics]));
}

onLCP(updateBeacon);
onFID(updateBeacon);
onCLS(updateBeacon);
```

With the above code, browsers that support the native API will not send any data to the `/analytics` endpoint until the user unloads the page (either by navigating away or closing the tab or browser app).

Browsers running the polyfill (i.e. that do not support the native API) will send data any time the page's `visibilityState` changes to "hidden" (and the value of any of the metrics has changed since the previous send).

Note that the above code does not use a `pageId` variable, like in the first example. This is because [`Metric`](https://github.com/GoogleChrome/web-vitals#metric) objects in the `web-vitals` library already contain a unique `id` property that can be used to dedupe multiple beacons.

### Using the `timeout` option

Building on the previous example, if you want to send data that is more "real-time" yet still batches multiple metrics together to minimize the total number of beacons sent, you can use the `timeout` options.

```js
// ...

function updateBeacon(metric) {
  // If the beacon does not exist or has already been sent (e.g. it's no longer
  // pending), create a new beacon and clear the list of metrics to send.
  if (!beacon?.pending) {
    beacon = new PendingPostBeacon('/analytics-endpoint', {
      timeout: 10 * 1000, // 10 seconds
    });

    metrics.clear();
  }

  // Add the metrics to the list (if not already present), then update the
  // beacon payload with the serialized metric data from the list.

  metrics.add(metric);
  beacon.setData(JSON.stringify([...metrics]));
}

// ...
```

Note that when using a timeout, nothing else about the above logic needs to change. Since the code always checks whether or not the beacon is pending before making any updates, it doesn't matter how frequently the beacon gets sent. This makes writing code with this API very flexible.

## Browser support

![Chrome][1] | ![Safari][2]| ![Firefox][3]| ![Edge][4]| ![Samsung Internet][5]| ![Opera][6]| ![Internet Explorer][7]
---   | ---     | ---   | ---   | ---  | ---   | ---
39+ ✔ | 11.1+ ✔ | 31+ ✔ | 14+ ✔ | 4+ ✔ | 26+ ✔ | (None) ✖️

[1]: <https://raw.githubusercontent.com/alrra/browser-logos/main/src/chrome/chrome_48x48.png>
[2]: <https://raw.githubusercontent.com/alrra/browser-logos/main/src/safari/safari_48x48.png>
[3]: <https://raw.githubusercontent.com/alrra/browser-logos/main/src/firefox/firefox_48x48.png>
[4]: <https://raw.githubusercontent.com/alrra/browser-logos/main/src/edge/edge_48x48.png>
[5]: <https://raw.githubusercontent.com/alrra/browser-logos/main/src/samsung-internet/samsung-internet_48x48.png>
[6]: <https://raw.githubusercontent.com/alrra/browser-logos/main/src/opera/opera_48x48.png>
[7]: <https://raw.githubusercontent.com/alrra/browser-logos/main/src/archive/internet-explorer_9-11/internet-explorer_9-11_48x48.png>

See [Limitations of the polyfill](#limitations-of-the-polyfill) for details.

## License

[Apache 2.0](/LICENSE)
