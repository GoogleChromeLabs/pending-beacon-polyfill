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

import sinon from '/node_modules/sinon/pkg/sinon-esm.js';

/**
 * An async version of setTimeout.
 * @param {number} ms
 * @return {Promise<void>}
 */
function timeout(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

describe('PendingPostBeacon', function () {
  let PendingPostBeacon;
  let isNative;

  before(async function () {
    const mod = await import('/dist/PendingPostBeacon.js');
    PendingPostBeacon = mod.PendingPostBeacon;
    isNative = /native code/.test(PendingPostBeacon.toString());
  });

  beforeEach(function () {
    if (isNative) {
      return this.skip();
    }
    sinon.stub(navigator, 'sendBeacon').returns(true);
  });

  afterEach(function () {
    if (!isNative) {
      navigator.sendBeacon.restore();
    }
  });

  describe('url', function () {
    it('returns the URL passed at instantiation', function () {
      const beacon = new PendingPostBeacon('/collect');
      expect(beacon.url).to.equal('/collect');
    });
  });

  describe('method', function () {
    it('returns "POST"', function () {
      const beacon = new PendingPostBeacon('/collect');
      expect(beacon.method).to.equal('POST');
    });
  });

  describe('pending', function () {
    it('returns true if the payload has not been sent', function () {
      const beacon = new PendingPostBeacon('/collect');
      expect(beacon.pending).to.equal(true);
    });

    it('returns true if the payload has been manually sent', function () {
      const beacon = new PendingPostBeacon('/collect');
      expect(beacon.pending).to.equal(true);

      beacon.sendNow();

      expect(beacon.pending).to.equal(false);
    });

    it('returns true if the payload has been automatically sent via timeout', async function () {
      const beacon = new PendingPostBeacon('/collect', {timeout: 0});
      expect(beacon.pending).to.equal(true);

      await timeout(0);

      expect(beacon.pending).to.equal(false);
    });

    it('returns true if the payload has been automatically sent due to visibilitychange', async function () {
      const beacon = new PendingPostBeacon('/collect');
      expect(beacon.pending).to.equal(true);

      self.__stubVisibilityChange('hidden');

      expect(beacon.pending).to.equal(false);

      self.__stubVisibilityChange('visible');
    });

    it('returns true in the next microtask if the beacon is created while hidden', async function () {
      self.__stubVisibilityChange('hidden');

      const beacon = new PendingPostBeacon('/collect');
      expect(beacon.pending).to.equal(true);

      await Promise.resolve();

      expect(beacon.pending).to.equal(false);

      self.__stubVisibilityChange('visible');
    });
  });

  describe('setData', function () {
    it('sets the data to be sent', function () {
      const beacon = new PendingPostBeacon('/collect');

      beacon.setData('one');
      beacon.sendNow();

      expect(navigator.sendBeacon.calledOnceWith('/collect', 'one'));
    });

    it('overwrites the previously set data', async function () {
      const beacon1 = new PendingPostBeacon('/collect');

      // Test with sync overwriting.
      beacon1.setData('one');
      beacon1.setData('two');

      beacon1.sendNow();

      expect(navigator.sendBeacon.calledOnceWith('/collect', 'two'));
      navigator.sendBeacon.reset();

      const beacon2 = new PendingPostBeacon('/collect');

      // Test with async sync overwriting.
      beacon2.setData('one');
      await timeout(50);
      beacon2.setData('two');
      await timeout(50);
      beacon2.setData('three');

      beacon2.sendNow();

      expect(navigator.sendBeacon.calledOnceWith('/collect', 'three'));
    });
  });

  describe('sendNow', function () {
    it('sends the currently set data', function () {
      const beacon = new PendingPostBeacon('/collect');

      beacon.setData('one');
      beacon.sendNow();

      expect(navigator.sendBeacon.calledOnceWith('/collect', 'one'));
    });

    it('sends an empty post body if no data has been set', function () {
      const beacon = new PendingPostBeacon('/collect');

      beacon.sendNow();

      expect(navigator.sendBeacon.calledOnceWith('/collect', undefined));
    });

    it('is automatically called if the page changes to hidden', async function () {
      const beacon1 = new PendingPostBeacon('/collect');
      const beacon2 = new PendingPostBeacon('/collect', {timeout: 60000});

      beacon1.setData('one');
      beacon2.setData('two');

      self.__stubVisibilityChange('hidden');
      await timeout(0);
      self.__stubVisibilityChange('visible');

      expect(navigator.sendBeacon.getCall(0).calledWith('/collect', 'one'));
      expect(navigator.sendBeacon.getCall(1).calledWith('/collect', 'two'));
    });

    it('is automatically called if the beacon is created while hidden', async function () {
      self.__stubVisibilityChange('hidden');

      const beacon1 = new PendingPostBeacon('/collect');
      const beacon2 = new PendingPostBeacon('/collect', {timeout: 60000});

      beacon1.setData('one');
      beacon2.setData('two');

      await Promise.resolve();

      expect(navigator.sendBeacon.getCall(0).calledWith('/collect', 'one'));
      expect(navigator.sendBeacon.getCall(1).calledWith('/collect', 'two'));

      self.__stubVisibilityChange('visible');
    });
  });

  describe('deactivate', function () {
    it('changes the beacon state to not pending', function () {
      const beacon = new PendingPostBeacon('/collect');

      expect(beacon.pending).to.equal(true);

      beacon.deactivate();

      expect(beacon.pending).to.equal(false);
    });

    it('cancels any queued sends', async function () {
      const beacon = new PendingPostBeacon('/collect');
      beacon.setData('to-be-cancelled');

      expect(beacon.pending).to.equal(true);

      beacon.deactivate();

      expect(beacon.pending).to.equal(false);

      self.__stubVisibilityChange('visible');
      await timeout(0);

      expect(navigator.sendBeacon.callCount).to.equal(0);
    });
  });
});
