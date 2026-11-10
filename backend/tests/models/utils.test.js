import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { isValidObjectId } from '../../src/utils/objectId.js';
import { asyncHandler } from '../../src/utils/asyncHandler.js';

describe('Shared Utility Tests (No Database Required)', () => {
  describe('isValidObjectId', () => {
    it('accepts a valid 24-character hex string', () => {
      const validHexId = '507f1f77bcf86cd799439011';
      assert.equal(isValidObjectId(validHexId), true);
    });

    it('accepts a Mongoose ObjectId instance', () => {
      const idInstance = new mongoose.Types.ObjectId();
      assert.equal(isValidObjectId(idInstance), true);
    });

    it('rejects a 12-character string (which mongoose.isValidObjectId erroneously permits)', () => {
      assert.equal(isValidObjectId('123456789012'), false);
    });

    it('rejects an empty string', () => {
      assert.equal(isValidObjectId(''), false);
    });

    it('rejects undefined and null', () => {
      assert.equal(isValidObjectId(undefined), false);
      assert.equal(isValidObjectId(null), false);
    });

    it('rejects arbitrary objects and arrays', () => {
      assert.equal(isValidObjectId({}), false);
      assert.equal(isValidObjectId([]), false);
    });

    it('rejects invalid hex characters in a 24-character string', () => {
      assert.equal(isValidObjectId('507f1f77bcf86cd7994390zz'), false);
    });
  });

  describe('asyncHandler', () => {
    it('executes successfully and does not call next when no error occurs', async () => {
      let calledNext = false;
      let executed = false;

      const handler = asyncHandler(async (req, res, next) => {
        executed = true;
      });

      await handler({}, {}, (err) => {
        calledNext = true;
      });

      assert.equal(executed, true);
      assert.equal(calledNext, false);
    });

    it('catches an unhandled rejection and forwards the error to next()', async () => {
      const testError = new Error('Async failure simulation');
      let forwardedError = null;

      const handler = asyncHandler(async () => {
        throw testError;
      });

      // Invoke wrapped handler
      await new Promise((resolve) => {
        handler({}, {}, (err) => {
          forwardedError = err;
          resolve();
        });
      });

      assert.equal(forwardedError, testError);
    });
  });
});

