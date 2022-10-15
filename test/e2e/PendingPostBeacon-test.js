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

import assert from 'node:assert/strict';
import {beaconCountIs, clearBeacons, getBeacons} from '../utils/beacons.js';
import {stubVisibilityChange} from '../utils/stubVisibilityChange.js';

describe('PendingPostBeacon', async function () {
  // Retry all tests in this suite up to 2 times.
  this.retries(2);

  beforeEach(async function () {
    await clearBeacons();
  });

  it('passes all unit tests', async function () {
    await browser.url('/test/unit');

    await browser.waitUntil(async () => {
      const results = await browser.execute(() => self.mochaResults);
      if (results) {
        assert.equal(results.failures, 0);
      }
      return results;
    });
  });

  it('send the beacon when the page is unloaded', async function () {
    await browser.url('/test/beacon');

    await browser.executeAsync((done) => {
      import('/dist/PendingPostBeacon.js').then(({PendingPostBeacon}) => {
        const beacon = new PendingPostBeacon('/collect');

        beacon.setData(
          JSON.stringify({
            test: 'unload',
          })
        );

        done();
      });
    });

    const link = await $('a[href]');
    await link.click();

    await beaconCountIs(1);

    const [beacon] = await getBeacons();
    assert.equal(beacon.test, 'unload');
  });

  it('send the beacon when the page is hidden', async function () {
    await browser.url('/test/beacon');

    await browser.executeAsync((done) => {
      import('/dist/PendingPostBeacon.js').then(({PendingPostBeacon}) => {
        const beacon = new PendingPostBeacon('/collect');

        beacon.setData(
          JSON.stringify({
            test: 'hidden',
          })
        );

        done();
      });
    });

    await stubVisibilityChange('hidden');

    await beaconCountIs(1);

    const [beacon] = await getBeacons();
    assert.equal(beacon.test, 'hidden');
  });

  it('send the beacon after the timeout has elapsed', async function () {
    await browser.url('/test/beacon');

    const startTime = Date.now();

    await browser.executeAsync((done) => {
      import('/dist/PendingPostBeacon.js').then(({PendingPostBeacon}) => {
        const beacon = new PendingPostBeacon('/collect', {timeout: 2000});

        beacon.setData(
          JSON.stringify({
            test: 'timeout',
          })
        );

        done();
      });
    });

    // There should be no beacons before the timeout has elapsed.
    const beacons = await getBeacons();
    assert.equal(beacons.length, 0);

    await beaconCountIs(1);

    const endTime = Date.now();

    const [beacon] = await getBeacons();
    assert.equal(beacon.test, 'timeout');

    console.log(endTime - startTime);
    assert(endTime - startTime >= 1000);
  });

  it('send the beacon on hidden even if the timeout has not elapsed', async function () {
    await browser.url('/test/beacon');

    const startTime = Date.now();

    await browser.executeAsync((done) => {
      import('/dist/PendingPostBeacon.js').then(({PendingPostBeacon}) => {
        const beacon = new PendingPostBeacon('/collect', {timeout: 60000});

        beacon.setData(
          JSON.stringify({
            test: 'timeout+hidden',
          })
        );

        done();
      });
    });

    await stubVisibilityChange('hidden');

    await beaconCountIs(1);

    const endTime = Date.now();

    const [beacon] = await getBeacons();
    assert.equal(beacon.test, 'timeout+hidden');

    console.log(endTime - startTime);
    assert(endTime - startTime < 60000);
  });

  it('sends the beacon immediately if created while the page is hidden', async function () {
    await browser.url('/test/beacon');

    await stubVisibilityChange('hidden');

    await browser.executeAsync((done) => {
      import('/dist/PendingPostBeacon.js').then(({PendingPostBeacon}) => {
        const beacon = new PendingPostBeacon('/collect');

        beacon.setData(
          JSON.stringify({
            test: 'hidden-when-created',
          })
        );

        done();
      });
    });

    await beaconCountIs(1);

    const [beacon] = await getBeacons();
    assert.equal(beacon.test, 'hidden-when-created');
  });

  it('send the beacon even if the beacon is created as the page is unloading', async function () {
    await browser.url('/test/beacon');

    await browser.executeAsync((done) => {
      import('/dist/PendingPostBeacon.js').then(({PendingPostBeacon}) => {
        document.addEventListener('visibilitychange', () => {
          new PendingPostBeacon('/collect').setData(
            JSON.stringify({
              test: 'page-unloading',
            })
          );
        });
      });

      done();
    });

    const link = await $('a[href]');
    await link.click();

    await beaconCountIs(1);

    const [beacon] = await getBeacons();
    assert.equal(beacon.test, 'page-unloading');
  });
});
