/**
 * Module dependencies.
 */

var XHR = require('./polling-xhr')
  , Transport = require('../transport')

/**
 * Module exports.
 */

module.exports = DynamicP;

/**
 * Dynamic polling transport.
 *
 * @api public
 */

function DynamicP (req) {
  XHR.call(this, req);
  this.readyState = 'open';
};

/**
 * Inherits from XHR.
 */

DynamicP.prototype.__proto__ = XHR.prototype;

/**
 * Transport name
 *
 * @api public
 */

DynamicP.prototype.name = 'dynamicpolling';

/**
 * Immediately send to end the response
 *
 */

DynamicP.prototype.onPollRequest = function(req, res) {
  XHR.prototype.onPollRequest.call(this, req, res);
  if (this.readyState == 'open' && this.writable) {
    this.send([]);
  }
};
