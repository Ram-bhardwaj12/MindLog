/**
 * Shared toJSON transformation helpers for Mongoose schemas.
 * Ensures consistent JSON output across models, transforming _id to id (string)
 * and stripping internal MongoDB properties (__v).
 */

/**
 * Strips MongoDB internal fields and maps _id to a string id.
 *
 * @param {import('mongoose').Document} doc - Original Mongoose document
 * @param {Record<string, any>} ret - Serialized plain object to transform
 * @returns {Record<string, any>} Transformed object
 */
export function baseJsonTransform(doc, ret) {
  if (ret._id) {
    ret.id = ret._id.toString();
    delete ret._id;
  }
  delete ret.__v;
  return ret;
}

