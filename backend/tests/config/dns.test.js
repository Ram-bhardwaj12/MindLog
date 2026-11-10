import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseDnsServers } from '../../src/config/env.js';
import { applyDnsServers } from '../../src/config/dns.js';

describe('DNS_SERVERS Configuration & Parsing Tests (No Network Required)', () => {
  describe('parseDnsServers', () => {
    it('returns undefined when raw input is undefined or null', () => {
      assert.equal(parseDnsServers(undefined), undefined);
      assert.equal(parseDnsServers(null), undefined);
    });

    it('returns undefined when raw input is an empty string or whitespace only', () => {
      assert.equal(parseDnsServers(''), undefined);
      assert.equal(parseDnsServers('   '), undefined);
      assert.equal(parseDnsServers(' , ,  '), undefined);
    });

    it('correctly parses a comma-separated list of valid IPv4 addresses and trims whitespace', () => {
      const parsed = parseDnsServers(' 8.8.8.8 , 1.1.1.1 ');
      assert.deepEqual(parsed, ['8.8.8.8', '1.1.1.1']);
    });

    it('correctly parses valid IPv6 addresses', () => {
      const parsed = parseDnsServers('2001:4860:4860::8888, 1.1.1.1');
      assert.deepEqual(parsed, ['2001:4860:4860::8888', '1.1.1.1']);
    });

    it('ignores empty items between consecutive commas', () => {
      const parsed = parseDnsServers('8.8.8.8,,1.1.1.1');
      assert.deepEqual(parsed, ['8.8.8.8', '1.1.1.1']);
    });

    it('throws a descriptive error when any entry is not a valid IP address', () => {
      assert.throws(
        () => parseDnsServers('8.8.8.8, invalid_ip'),
        /Invalid IP address in DNS_SERVERS: "invalid_ip"/
      );
      assert.throws(
        () => parseDnsServers('not-an-ip'),
        /Invalid IP address in DNS_SERVERS: "not-an-ip"/
      );
      assert.throws(
        () => parseDnsServers('999.999.999.999'),
        /Invalid IP address in DNS_SERVERS: "999.999.999.999"/
      );
    });

    it('throws an error if a non-string argument is provided', () => {
      assert.throws(() => parseDnsServers(123), /DNS_SERVERS must be a string/);
      assert.throws(() => parseDnsServers({}), /DNS_SERVERS must be a string/);
    });
  });

  describe('applyDnsServers', () => {
    it('returns false and performs no operation when servers is undefined, null, or empty', () => {
      let called = false;
      const fakeDns = {
        setServers() {
          called = true;
        },
      };

      assert.equal(applyDnsServers(undefined, fakeDns), false);
      assert.equal(applyDnsServers(null, fakeDns), false);
      assert.equal(applyDnsServers([], fakeDns), false);
      assert.equal(called, false);
    });

    it('calls dns.setServers with the provided array and returns true on success', () => {
      let receivedServers = null;
      const fakeDns = {
        setServers(servers) {
          receivedServers = servers;
        },
      };

      const result = applyDnsServers(['8.8.8.8', '1.1.1.1'], fakeDns);
      assert.equal(result, true);
      assert.deepEqual(receivedServers, ['8.8.8.8', '1.1.1.1']);
    });

    it('catches errors thrown by setServers, logs a warning, does not throw, and returns false', () => {
      const fakeDns = {
        setServers() {
          throw new Error('Fake DNS setServers failure');
        },
      };

      assert.doesNotThrow(() => {
        const result = applyDnsServers(['8.8.8.8'], fakeDns);
        assert.equal(result, false);
      });
    });
  });
});

