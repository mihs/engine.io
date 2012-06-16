
/**
 * Module dependencies.
 */

var cluster = require('cluster')
  , debug = require('debug')('engine:cluster')

/**
 * Only execute on master.
 */

if (!cluster.isMaster) {
  return;
}

/**
 * Session ids in use with associated worker.
 *
 * @api private
 */

var sids = {};

/**
 * Active workers.
 *
 * @api private
 */

var workers = {};

/**
 * RPC methods.
 *
 * @api private
 */

var rpc = {};

/**
 * RPC - verify a session id.
 *
 * @param {Worker} originating worker
 * @param {String} session id to verify
 * @param {Function} callback
 */

rpc.verify = function (worker, sid, fn) {
  debug('verifying client "%s" from worker %d', sid, worker.uniqueID);
  fn(sids.hasOwnProperty(sid));
}

/**
 * RPC - handshake a client
 *
 * @param {Worker} originating worker
 * @param {String} session id to handshake
 * @param {Function} callback
 */

rpc.handshake = function (worker, sid, fn) {
  debug('handshaking client "%s" from worker %d', sid, worker.uniqueID);
  sids[sid] = worker.uniqueID;
  if (fn) fn();
}

/**
 * RPC - delete a client
 *
 * @param {Worker} originating worker
 * @param {String} session id
 * @param {Function} callback
 */

rpc.close = function (worker, sid, fn) {
  debug('closing client "%s" from worker %d', sid, worker.uniqueID);
  delete sids[sid];
  if (fn) fn();
}

/**
 * RPS - looks up worker by sid
 *
 * @param {Worker} originating worker
 * @param {String} session id
 * @param {Function} callback
 */

rpc.lookupWorker = function (worker, sid, fn) {
  debug('looking up what worker sid "%s" belongs to', sid);
  var worker = sids[sid];
  fn(worker);
}

/**
 * Detect a worker coming online and capture messages.
 */

cluster.on('online', function (w) {
  // keep track of worker
  workers[w.uniqueID] = w;

  // capture worker incoming RPC calls
  w.on('message', function (msg) {
    // ignore non-engine.io messages
    if (msg && msg.__engine_io) {
      var args = msg.args;

      debug('got rpc "%s" from worker %d with %j', msg.fn, msg.wid, args);

      // add callback to arguments
      if (null != msg.id) {
        args.push(function () {
          var args = Array.prototype.slice.call(arguments);
          debug('answer rpc "%s" to worker %d with %j', msg.fn, msg.wid, args);
          w.send({
              __engine_io: true
            , id: msg.id
            , wid: msg.wid
            , args: args
            , fn: msg.fn
          });
        });
      }

      // add worker as first parameter
      args.unshift(workers[msg.wid]);

      // call rpc function
      rpc[msg.fn].apply(w, args);
    }
  });
});

/**
 * Detect a worker death.
 */

cluster.on('exit', function (w) {
  var id = w.uniqueID;
  debug('worker "%s" exited unexpectedly - cleaning up', id);

  // delete session ids that belong to this worker
  for (var i in sids) {
    if (null != sids[i] && id == sids[i]) {
      delete sids[i];
    }
  }

  // delete Worker reference
  delete workers[id];
});
